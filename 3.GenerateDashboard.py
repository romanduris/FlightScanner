#!/usr/bin/env python3
"""Pripraví najnovšie dáta skenera pre interaktívny HTML dashboard."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

from services.airport_data import get_airport_info


PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "Data"
HTML_DIR = PROJECT_DIR / "HTML"


def find_latest_data_file() -> Path:
    candidates = sorted(DATA_DIR.glob("destinations_[0-9][0-9][0-9][0-9]_[0-9][0-9].json"))
    if not candidates:
        raise FileNotFoundError(
            "V Data/ nie je destinations_YYYY_MM.json. Najprv spusti 2.Destination.py."
        )
    return candidates[-1]


def haversine_km(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> int:
    """Vypočíta vzdušnú vzdialenosť medzi dvoma letiskami."""

    radius_km = 6371.0
    lat_a, lat_b = math.radians(latitude_a), math.radians(latitude_b)
    delta_lat = math.radians(latitude_b - latitude_a)
    delta_lon = math.radians(longitude_b - longitude_a)
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    )
    return round(radius_km * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value)))


def enrich_payload(payload: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    origin_iata = str(payload.get("origin_iata") or "BTS").upper()
    origin = get_airport_info(origin_iata)
    if origin is None:
        raise ValueError(f"Chýbajú mapové údaje odletového letiska {origin_iata}.")

    unknown_airports: list[str] = []
    enriched_offers: list[dict[str, Any]] = []
    for raw_offer in payload.get("offers") or []:
        offer = dict(raw_offer)
        destination_iata = str(offer.get("destination_iata") or "").upper()
        destination = get_airport_info(destination_iata)
        if destination is None:
            unknown_airports.append(destination_iata or "?")
            offer.update(
                country="Neznáma krajina",
                country_code="",
                latitude=None,
                longitude=None,
                distance_km=None,
            )
        else:
            offer.update(
                country=destination.country,
                country_code=destination.country_code,
                latitude=destination.latitude,
                longitude=destination.longitude,
                distance_km=haversine_km(
                    origin.latitude,
                    origin.longitude,
                    destination.latitude,
                    destination.longitude,
                ),
            )

        duration = offer.get("duration_minutes")
        price = offer.get("price")
        offer["price_per_hour"] = (
            round(float(price) / (float(duration) / 60), 2)
            if price is not None and duration
            else None
        )
        enriched_offers.append(offer)

    enriched = dict(payload)
    enriched["offers"] = enriched_offers
    enriched["origin"] = {
        "iata": origin_iata,
        "name": "Bratislava",
        "country": origin.country,
        "latitude": origin.latitude,
        "longitude": origin.longitude,
    }
    return enriched, sorted(set(unknown_airports))


def save_javascript_data(payload: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    json_data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    # Zabraňuje ukončeniu script elementu, ak by sa taký text objavil v dátach.
    json_data = json_data.replace("</", "<\\/")
    output_path.write_text(
        "/* Automaticky generované – neupravovať ručne. */\n"
        f"window.FLIGHT_DATA = {json_data};\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Vygeneruje dáta pre HTML dashboard.")
    parser.add_argument(
        "--data",
        type=Path,
        help="Konkrétny destinations_YYYY_MM.json; predvolene najnovší súbor.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=HTML_DIR / "flight-data.js",
        help="Výstupný JavaScript súbor s dátami.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = args.data or find_latest_data_file()
    if not source.is_absolute():
        source = PROJECT_DIR / source
    output = args.output
    if not output.is_absolute():
        output = PROJECT_DIR / output

    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
        enriched, unknown_airports = enrich_payload(payload)
        save_javascript_data(enriched, output)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        print(f"Chyba: {error}", file=sys.stderr)
        return 1

    print(f"Dashboard dáta: {source.relative_to(PROJECT_DIR)}")
    print(f"Ponuky: {len(enriched.get('offers') or [])}")
    print(f"Výstup: {output.relative_to(PROJECT_DIR)}")
    if unknown_airports:
        print("Bez mapových údajov: " + ", ".join(unknown_airports))
    print("Otvor v prehliadači: HTML/index.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
