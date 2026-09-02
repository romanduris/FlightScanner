#!/usr/bin/env python3
"""Spustí všetkých registrovaných providerov a vypíše spoločný zoznam letov."""

from __future__ import annotations

import argparse
import json
import sys
import textwrap
from datetime import datetime, timezone
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
from providers.base import ProviderError


PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_AIRLINES_FILE = PROJECT_DIR / "Data" / "airlines.json"
PROVIDER_CLASSES = get_provider_classes()


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
    year: int,
    month: int,
    max_workers: int,
) -> tuple[
    list[FlightOffer],
    dict[str, list[RouteFailure]],
    dict[str, dict[str, int]],
]:
    """Spustí všetkých providerov a spojí ich výsledky."""

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

        print(
            f"Skenujem {provider.airline_name}: "
            f"{len(destinations)} destinácií...",
            flush=True,
        )
        offers, failures = provider.scan_month(
            origin_iata="BTS",
            destinations=destinations,
            year=year,
            month=month,
        )
        all_offers.extend(offers)
        failures_by_airline[provider.airline_name] = failures
        summary[provider.airline_name] = {
            "destinations": len(destinations),
            "offers": len(offers),
            "return_offers": sum(len(offer.return_offers) for offer in offers),
            "failures": len(failures),
        }

    all_offers.sort(key=lambda item: (item.airline.casefold(), item.destination_name))
    return all_offers, failures_by_airline, summary


def save_results(
    path: Path,
    year: int,
    month: int,
    offers: list[FlightOffer],
    failures_by_airline: dict[str, list[RouteFailure]],
    summary: dict[str, dict[str, int]],
    scanned_at: datetime,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "origin_iata": "BTS",
        "year": year,
        "month": month,
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
    year: int,
    month: int,
    offers: list[FlightOffer],
    failures_by_airline: dict[str, list[RouteFailure]],
    summary: dict[str, dict[str, int]],
    output_file: Path,
    scanned_at: datetime,
) -> None:
    print()
    print(f"Všetky dostupné ponuky z Bratislavy (BTS) – {month:02d}/{year}")
    print("Najnižšia jednosmerná základná cena pre každú destináciu.")
    print("Dni a časy odletov platia pre zvolený mesiac; časy sú miestne.")
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
    current_year = datetime.now(timezone.utc).year
    parser = argparse.ArgumentParser(
        description="Spustí všetkých providerov a spojí ich ponuky."
    )
    parser.add_argument("--year", type=int, default=current_year)
    parser.add_argument("--month", type=int, choices=range(1, 13), default=9)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--airlines-file", type=Path, default=DEFAULT_AIRLINES_FILE)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        destinations_by_airline = load_destinations_by_airline(args.airlines_file)
        offers, failures_by_airline, summary = scan_all_providers(
            destinations_by_airline,
            args.year,
            args.month,
            args.workers,
        )
    except ProviderError as error:
        print(f"Chyba: {error}", file=sys.stderr)
        return 1

    scanned_at = datetime.now(timezone.utc)
    output_file = (
        PROJECT_DIR
        / "Data"
        / f"destinations_{args.year:04d}_{args.month:02d}.json"
    )
    save_results(
        output_file,
        args.year,
        args.month,
        offers,
        failures_by_airline,
        summary,
        scanned_at,
    )
    print_results(
        args.year,
        args.month,
        offers,
        failures_by_airline,
        summary,
        output_file,
        scanned_at,
    )
    return 0 if offers else 1


if __name__ == "__main__":
    raise SystemExit(main())
