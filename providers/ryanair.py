"""Vyhľadanie najlacnejších mesačných letov Ryanair z Bratislavy."""

from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.flight_time import calculate_duration_minutes

try:
    from .base import (
        BaseAirlineProvider,
        Destination,
        FlightOffer,
        JsonHttpClient,
        ProviderError,
        RETURN_WINDOW_DAYS,
        ReturnOffer,
        RouteFailure,
        build_weekly_schedule,
        parse_local_datetime,
    )
except ImportError:  # Umožní aj priame spustenie: python3 providers/ryanair.py
    from base import (  # type: ignore[no-redef]
        BaseAirlineProvider,
        Destination,
        FlightOffer,
        JsonHttpClient,
        ProviderError,
        RETURN_WINDOW_DAYS,
        ReturnOffer,
        RouteFailure,
        build_weekly_schedule,
        parse_local_datetime,
    )


PROJECT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_AIRLINES_FILE = PROJECT_DIR / "Data" / "airlines.json"
FARE_API_URL = (
    "https://www.ryanair.com/api/farfnd/v4/oneWayFares/"
    "{origin}/{destination}/cheapestPerDay"
)
SCHEDULE_API_URL = (
    "https://services-api.ryanair.com/timtbl/3/schedules/"
    "{origin}/{destination}/years/{year}/months/{month}"
)


class RyanairProvider(BaseAirlineProvider):
    """Provider najnižších jednosmerných cien spoločnosti Ryanair."""

    airline_name = "RYANAIR"

    def __init__(self, max_workers: int = 4) -> None:
        self.client = JsonHttpClient(timeout_seconds=20, retries=2)
        self.max_workers = max(1, min(max_workers, 8))

    def scan_month(
        self,
        origin_iata: str,
        destinations: list[Destination],
        year: int,
        month: int,
    ) -> tuple[list[FlightOffer], list[RouteFailure]]:
        offers: list[FlightOffer] = []
        failures: list[RouteFailure] = []

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(
                    self._scan_destination,
                    origin_iata,
                    destination,
                    year,
                    month,
                ): destination
                for destination in destinations
            }

            for future in as_completed(futures):
                destination = futures[future]
                try:
                    offer = future.result()
                    if offer is None:
                        failures.append(
                            RouteFailure(
                                destination.name,
                                destination.iata,
                                "V zadanom mesiaci nie je dostupná cena.",
                            )
                        )
                    else:
                        offers.append(offer)
                except ProviderError as error:
                    failures.append(
                        RouteFailure(destination.name, destination.iata, str(error))
                    )

        offers.sort(key=lambda item: item.destination_name)
        failures.sort(key=lambda item: item.destination_name)
        return offers, failures

    def _scan_destination(
        self,
        origin_iata: str,
        destination: Destination,
        year: int,
        month: int,
    ) -> FlightOffer | None:
        fare = self._get_lowest_fare(origin_iata, destination.iata, year, month)
        if fare is None:
            return None

        departure = parse_local_datetime(fare["departureDate"])
        arrival = parse_local_datetime(fare["arrivalDate"])
        flight_number, operating_schedule = self._get_schedule_details(
            origin_iata,
            destination.iata,
            departure,
            year,
            month,
        )

        price = fare.get("price") or {}
        try:
            price_value = float(price["value"])
            currency = str(price["currencyCode"])
        except (KeyError, TypeError, ValueError) as error:
            raise ProviderError("Ryanair vrátil neplatný formát ceny.") from error

        return_offers: tuple[ReturnOffer, ...] = ()
        return_search_error: str | None = None
        try:
            return_offers = self._get_return_offers(
                origin_iata=destination.iata,
                destination_iata=origin_iata,
                outbound_departure=departure,
            )
        except ProviderError as error:
            # Chyba spiatočného skenu nesmie skryť použiteľnú cenu letu tam.
            return_search_error = str(error)

        return FlightOffer(
            airline=self.airline_name,
            origin_iata=origin_iata,
            destination_name=destination.name,
            destination_iata=destination.iata,
            flight_number=flight_number,
            departure_local=departure.isoformat(timespec="minutes"),
            arrival_local=arrival.isoformat(timespec="minutes"),
            price=price_value,
            currency=currency,
            operating_schedule=operating_schedule,
            duration_minutes=calculate_duration_minutes(
                departure,
                arrival,
                origin_iata,
                destination.iata,
            ),
            return_offers=return_offers,
            return_search_error=return_search_error,
        )

    def _get_return_offers(
        self,
        origin_iata: str,
        destination_iata: str,
        outbound_departure: datetime,
    ) -> tuple[ReturnOffer, ...]:
        """Načíta najlacnejší spiatočný let pre každý z ďalších 10 dní."""

        first_day = outbound_departure.date() + timedelta(days=1)
        last_day = outbound_departure.date() + timedelta(days=RETURN_WINDOW_DAYS)
        month_starts: list[date] = []
        cursor = first_day.replace(day=1)
        while cursor <= last_day:
            month_starts.append(cursor)
            cursor = (
                date(cursor.year + 1, 1, 1)
                if cursor.month == 12
                else date(cursor.year, cursor.month + 1, 1)
            )

        return_offers: list[ReturnOffer] = []
        for month_start in month_starts:
            base_url = FARE_API_URL.format(
                origin=origin_iata,
                destination=destination_iata,
            )
            query = urlencode(
                {
                    "outboundMonthOfDate": month_start.isoformat(),
                    "currency": "EUR",
                }
            )
            payload = self.client.get_json(f"{base_url}?{query}")
            for fare in (payload.get("outbound") or {}).get("fares") or []:
                departure_value = fare.get("departureDate")
                arrival_value = fare.get("arrivalDate")
                price = fare.get("price") or {}
                if (
                    fare.get("unavailable")
                    or not departure_value
                    or not arrival_value
                    or not price
                ):
                    continue
                departure = parse_local_datetime(str(departure_value))
                if not first_day <= departure.date() <= last_day:
                    continue
                arrival = parse_local_datetime(str(arrival_value))
                try:
                    amount = float(price["value"])
                    currency = str(price["currencyCode"])
                except (KeyError, TypeError, ValueError) as error:
                    raise ProviderError(
                        "Ryanair vrátil neplatný formát spiatočnej ceny."
                    ) from error
                return_offers.append(
                    ReturnOffer(
                        airline=self.airline_name,
                        origin_iata=origin_iata,
                        destination_iata=destination_iata,
                        departure_local=departure.isoformat(timespec="minutes"),
                        arrival_local=arrival.isoformat(timespec="minutes"),
                        price=amount,
                        currency=currency,
                        duration_minutes=calculate_duration_minutes(
                            departure,
                            arrival,
                            origin_iata,
                            destination_iata,
                        ),
                    )
                )

        return tuple(sorted(return_offers, key=lambda item: item.departure_local))

    def _get_lowest_fare(
        self,
        origin_iata: str,
        destination_iata: str,
        year: int,
        month: int,
    ) -> dict[str, Any] | None:
        base_url = FARE_API_URL.format(
            origin=origin_iata,
            destination=destination_iata,
        )
        query = urlencode(
            {
                "outboundMonthOfDate": f"{year:04d}-{month:02d}-01",
                "currency": "EUR",
            }
        )
        payload = self.client.get_json(f"{base_url}?{query}")
        outbound = payload.get("outbound") or {}
        fare = outbound.get("minFare")

        if not fare or fare.get("unavailable") or fare.get("price") is None:
            return None
        if not fare.get("departureDate") or not fare.get("arrivalDate"):
            raise ProviderError("Najnižšej cene chýba dátum odletu alebo príletu.")
        return fare

    def _get_schedule_details(
        self,
        origin_iata: str,
        destination_iata: str,
        departure: datetime,
        year: int,
        month: int,
    ) -> tuple[str | None, tuple[str, ...]]:
        url = SCHEDULE_API_URL.format(
            origin=origin_iata,
            destination=destination_iata,
            year=year,
            month=month,
        )
        try:
            payload = self.client.get_json(url)
        except ProviderError:
            # Cena, dátum a čas sú stále použiteľné aj bez čísla letu.
            return None, ()

        monthly_departures: list[datetime] = []
        selected_flight_number: str | None = None
        for day in payload.get("days") or []:
            try:
                day_number = int(day["day"])
            except (KeyError, TypeError, ValueError):
                continue
            for flight in day.get("flights") or []:
                carrier = str(flight.get("carrierCode") or "").strip()
                number = str(flight.get("number") or "").strip()
                departure_time = str(flight.get("departureTime") or "").strip()
                if carrier != "FR" or not departure_time:
                    continue
                try:
                    hour, minute = (int(part) for part in departure_time.split(":"))
                    scheduled_departure = datetime(
                        year, month, day_number, hour, minute
                    )
                except (TypeError, ValueError):
                    continue

                monthly_departures.append(scheduled_departure)
                if scheduled_departure == departure and number:
                    selected_flight_number = f"{carrier}{number}"

        return selected_flight_number, build_weekly_schedule(monthly_departures)


def load_ryanair_destinations(path: Path) -> list[Destination]:
    """Načíta Ryanair destinácie vytvorené prvým skriptom."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ProviderError(
            f"Chýba {path}. Najprv spusti: python3 1.ListOfAirlines.py"
        ) from error
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ProviderError(f"Súbor {path} sa nepodarilo načítať: {error}") from error

    for airline in payload.get("airlines") or []:
        if str(airline.get("name", "")).casefold() != "ryanair":
            continue
        destinations = [
            Destination(str(item["name"]), str(item["iata"]).upper())
            for item in airline.get("destinations") or []
            if item.get("name") and item.get("iata")
        ]
        if destinations:
            return destinations

    raise ProviderError(
        "V airlines.json nie sú Ryanair destinácie. Znovu spusti prvý skript."
    )


def save_results(
    path: Path,
    year: int,
    month: int,
    offers: list[FlightOffer],
    failures: list[RouteFailure],
    scanned_at: datetime,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "airline": "RYANAIR",
        "origin_iata": "BTS",
        "year": year,
        "month": month,
        "trip_type": "one_way",
        "fare_type": "basic",
        "times_are_local": True,
        "scanned_at_utc": scanned_at.isoformat(),
        "offer_count": len(offers),
        "failure_count": len(failures),
        "offers": [offer.to_dict() for offer in offers],
        "failures": [failure.to_dict() for failure in failures],
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def format_local_datetime(value: str) -> str:
    return datetime.fromisoformat(value).strftime("%d.%m.%Y %H:%M")


def print_results(
    year: int,
    month: int,
    offers: list[FlightOffer],
    failures: list[RouteFailure],
    output_file: Path,
    scanned_at: datetime,
) -> None:
    print(f"Najlacnejšie jednosmerné lety Ryanair z BTS – {month:02d}/{year}")
    print("Ceny sú za 1 dospelého, základná tarifa; časy sú miestne.")
    print("=" * 112)
    print(
        f"{'Destinácia':<29} {'Let':<8} {'Odlet':<17} "
        f"{'Prílet':<17} {'Najnižšia cena':>16}"
    )
    print("-" * 112)

    for offer in offers:
        destination = f"{offer.destination_name} ({offer.destination_iata})"
        flight_number = offer.flight_number or "—"
        price = f"{offer.price:.2f} {offer.currency}".replace(".", ",")
        print(
            f"{destination[:28]:<29} {flight_number:<8} "
            f"{format_local_datetime(offer.departure_local):<17} "
            f"{format_local_datetime(offer.arrival_local):<17} {price:>16}"
        )

    if failures:
        print("\nTrasy bez dostupnej ceny alebo s chybou:")
        for failure in failures:
            print(
                f"  - {failure.destination_name} ({failure.destination_iata}): "
                f"{failure.reason}"
            )

    if offers:
        cheapest = min(offers, key=lambda item: item.price)
        print(
            "\nNajlacnejší let mesiaca: "
            f"{cheapest.destination_name} ({cheapest.destination_iata}) – "
            f"{cheapest.price:.2f} {cheapest.currency}"
        )

    print(f"Úspešne načítané: {len(offers)}, bez ceny/chyba: {len(failures)}")
    print(f"Sken vykonaný: {scanned_at.strftime('%d.%m.%Y %H:%M:%S')} UTC")
    print(f"JSON uložený do: {output_file.relative_to(PROJECT_DIR)}")
    print("Poznámka: ceny sú dynamické a pri rezervácii sa môžu zmeniť.")


def parse_args() -> argparse.Namespace:
    current_year = datetime.now(timezone.utc).year
    parser = argparse.ArgumentParser(
        description=(
            "Nájde najnižšiu jednosmernú cenu Ryanair z BTS "
            "pre každú destináciu v zadanom mesiaci."
        )
    )
    parser.add_argument("--year", type=int, default=current_year)
    parser.add_argument("--month", type=int, choices=range(1, 13), default=9)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--airlines-file", type=Path, default=DEFAULT_AIRLINES_FILE)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        destinations = load_ryanair_destinations(args.airlines_file)
        provider = RyanairProvider(max_workers=args.workers)
        offers, failures = provider.scan_month(
            origin_iata="BTS",
            destinations=destinations,
            year=args.year,
            month=args.month,
        )
    except ProviderError as error:
        print(f"Chyba: {error}", file=sys.stderr)
        return 1

    scanned_at = datetime.now(timezone.utc)
    output_file = (
        PROJECT_DIR
        / "Data"
        / f"ryanair_{args.year:04d}_{args.month:02d}.json"
    )
    save_results(
        output_file,
        args.year,
        args.month,
        offers,
        failures,
        scanned_at,
    )
    print_results(
        args.year,
        args.month,
        offers,
        failures,
        output_file,
        scanned_at,
    )
    return 0 if offers else 1


if __name__ == "__main__":
    raise SystemExit(main())
