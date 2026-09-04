#!/usr/bin/env python3
"""Setrne zisti, dokedy aerolinky ponukaju ocenene lety z Bratislavy."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from providers.base import Destination, JsonHttpClient, ProviderError, parse_local_datetime
from providers.ryanair import FARE_API_URL
from providers.wizzair import WizzAirProvider


PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_AIRLINES_FILE = PROJECT_DIR / "Data" / "airlines.json"
DEFAULT_OUTPUT_FILE = PROJECT_DIR / "Data" / "provider_horizons.json"
DEFAULT_MAX_MONTHS = 24
DEFAULT_STEP_MONTHS = 3
DEFAULT_REQUEST_DELAY_SECONDS = 1.0
DEFAULT_CACHE_HOURS = 168

# Prednostne skusame trasy, ktore byvaju v ponuke pocas vacsej casti roka.
# Ak niektora v aktualnom airlines.json nie je, automaticky sa preskoci.
ANCHOR_IATAS = {
    "RYANAIR": ("STN", "DUB", "CIA"),
    "Wizz Air": ("LTN", "SKP", "WAW"),
}


@dataclass(frozen=True)
class MonthProbeResult:
    """Vysledok kontroly jedneho mesiaca cez niekolko vzorovych tras."""

    state: str
    dates: tuple[date, ...] = ()
    successful_routes: tuple[str, ...] = ()
    errors: tuple[str, ...] = ()


class AirlineHorizonProbe:
    """Spolocne spravanie setrnych providerov horizontu."""

    airline_name: str

    def __init__(self, request_delay_seconds: float) -> None:
        self.client = JsonHttpClient(
            timeout_seconds=30,
            retries=1,
            min_interval_seconds=request_delay_seconds,
            backoff_base_seconds=3,
        )
        self.request_count = 0
        self._route_month_cache: dict[tuple[str, str, date, date], list[date]] = {}

    def fetch_route_month(
        self,
        origin_iata: str,
        destination_iata: str,
        month_start: date,
        today: date,
    ) -> list[date]:
        cache_key = (origin_iata, destination_iata, month_start, today)
        if cache_key not in self._route_month_cache:
            self._route_month_cache[cache_key] = self._fetch_route_month(
                origin_iata,
                destination_iata,
                month_start,
                today,
            )
        return self._route_month_cache[cache_key]

    def _fetch_route_month(
        self,
        origin_iata: str,
        destination_iata: str,
        month_start: date,
        today: date,
    ) -> list[date]:
        raise NotImplementedError


class RyanairHorizonProbe(AirlineHorizonProbe):
    airline_name = "RYANAIR"

    def _fetch_route_month(
        self,
        origin_iata: str,
        destination_iata: str,
        month_start: date,
        today: date,
    ) -> list[date]:
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
        self.request_count += 1
        payload = self.client.get_json(f"{base_url}?{query}")
        fares = (payload.get("outbound") or {}).get("fares") or []
        if not isinstance(fares, list):
            raise ProviderError("Ryanair vratil neplatny zoznam cien.")

        dates: list[date] = []
        for fare in fares:
            if not isinstance(fare, dict) or fare.get("unavailable"):
                continue
            price = fare.get("price") or {}
            departure_value = fare.get("departureDate")
            try:
                amount = float(price["value"])
                departure = parse_local_datetime(str(departure_value)).date()
            except (KeyError, TypeError, ValueError, ProviderError):
                continue
            if amount > 0 and departure >= today:
                dates.append(departure)
        return sorted(set(dates))


class WizzAirHorizonProbe(AirlineHorizonProbe):
    airline_name = "Wizz Air"

    def __init__(self, request_delay_seconds: float) -> None:
        super().__init__(request_delay_seconds)
        self._provider = WizzAirProvider(max_workers=1)
        self._api_url: str | None = None

    def _discover_api_url(self) -> str:
        if self._api_url is None:
            self._api_url = self._provider._discover_api_url()
        return self._api_url

    def _fetch_route_month(
        self,
        origin_iata: str,
        destination_iata: str,
        month_start: date,
        today: date,
    ) -> list[date]:
        month_end = add_months(month_start, 1) - timedelta(days=1)
        first_day = max(month_start, today)
        if first_day > month_end:
            return []

        payload = {
            "flightList": [
                {
                    "departureStation": origin_iata,
                    "arrivalStation": destination_iata,
                    "from": first_day.isoformat(),
                    "to": month_end.isoformat(),
                }
            ],
            "priceType": "regular",
            "adultCount": 1,
            "childCount": 0,
            "infantCount": 0,
        }
        self.request_count += 1
        response = self.client.post_json(
            f"{self._discover_api_url()}/search/timetableV2",
            payload,
            extra_headers={
                "Origin": "https://www.wizzair.com",
                "Referer": "https://www.wizzair.com/",
            },
        )
        flights = response.get("outboundFlights") or []
        if not isinstance(flights, list):
            raise ProviderError("Wizz Air vratil neplatny zoznam letov.")

        dates: list[date] = []
        for flight in flights:
            if not isinstance(flight, dict) or flight.get("priceType") != "price":
                continue
            price = flight.get("price") or {}
            departure_value = flight.get("departureDate")
            try:
                amount = float(price["amount"])
                departure = parse_local_datetime(str(departure_value)).date()
            except (KeyError, TypeError, ValueError, ProviderError):
                continue
            if amount > 0 and first_day <= departure <= month_end:
                dates.append(departure)
        return sorted(set(dates))


def add_months(value: date, months: int) -> date:
    """Posunie prvy den mesiaca o zadany pocet mesiacov."""

    month_index = value.year * 12 + value.month - 1 + months
    return date(month_index // 12, month_index % 12 + 1, 1)


def positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("hodnota musi byt cele cislo") from error
    if number < 1:
        raise argparse.ArgumentTypeError("hodnota musi byt aspon 1")
    return number


def non_negative_float(value: str) -> float:
    try:
        number = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("hodnota musi byt cislo") from error
    if number < 0:
        raise argparse.ArgumentTypeError("hodnota nesmie byt zaporna")
    return number


def load_destinations(path: Path) -> dict[str, list[Destination]]:
    """Nacita cielove letiska Ryanair a Wizz Air z airlines.json."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ProviderError(
            f"Chyba {path}. Najprv spusti: python3 1.ListOfAirlines.py"
        ) from error
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ProviderError(f"Subor {path} sa nepodarilo nacitat: {error}") from error

    result: dict[str, list[Destination]] = {}
    for airline in payload.get("airlines") or []:
        name = str(airline.get("name") or "").strip()
        if name not in ANCHOR_IATAS:
            continue
        result[name] = [
            Destination(str(item["name"]), str(item["iata"]).upper())
            for item in airline.get("destinations") or []
            if item.get("name") and item.get("iata")
        ]
    return result


def select_anchor_destinations(
    airline_name: str,
    destinations: list[Destination],
) -> list[Destination]:
    """Vyberie najviac tri zname pravidelne trasy, pripadne prve dostupne."""

    by_iata = {destination.iata: destination for destination in destinations}
    anchors = [
        by_iata[iata]
        for iata in ANCHOR_IATAS[airline_name]
        if iata in by_iata
    ]
    for destination in destinations:
        if len(anchors) >= 3:
            break
        if destination not in anchors:
            anchors.append(destination)
    return anchors


def probe_anchor_month(
    probe: AirlineHorizonProbe,
    origin_iata: str,
    anchors: list[Destination],
    month_start: date,
    today: date,
) -> MonthProbeResult:
    """Najde aspon jednu cenu v mesiaci bez prehladavania vsetkych tras."""

    found_dates: list[date] = []
    successful_routes: list[str] = []
    errors: list[str] = []
    print(f"  Kontrolujem {month_start.strftime('%m/%Y')}:", flush=True)
    for destination in anchors:
        print(f"    {origin_iata} -> {destination.iata} ... ", end="", flush=True)
        try:
            route_dates = probe.fetch_route_month(
                origin_iata,
                destination.iata,
                month_start,
                today,
            )
        except ProviderError as error:
            message = f"{destination.iata}: {error}"
            errors.append(message)
            print(f"CHYBA ({error})", flush=True)
            continue

        successful_routes.append(destination.iata)
        if route_dates:
            found_dates.extend(route_dates)
            print(
                f"ano, posledny let {max(route_dates).strftime('%d.%m.%Y')}",
                flush=True,
            )
            # Na urcenie dostupnosti mesiaca staci jedna uspesna kotviaca trasa.
            break
        print("bez ceny", flush=True)

    if found_dates:
        return MonthProbeResult(
            state="available",
            dates=tuple(sorted(set(found_dates))),
            successful_routes=tuple(successful_routes),
            errors=tuple(errors),
        )
    if errors:
        return MonthProbeResult(
            state="error",
            successful_routes=tuple(successful_routes),
            errors=tuple(errors),
        )
    return MonthProbeResult(
        state="unavailable",
        successful_routes=tuple(successful_routes),
    )


def scan_all_routes_in_month(
    probe: AirlineHorizonProbe,
    origin_iata: str,
    destinations: list[Destination],
    month_start: date,
    today: date,
) -> tuple[list[date], list[str]]:
    """Spresni posledny datum cez vsetky zname trasy iba v jednom mesiaci."""

    print(
        f"  Spresnujem posledny datum v {month_start.strftime('%m/%Y')} "
        f"cez {len(destinations)} tras:",
        flush=True,
    )
    found_dates: list[date] = []
    errors: list[str] = []
    for index, destination in enumerate(destinations, start=1):
        print(
            f"    [{index:02d}/{len(destinations):02d}] "
            f"{origin_iata} -> {destination.iata} ... ",
            end="",
            flush=True,
        )
        try:
            route_dates = probe.fetch_route_month(
                origin_iata,
                destination.iata,
                month_start,
                today,
            )
        except ProviderError as error:
            errors.append(f"{destination.iata}: {error}")
            print(f"CHYBA ({error})", flush=True)
            continue
        if route_dates:
            found_dates.extend(route_dates)
            print(max(route_dates).strftime("posledny %d.%m.%Y"), flush=True)
        else:
            print("bez ceny", flush=True)
    return sorted(set(found_dates)), errors


def coarse_months(first_month: date, max_months: int, step_months: int) -> list[date]:
    offsets = list(range(0, max_months + 1, step_months))
    if offsets[-1] != max_months:
        offsets.append(max_months)
    return [add_months(first_month, offset) for offset in offsets]


def find_airline_horizon(
    probe: AirlineHorizonProbe,
    destinations: list[Destination],
    today: date,
    max_months: int,
    step_months: int,
) -> dict[str, Any]:
    """Najprv najde hranicu kotviacimi trasami, potom spresni posledny mesiac."""

    if not destinations:
        raise ProviderError("V airlines.json nie su destinacie tejto aerolinky.")
    origin_iata = "BTS"
    first_month = today.replace(day=1)
    anchors = select_anchor_destinations(probe.airline_name, destinations)
    checked: dict[date, MonthProbeResult] = {}
    all_errors: list[str] = []

    print(
        f"  Kotviace trasy: {', '.join(item.iata for item in anchors)}",
        flush=True,
    )
    for month_start in coarse_months(first_month, max_months, step_months):
        result = probe_anchor_month(
            probe, origin_iata, anchors, month_start, today
        )
        checked[month_start] = result
        all_errors.extend(result.errors)
        if result.state == "unavailable" and any(
            checked_result.state == "available"
            for checked_result in checked.values()
        ):
            break

    available_months = [
        month_start
        for month_start, result in checked.items()
        if result.state == "available"
    ]
    if not available_months:
        errors = all_errors or [
            "Na kotviacich trasach sa v kontrolovanom obdobi nenasla cena."
        ]
        raise ProviderError("; ".join(errors))

    latest_available_month = max(available_months)
    later_checked_months = sorted(
        month_start
        for month_start, result in checked.items()
        if month_start > latest_available_month and result.state == "unavailable"
    )

    # Medzi poslednym dostupnym a prvym prazdnym hrubym bodom skontrolujeme
    # jednotlive mesiace. Pri predvolenom kroku su to najviac dva dalsie testy.
    first_empty_month = later_checked_months[0] if later_checked_months else None
    if first_empty_month is not None:
        cursor = add_months(latest_available_month, 1)
        while cursor < first_empty_month:
            result = probe_anchor_month(probe, origin_iata, anchors, cursor, today)
            checked[cursor] = result
            all_errors.extend(result.errors)
            if result.state == "available":
                latest_available_month = cursor
            cursor = add_months(cursor, 1)

    empty_months_after_horizon = sorted(
        month_start
        for month_start, result in checked.items()
        if month_start > latest_available_month and result.state == "unavailable"
    )
    first_empty_month = (
        empty_months_after_horizon[0] if empty_months_after_horizon else None
    )

    exact_dates, exact_errors = scan_all_routes_in_month(
        probe,
        origin_iata,
        destinations,
        latest_available_month,
        today,
    )
    all_errors.extend(exact_errors)
    if not exact_dates:
        raise ProviderError(
            "V poslednom odhadovanom mesiaci sa na ziadnej uspesne "
            "skontrolovanej trase nenasla cena."
        )

    search_limit_month = add_months(first_month, max_months)
    limit_reached = latest_available_month == search_limit_month
    status = "partial" if all_errors else (
        "search_limit_reached" if limit_reached else "ok"
    )
    return {
        "status": status,
        "last_bookable_date": max(exact_dates).isoformat(),
        "last_bookable_month": latest_available_month.strftime("%Y-%m"),
        "search_limit_month": search_limit_month.strftime("%Y-%m"),
        "search_limit_reached": limit_reached,
        "boundary_confirmed": first_empty_month is not None,
        "first_empty_anchor_month": (
            first_empty_month.strftime("%Y-%m") if first_empty_month else None
        ),
        "anchor_routes": [item.iata for item in anchors],
        "destinations_checked_in_final_month": len(destinations),
        "requests_made": probe.request_count,
        "verification": "all_known_bts_routes_in_final_month",
        "bookable_days_ahead": (max(exact_dates) - today).days,
        "errors": list(dict.fromkeys(all_errors)),
    }


def load_existing_output(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def cache_is_fresh(
    payload: dict[str, Any] | None,
    now: datetime,
    cache_hours: float,
) -> bool:
    if payload is None or cache_hours <= 0:
        return False
    try:
        checked_at = datetime.fromisoformat(str(payload["checked_at_utc"]))
    except (KeyError, TypeError, ValueError):
        return False
    if checked_at.tzinfo is None:
        checked_at = checked_at.replace(tzinfo=timezone.utc)
    return now - checked_at <= timedelta(hours=cache_hours)


def save_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    """Zapise JSON cez docasny subor, aby nikdy neostal iba napoly zapisany."""

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary_path, path)


def stale_result(
    previous: dict[str, Any] | None,
    attempted_at: datetime,
    error: str,
) -> dict[str, Any]:
    """Pri chybe ponecha posledny pouzitelny datum a oznaci ho ako stary."""

    result = dict(previous or {})
    result.update(
        {
            "status": "stale" if previous else "error",
            "last_attempt_at_utc": attempted_at.isoformat(),
            "latest_error": error,
        }
    )
    result.setdefault("last_bookable_date", None)
    result.setdefault("errors", [error])
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Setrne odhadne posledny rezervovatelny odlet Ryanair a Wizz Air "
            "z Bratislavy a ulozi vysledok do JSON."
        )
    )
    parser.add_argument("--max-months", type=positive_int, default=DEFAULT_MAX_MONTHS)
    parser.add_argument("--step-months", type=positive_int, default=DEFAULT_STEP_MONTHS)
    parser.add_argument(
        "--request-delay",
        type=non_negative_float,
        default=DEFAULT_REQUEST_DELAY_SECONDS,
        help="Minimalny odstup poziadaviek v sekundach (predvolene 1.0).",
    )
    parser.add_argument(
        "--cache-hours",
        type=non_negative_float,
        default=DEFAULT_CACHE_HOURS,
        help="Ako dlho nepytat API znova (predvolene 168 hodin).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ignoruje cerstvu cache a vykona novu kontrolu.",
    )
    parser.add_argument("--airlines-file", type=Path, default=DEFAULT_AIRLINES_FILE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_FILE)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    now = datetime.now(timezone.utc)
    existing = load_existing_output(args.output)
    if not args.force and cache_is_fresh(existing, now, args.cache_hours):
        print(
            f"Pouzivam cerstvu cache v {args.output.relative_to(PROJECT_DIR)}. "
            "Pre novu kontrolu pouzi --force.",
            flush=True,
        )
        return 0

    try:
        destinations_by_airline = load_destinations(args.airlines_file)
    except ProviderError as error:
        print(f"Chyba: {error}", file=sys.stderr, flush=True)
        return 1

    previous_airlines = (existing or {}).get("airlines") or {}
    results: dict[str, dict[str, Any]] = {}
    probe_classes = (RyanairHorizonProbe, WizzAirHorizonProbe)
    print(
        "Zistujem hranicu rezervovatelnych letov z Bratislavy (BTS).",
        flush=True,
    )
    print(
        f"Hrube body: kazde {args.step_months} mesiace, maximum "
        f"{args.max_months} mesiacov dopredu, odstup poziadaviek "
        f"{args.request_delay:.1f} s.",
        flush=True,
    )

    for probe_class in probe_classes:
        probe = probe_class(args.request_delay)
        airline_name = probe.airline_name
        print(f"\n=== {airline_name} ===", flush=True)
        try:
            result = find_airline_horizon(
                probe,
                destinations_by_airline.get(airline_name, []),
                now.date(),
                args.max_months,
                args.step_months,
            )
            result["checked_at_utc"] = now.isoformat()
            results[airline_name] = result
            qualifier = "najmene " if result["search_limit_reached"] else ""
            print(
                f"  Vysledok: {qualifier}do "
                f"{date.fromisoformat(result['last_bookable_date']).strftime('%d.%m.%Y')} "
                f"({result['requests_made']} poziadaviek).",
                flush=True,
            )
        except ProviderError as error:
            message = str(error)
            print(f"  Kontrola zlyhala: {message}", file=sys.stderr, flush=True)
            previous = previous_airlines.get(airline_name)
            results[airline_name] = stale_result(
                previous if isinstance(previous, dict) else None,
                now,
                message,
            )

    payload = {
        "schema_version": 1,
        "origin_iata": "BTS",
        "checked_at_utc": now.isoformat(),
        "max_search_months": args.max_months,
        "probe_step_months": args.step_months,
        "request_delay_seconds": args.request_delay,
        "cache_hours": args.cache_hours,
        "method": (
            "coarse_anchor_routes_then_all_known_routes_in_last_available_month"
        ),
        "airlines": results,
    }
    usable_dates = sorted(
        str(result["last_bookable_date"])
        for result in results.values()
        if result.get("last_bookable_date")
    )
    payload["earliest_airline_horizon_date"] = (
        usable_dates[0] if usable_dates else None
    )
    payload["latest_airline_horizon_date"] = (
        usable_dates[-1] if usable_dates else None
    )
    save_json_atomic(args.output, payload)
    print(f"\nJSON ulozeny do: {args.output.relative_to(PROJECT_DIR)}", flush=True)

    usable_results = sum(
        result.get("last_bookable_date") is not None for result in results.values()
    )
    return 0 if usable_results else 1


if __name__ == "__main__":
    raise SystemExit(main())
