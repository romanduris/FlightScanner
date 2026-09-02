"""Vyhľadanie najlacnejších mesačných letov Wizz Air z Bratislavy."""

from __future__ import annotations

import re
import time
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from services.bts_schedule import (
    BtsScheduleError,
    ScheduledFlight,
    find_scheduled_flight,
    load_bts_schedule,
    schedule_url_from_airlines_json,
)
from services.flight_time import calculate_duration_minutes

from .base import (
    BaseAirlineProvider,
    Destination,
    FlightOffer,
    JsonHttpClient,
    OutboundOffer,
    ProviderError,
    RETURN_WINDOW_DAYS,
    ReturnOffer,
    RouteFailure,
    build_weekly_schedule,
    parse_local_datetime,
)


PROJECT_DIR = Path(__file__).resolve().parent.parent
AIRLINES_FILE = PROJECT_DIR / "Data" / "airlines.json"
WIZZ_CONFIG_URL = "https://ssr-weu2.wizzair.com/en-gb"
WIZZ_API_URL_PATTERN = re.compile(
    r'apiUrl:"(https://be\.wizzair\.com/[^"/]+/Api)"'
)
# Dvojica položiek flightList tvorí smer tam a späť pre jednu destináciu.
# Jednotlivé destinácie preto posielame oddelene.
ROUTES_PER_REQUEST = 1


class WizzAirProvider(BaseAirlineProvider):
    """Provider najnižších jednosmerných cien spoločnosti Wizz Air."""

    airline_name = "Wizz Air"

    def __init__(self, max_workers: int = 4) -> None:
        self.client = JsonHttpClient(timeout_seconds=30, retries=2)
        # Parameter zachováva spoločné rozhranie providerov. Wizz požiadavky
        # posielame po dávkach, aby sme zbytočne nezaťažovali server.
        self.max_workers = max(1, min(max_workers, 8))
        self._api_url: str | None = None

    def scan_month(
        self,
        origin_iata: str,
        destinations: list[Destination],
        year: int,
        month: int,
    ) -> tuple[list[FlightOffer], list[RouteFailure]]:
        try:
            schedule_url = schedule_url_from_airlines_json(AIRLINES_FILE)
            bts_schedule = load_bts_schedule(schedule_url)
            monthly_flights, monthly_return_flights, request_failures = (
                self._load_monthly_flights(
                    origin_iata, destinations, year, month
                )
            )
        except BtsScheduleError as error:
            raise ProviderError(str(error)) from error

        destination_by_iata = {
            destination.iata: destination for destination in destinations
        }
        flights_by_destination: dict[str, list[dict[str, Any]]] = {}
        for flight in monthly_flights:
            destination_iata = str(flight.get("arrivalStation") or "").upper()
            if destination_iata in destination_by_iata:
                flights_by_destination.setdefault(destination_iata, []).append(flight)
        returns_by_destination: dict[str, list[dict[str, Any]]] = {}
        for flight in monthly_return_flights:
            return_origin_iata = str(flight.get("departureStation") or "").upper()
            if return_origin_iata in destination_by_iata:
                returns_by_destination.setdefault(return_origin_iata, []).append(flight)

        offers: list[FlightOffer] = []
        failures: list[RouteFailure] = []
        for destination in destinations:
            request_failure = request_failures.get(destination.iata)
            if request_failure is not None:
                failures.append(
                    RouteFailure(
                        destination.name,
                        destination.iata,
                        request_failure,
                    )
                )
                continue

            try:
                offer = self._build_cheapest_offer(
                    origin_iata,
                    destination,
                    flights_by_destination.get(destination.iata, []),
                    bts_schedule,
                )
            except ProviderError as error:
                failures.append(
                    RouteFailure(destination.name, destination.iata, str(error))
                )
                continue

            if offer is None:
                failures.append(
                    RouteFailure(
                        destination.name,
                        destination.iata,
                        "V zadanom mesiaci nie je dostupná verejná cena.",
                    )
                )
            else:
                try:
                    offer = replace(
                        offer,
                        return_offers=self._get_return_offers(
                            origin_iata=destination.iata,
                            destination_iata=origin_iata,
                            flights=returns_by_destination.get(
                                destination.iata, []
                            ),
                        ),
                    )
                except ProviderError as error:
                    # Chyba spiatočného skenu nesmie skryť použiteľný let tam.
                    offer = replace(offer, return_search_error=str(error))
                offers.append(offer)

        offers.sort(key=lambda item: item.destination_name)
        failures.sort(key=lambda item: item.destination_name)
        return offers, failures

    def _discover_api_url(self) -> str:
        if self._api_url is not None:
            return self._api_url

        request = Request(
            WIZZ_CONFIG_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (FlightScanner personal project)",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "sk,en;q=0.8",
            },
        )
        try:
            with urlopen(request, timeout=20) as response:
                page = response.read().decode("utf-8", errors="replace")
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            raise ProviderError(
                f"Konfiguráciu Wizz Air API sa nepodarilo načítať: {error}"
            ) from error

        match = WIZZ_API_URL_PATTERN.search(page)
        if match is None:
            raise ProviderError("Na stránke Wizz Air sa nenašla aktuálna API URL.")

        self._api_url = match.group(1)
        return self._api_url

    def _load_monthly_flights(
        self,
        origin_iata: str,
        destinations: list[Destination],
        year: int,
        month: int,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str]]:
        api_url = self._discover_api_url()
        requested_first_day = date(year, month, 1)
        if month == 12:
            next_month = datetime(year + 1, 1, 1)
        else:
            next_month = datetime(year, month + 1, 1)
        requested_last_day = next_month.date() - timedelta(days=1)
        first_day = max(
            requested_first_day,
            datetime.now(timezone.utc).date(),
        )
        if first_day > requested_last_day:
            return [], [], {}
        first_day_value = first_day.isoformat()
        last_day = requested_last_day.isoformat()
        return_last_day = (
            requested_last_day + timedelta(days=RETURN_WINDOW_DAYS)
        ).isoformat()

        all_flights: list[dict[str, Any]] = []
        all_return_flights: list[dict[str, Any]] = []
        request_failures: dict[str, str] = {}
        pending_batches = [
            destinations[start : start + ROUTES_PER_REQUEST]
            for start in range(0, len(destinations), ROUTES_PER_REQUEST)
        ]

        # Po prvom kole zopakujeme iba neúspešné trasy. Wizz niekedy krátko
        # vracia 503, pričom ostatné trasy sú už dostupné.
        for round_number in range(2):
            failed_batches: list[list[Destination]] = []
            for batch in pending_batches:
                payload = {
                    "flightList": [
                        route
                        for destination in batch
                        for route in (
                            {
                                "departureStation": origin_iata,
                                "arrivalStation": destination.iata,
                                "from": first_day_value,
                                "to": last_day,
                            },
                            {
                                "departureStation": destination.iata,
                                "arrivalStation": origin_iata,
                                "from": first_day_value,
                                "to": return_last_day,
                            },
                        )
                    ],
                    "priceType": "regular",
                    "adultCount": 1,
                    "childCount": 0,
                    "infantCount": 0,
                }
                try:
                    response = self.client.post_json(
                        f"{api_url}/search/timetableV2",
                        payload,
                        extra_headers={
                            "Origin": "https://www.wizzair.com",
                            "Referer": "https://www.wizzair.com/",
                        },
                    )
                except ProviderError as error:
                    for destination in batch:
                        request_failures[destination.iata] = str(error)
                    failed_batches.append(batch)
                    continue

                outbound_flights = response.get("outboundFlights") or []
                return_flights = response.get("returnFlights") or []
                if not isinstance(outbound_flights, list) or not isinstance(
                    return_flights, list
                ):
                    for destination in batch:
                        request_failures[destination.iata] = (
                            "Wizz Air vrátil neplatný zoznam letov."
                        )
                    failed_batches.append(batch)
                    continue

                all_flights.extend(
                    flight for flight in outbound_flights if isinstance(flight, dict)
                )
                all_return_flights.extend(
                    flight for flight in return_flights if isinstance(flight, dict)
                )
                for destination in batch:
                    request_failures.pop(destination.iata, None)
                time.sleep(0.15)

            pending_batches = failed_batches
            if not pending_batches:
                break
            if round_number == 0:
                time.sleep(1)

        return all_flights, all_return_flights, request_failures

    def _get_return_offers(
        self,
        origin_iata: str,
        destination_iata: str,
        flights: list[dict[str, Any]],
    ) -> tuple[ReturnOffer, ...]:
        """Vytvorí spiatočné možnosti pre všetky mesačné odlety."""

        return_offers: list[ReturnOffer] = []
        for flight in flights:
            if flight.get("priceType") != "price":
                continue
            price = flight.get("price") or {}
            try:
                amount = float(price["amount"])
                currency = str(price["currencyCode"])
                departure = parse_local_datetime(str(flight["departureDate"]))
            except (KeyError, TypeError, ValueError) as error:
                raise ProviderError(
                    "Wizz Air vrátil neplatný formát spiatočného letu."
                ) from error
            if amount <= 0:
                continue
            return_offers.append(
                ReturnOffer(
                    airline=self.airline_name,
                    origin_iata=origin_iata,
                    destination_iata=destination_iata,
                    departure_local=departure.isoformat(timespec="minutes"),
                    arrival_local=None,
                    price=amount,
                    currency=currency,
                )
            )
        return tuple(sorted(return_offers, key=lambda item: item.departure_local))

    def _build_cheapest_offer(
        self,
        origin_iata: str,
        destination: Destination,
        flights: list[dict[str, Any]],
        bts_schedule: list[ScheduledFlight],
    ) -> FlightOffer | None:
        priced_flights: list[tuple[float, datetime, str]] = []
        monthly_departures: list[datetime] = []
        for flight in flights:
            departure_value = flight.get("departureDate")
            if departure_value:
                try:
                    monthly_departures.append(
                        parse_local_datetime(str(departure_value))
                    )
                except ProviderError:
                    pass

            if flight.get("priceType") != "price":
                continue
            price = flight.get("price") or {}
            try:
                amount = float(price["amount"])
                currency = str(price["currencyCode"])
                departure = parse_local_datetime(str(flight["departureDate"]))
            except (KeyError, TypeError, ValueError) as error:
                raise ProviderError("Wizz Air vrátil neplatný formát letu.") from error
            if amount > 0:
                priced_flights.append((amount, departure, currency))

        if not priced_flights:
            return None

        outbound_offers: list[OutboundOffer] = []
        for amount, departure, currency in priced_flights:
            scheduled_flight = find_scheduled_flight(
                bts_schedule,
                destination.iata,
                departure,
                carrier_prefixes=("W6", "W4"),
            )
            if scheduled_flight is None:
                continue
            arrival = scheduled_flight.arrival_datetime_for(departure)
            outbound_offers.append(
                OutboundOffer(
                    departure_local=departure.isoformat(timespec="minutes"),
                    arrival_local=arrival.isoformat(timespec="minutes"),
                    price=amount,
                    currency=currency,
                    flight_number=scheduled_flight.flight_number,
                    duration_minutes=calculate_duration_minutes(
                        departure,
                        arrival,
                        origin_iata,
                        destination.iata,
                    ),
                )
            )

        if not outbound_offers:
            raise ProviderError(
                "Cenové lety sa nepodarilo spojiť s cestovným poriadkom BTS."
            )

        outbound_offers.sort(key=lambda item: item.departure_local)
        cheapest = min(
            outbound_offers,
            key=lambda item: (item.price, item.departure_local),
        )
        return FlightOffer(
            airline=self.airline_name,
            origin_iata=origin_iata,
            destination_name=destination.name,
            destination_iata=destination.iata,
            flight_number=cheapest.flight_number,
            departure_local=cheapest.departure_local,
            arrival_local=cheapest.arrival_local,
            price=cheapest.price,
            currency=cheapest.currency,
            operating_schedule=build_weekly_schedule(monthly_departures),
            duration_minutes=cheapest.duration_minutes,
            outbound_offers=tuple(outbound_offers),
        )
