#!/usr/bin/env python3
"""Spustí všetkých registrovaných providerov a vypíše spoločný zoznam letov."""

from __future__ import annotations

import argparse
import json
import sys
import textwrap
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from providers import (
    BaseAirlineProvider,
    Destination,
    FlightOffer,
    RETURN_WINDOW_DAYS,
    RouteFailure,
    get_provider_classes,
)
from providers.base import ProviderError, build_weekly_schedule, parse_local_datetime


PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_AIRLINES_FILE = PROJECT_DIR / "Data" / "airlines.json"
PROVIDER_CLASSES = get_provider_classes()


def positive_int(value: str) -> int:
    """Argparse typ pre kladný počet dní alebo workerov."""

    try:
        number = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("hodnota musí byť celé číslo") from error
    if number < 1:
        raise argparse.ArgumentTypeError("hodnota musí byť aspoň 1")
    return number


def months_in_range(start_date: date, end_date: date) -> list[tuple[int, int]]:
    """Vráti všetky kalendárne mesiace, ktorých sa interval dotýka."""

    months: list[tuple[int, int]] = []
    cursor = start_date.replace(day=1)
    while cursor <= end_date:
        months.append((cursor.year, cursor.month))
        cursor = (
            date(cursor.year + 1, 1, 1)
            if cursor.month == 12
            else date(cursor.year, cursor.month + 1, 1)
        )
    return months


def merge_offers_for_range(
    offers: list[FlightOffer], start_date: date, end_date: date
) -> list[FlightOffer]:
    """Spojí mesačné výsledky a ponechá iba odlety v presnom intervale."""

    grouped: dict[tuple[str, str], list[FlightOffer]] = {}
    for offer in offers:
        grouped.setdefault(
            (offer.airline.casefold(), offer.destination_iata.upper()), []
        ).append(offer)

    merged: list[FlightOffer] = []
    return_end_date = end_date + timedelta(days=RETURN_WINDOW_DAYS)
    for route_offers in grouped.values():
        template = route_offers[0]
        outbound_by_value = {
            item: item
            for offer in route_offers
            for item in offer.outbound_offers
            if start_date
            <= parse_local_datetime(item.departure_local).date()
            <= end_date
        }
        outbound_offers = tuple(
            sorted(outbound_by_value.values(), key=lambda item: item.departure_local)
        )
        if not outbound_offers:
            continue

        return_by_value = {
            item: item
            for offer in route_offers
            for item in offer.return_offers
            if start_date + timedelta(days=1)
            <= parse_local_datetime(item.departure_local).date()
            <= return_end_date
        }
        return_offers = tuple(
            sorted(return_by_value.values(), key=lambda item: item.departure_local)
        )
        cheapest = min(
            outbound_offers,
            key=lambda item: (item.price, item.departure_local),
        )
        return_errors = [
            offer.return_search_error
            for offer in route_offers
            if offer.return_search_error
        ]
        merged.append(
            replace(
                template,
                flight_number=cheapest.flight_number,
                departure_local=cheapest.departure_local,
                arrival_local=cheapest.arrival_local,
                price=cheapest.price,
                currency=cheapest.currency,
                duration_minutes=cheapest.duration_minutes,
                operating_schedule=build_weekly_schedule(
                    [
                        parse_local_datetime(item.departure_local)
                        for item in outbound_offers
                    ]
                ),
                outbound_offers=outbound_offers,
                return_offers=return_offers,
                return_search_error="; ".join(dict.fromkeys(return_errors)) or None,
            )
        )

    merged.sort(key=lambda item: (item.airline.casefold(), item.destination_name))
    return merged


def load_destinations_by_airline(path: Path) -> dict[str, list[Destination]]:
    """Načíta destinácie jednotlivých aeroliniek vytvorené prvým skriptom."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ProviderError(
            f"Chýba {path}. Najprv spusti: python3 1.ListOfAirlines.py"
        ) from error
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ProviderError(f"Súbor {path} sa nepodarilo načítať: {error}") from error

    destinations_by_airline: dict[str, list[Destination]] = {}
    for airline in payload.get("airlines") or []:
        airline_name = str(airline.get("name") or "").strip()
        if not airline_name:
            continue

        destinations = [
            Destination(
                name=str(item["name"]),
                iata=str(item["iata"]).upper(),
            )
            for item in airline.get("destinations") or []
            if item.get("name") and item.get("iata")
        ]
        destinations_by_airline[airline_name.casefold()] = destinations

    return destinations_by_airline


def create_provider(
    provider_class: type[BaseAirlineProvider], max_workers: int
) -> BaseAirlineProvider:
    """Vytvorí providera so spoločným nastavením počtu paralelných požiadaviek."""

    try:
        return provider_class(max_workers=max_workers)  # type: ignore[call-arg]
    except TypeError as error:
        raise ProviderError(
            f"Provider {provider_class.__name__} nepodporuje spoločné nastavenie."
        ) from error


def scan_all_providers(
    destinations_by_airline: dict[str, list[Destination]],
    start_date: date,
    end_date: date,
    max_workers: int,
) -> tuple[
    list[FlightOffer],
    dict[str, list[RouteFailure]],
    dict[str, dict[str, int]],
]:
    """Spustí providerov cez všetky mesiace zvoleného intervalu."""

    all_offers: list[FlightOffer] = []
    failures_by_airline: dict[str, list[RouteFailure]] = {}
    summary: dict[str, dict[str, int]] = {}

    for provider_class in PROVIDER_CLASSES:
        provider = create_provider(provider_class, max_workers)
        destinations = destinations_by_airline.get(
            provider.airline_name.casefold(), []
        )

        if not destinations:
            failures_by_airline[provider.airline_name] = [
                RouteFailure(
                    destination_name="—",
                    destination_iata="—",
                    reason="V Data/airlines.json nie sú destinácie tejto aerolinky.",
                )
            ]
            summary[provider.airline_name] = {
                "destinations": 0,
                "offers": 0,
                "return_offers": 0,
                "failures": 1,
            }
            continue

        provider_offers: list[FlightOffer] = []
        provider_failures: list[RouteFailure] = []
        months = months_in_range(start_date, end_date)
        print(
            f"Skenujem {provider.airline_name}: {len(destinations)} destinácií, "
            f"{start_date.strftime('%d.%m.%Y')} – {end_date.strftime('%d.%m.%Y')}...",
            flush=True,
        )
        for year, month in months:
            print(f"  Mesiac {month:02d}/{year}", flush=True)
            offers, failures = provider.scan_month(
                origin_iata="BTS",
                destinations=destinations,
                year=year,
                month=month,
            )
            provider_offers.extend(offers)
            provider_failures.extend(failures)

        merged_offers = merge_offers_for_range(
            provider_offers, start_date, end_date
        )
        successful_destinations = {
            offer.destination_iata for offer in merged_offers
        }
        failures_by_destination: dict[str, RouteFailure] = {}
        for failure in provider_failures:
            if failure.destination_iata not in successful_destinations:
                failures_by_destination.setdefault(
                    failure.destination_iata, failure
                )
        for destination in destinations:
            if (
                destination.iata not in successful_destinations
                and destination.iata not in failures_by_destination
            ):
                failures_by_destination[destination.iata] = RouteFailure(
                    destination.name,
                    destination.iata,
                    "Vo zvolenom intervale nie je dostupná cena.",
                )
        final_failures = sorted(
            failures_by_destination.values(),
            key=lambda item: item.destination_name,
        )

        all_offers.extend(merged_offers)
        failures_by_airline[provider.airline_name] = final_failures
        summary[provider.airline_name] = {
            "destinations": len(destinations),
            "offers": len(merged_offers),
            "return_offers": sum(
                len(offer.return_offers) for offer in merged_offers
            ),
            "failures": len(final_failures),
        }

    all_offers.sort(key=lambda item: (item.airline.casefold(), item.destination_name))
    return all_offers, failures_by_airline, summary


def save_results(
    path: Path,
    start_date: date,
    end_date: date,
    offers: list[FlightOffer],
    failures_by_airline: dict[str, list[RouteFailure]],
    summary: dict[str, dict[str, int]],
    scanned_at: datetime,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "origin_iata": "BTS",
        "year": start_date.year,
        "month": start_date.month,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "scan_days": (end_date - start_date).days + 1,
        "trip_type": "one_way",
        "fare_type": "basic",
        "return_window_days": RETURN_WINDOW_DAYS,
        "times_are_local": True,
        "scanned_at_utc": scanned_at.isoformat(),
        "providers": [provider.__name__ for provider in PROVIDER_CLASSES],
        "summary": summary,
        "offer_count": len(offers),
        "return_offer_count": sum(len(offer.return_offers) for offer in offers),
        "offers": [offer.to_dict() for offer in offers],
        "failures": {
            airline: [failure.to_dict() for failure in failures]
            for airline, failures in failures_by_airline.items()
        },
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def format_duration(duration_minutes: int | None) -> str:
    if duration_minutes is None:
        return "—"
    hours, minutes = divmod(duration_minutes, 60)
    return f"{hours} h {minutes:02d} min"


def print_results(
    start_date: date,
    end_date: date,
    offers: list[FlightOffer],
    failures_by_airline: dict[str, list[RouteFailure]],
    summary: dict[str, dict[str, int]],
    output_file: Path,
    scanned_at: datetime,
) -> None:
    print()
    print(
        "Všetky dostupné ponuky z Bratislavy (BTS) – "
        f"{start_date.strftime('%d.%m.%Y')} až {end_date.strftime('%d.%m.%Y')}"
    )
    print("Najnižšia jednosmerná základná cena pre každú destináciu.")
    print("Dni a časy odletov platia pre zvolený interval; časy sú miestne.")
    print("=" * 108)
    print(
        f"{'Aerolinka':<12} {'Destinácia':<40} {'Let':<8} "
        f"{'Dĺžka letu':<13} {'Najnižšia cena':>17}"
    )
    print("-" * 108)

    for offer in offers:
        destination = f"{offer.destination_name} ({offer.destination_iata})"
        flight_number = offer.flight_number or "—"
        price = f"{offer.price:.2f} {offer.currency}".replace(".", ",")
        print(
            f"{offer.airline[:11]:<12} {destination[:39]:<40} "
            f"{flight_number:<8} {format_duration(offer.duration_minutes):<13} "
            f"{price:>17}"
        )
        schedule = " | ".join(offer.operating_schedule) or "údaj nie je dostupný"
        schedule_lines = textwrap.wrap(
            schedule,
            width=88,
            break_long_words=False,
            break_on_hyphens=False,
        )
        for line_number, line in enumerate(schedule_lines):
            label = "Dni/časy odletov: " if line_number == 0 else " " * 19
            print(f"{'':<12}{label}{line}")

    failed_count = sum(len(items) for items in failures_by_airline.values())
    if failed_count:
        print("\nTrasy bez ceny alebo s chybou:")
        for airline, failures in failures_by_airline.items():
            for failure in failures:
                print(
                    f"  - {airline}: {failure.destination_name} "
                    f"({failure.destination_iata}) – {failure.reason}"
                )

    print("\nSúhrn providerov:")
    for airline, values in summary.items():
        print(
            f"  - {airline}: {values['offers']}/{values['destinations']} "
            f"ponúk, návraty: {values['return_offers']}, "
            f"chyby alebo bez ceny: {values['failures']}"
        )

    if offers:
        lowest_price = min(offer.price for offer in offers)
        cheapest_offers = [offer for offer in offers if offer.price == lowest_price]
        cheapest_names = ", ".join(
            f"{offer.airline} – {offer.destination_name} ({offer.destination_iata})"
            for offer in cheapest_offers
        )
        print(
            f"\nNajnižšia nájdená cena: {lowest_price:.2f} EUR – "
            f"{cheapest_names}"
        )

    return_offer_count = sum(len(offer.return_offers) for offer in offers)
    print(
        f"Spolu ponúk: {len(offers)}, spiatočných možností: "
        f"{return_offer_count}, chyby alebo bez ceny: {failed_count}"
    )
    print(f"Sken vykonaný: {scanned_at.strftime('%d.%m.%Y %H:%M:%S')} UTC")
    print(f"JSON uložený do: {output_file.relative_to(PROJECT_DIR)}")
    print("Ceny sú dynamické a pri rezervácii sa môžu zmeniť.")


def parse_args() -> argparse.Namespace:
    today = datetime.now(timezone.utc).date()
    parser = argparse.ArgumentParser(
        description="Spustí všetkých providerov a spojí ich ponuky."
    )
    parser.add_argument("--year", type=int, default=today.year)
    parser.add_argument(
        "--month", type=int, choices=range(1, 13), default=today.month
    )
    parser.add_argument(
        "--days",
        type=positive_int,
        help="Počet dní od dneška; ak sa neuvedie, skenuje sa zvolený mesiac.",
    )
    parser.add_argument("--workers", type=positive_int, default=4)
    parser.add_argument("--airlines-file", type=Path, default=DEFAULT_AIRLINES_FILE)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.days is not None:
        start_date = datetime.now(timezone.utc).date()
        end_date = start_date + timedelta(days=args.days - 1)
    else:
        start_date = date(args.year, args.month, 1)
        end_date = (
            date(args.year + 1, 1, 1)
            if args.month == 12
            else date(args.year, args.month + 1, 1)
        ) - timedelta(days=1)
    try:
        destinations_by_airline = load_destinations_by_airline(args.airlines_file)
        offers, failures_by_airline, summary = scan_all_providers(
            destinations_by_airline,
            start_date,
            end_date,
            args.workers,
        )
    except ProviderError as error:
        print(f"Chyba: {error}", file=sys.stderr)
        return 1

    scanned_at = datetime.now(timezone.utc)
    output_file = (
        PROJECT_DIR
        / "Data"
        / f"destinations_{start_date.year:04d}_{start_date.month:02d}.json"
    )
    save_results(
        output_file,
        start_date,
        end_date,
        offers,
        failures_by_airline,
        summary,
        scanned_at,
    )
    print_results(
        start_date,
        end_date,
        offers,
        failures_by_airline,
        summary,
        output_file,
        scanned_at,
    )
    return 0 if offers else 1


if __name__ == "__main__":
    raise SystemExit(main())
