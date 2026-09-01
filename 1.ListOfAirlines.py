#!/usr/bin/env python3
"""Načíta a vypíše letecké spoločnosti pôsobiace na letisku Bratislava."""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


SOURCE_URL = "https://www.bts.aero/lety/letecke-spolocnosti/"
DEFAULT_SCHEDULE_URL = (
    "https://www.bts.aero/lety/letovy-poriadok-leto-2026/odlety/"
)
REQUEST_TIMEOUT_SECONDS = 15
PROJECT_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = PROJECT_DIR / "Data" / "airlines.json"

SCHEDULED = "pravidelné lety"
NON_SCHEDULED = "nepravidelné lety"

# Prefix čísla letu podľa IATA. W6 a W4 patria pod značku Wizz Air,
# QS a 6D pod značku Smartwings.
AIRLINE_BY_PREFIX = {
    "FR": "RYANAIR",
    "W6": "Wizz Air",
    "W4": "Wizz Air",
    "PC": "Pegasus Airlines",
    "SM": "Air Cairo",
    "4O": "Air Montenegro",
    "QS": "SMARTWINGS",
    "6D": "SMARTWINGS",
    "XQ": "SunExpress Airlines",
}


@dataclass(frozen=True)
class Destination:
    """Jedna destinácia v aktuálnom letovom poriadku."""

    name: str
    iata: str


@dataclass(frozen=True)
class Airline:
    """Jedna letecká spoločnosť a typ jej letov z Bratislavy."""

    name: str
    flight_type: str
    destinations: tuple[Destination, ...] = ()


# Záložný zoznam podľa oficiálnej stránky Letiska Bratislava, overený 1. 9. 2026.
# Použije sa iba vtedy, keď web letiska zablokuje alebo preruší požiadavku.
FALLBACK_AIRLINES = (
    Airline("RYANAIR", SCHEDULED),
    Airline("Wizz Air", SCHEDULED),
    Airline("Pegasus Airlines", SCHEDULED),
    Airline("Air Cairo", SCHEDULED),
    Airline("Air Montenegro", SCHEDULED),
    Airline("SMARTWINGS", SCHEDULED),
    Airline("SunExpress Airlines", SCHEDULED),
    Airline("AirExplore", NON_SCHEDULED),
    Airline("ABS Jets", NON_SCHEDULED),
    Airline("AIR - TRANSPORT EUROPE", NON_SCHEDULED),
    Airline("EHC service", NON_SCHEDULED),
    Airline("Elite Jet", NON_SCHEDULED),
    Airline("Go2Sky", NON_SCHEDULED),
    Airline("JetAge", NON_SCHEDULED),
    Airline("Tatra Jet", NON_SCHEDULED),
    Airline("SEAGLE SK.ATO.02", NON_SCHEDULED),
)


class AirlinesParser(HTMLParser):
    """Vyberie názvy aeroliniek zo sekcií pravidelných a nepravidelných letov."""

    def __init__(self) -> None:
        super().__init__()
        self.airlines: list[Airline] = []
        self.schedule_url: str | None = None
        self._heading_level: str | None = None
        self._heading_parts: list[str] = []
        self._flight_type: str | None = None
        self._finished = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            href = dict(attrs).get("href") or ""
            if "letovy-poriadok" in href and self.schedule_url is None:
                schedule_base_url = urljoin(SOURCE_URL, href)
                self.schedule_url = schedule_base_url.rstrip("/") + "/odlety/"

        if tag.lower() in {"h1", "h2"}:
            self._heading_level = tag.lower()
            self._heading_parts = []

    def handle_data(self, data: str) -> None:
        if self._heading_level is not None:
            self._heading_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._heading_level != tag.lower():
            return

        heading = " ".join("".join(self._heading_parts).split())
        self._heading_level = None
        self._heading_parts = []

        if tag.lower() != "h2" or not heading:
            return

        normalized_heading = heading.casefold()
        if normalized_heading == SCHEDULED.casefold():
            self._flight_type = SCHEDULED
        elif normalized_heading == NON_SCHEDULED.casefold():
            self._flight_type = NON_SCHEDULED
        elif normalized_heading.startswith("ďalšie stránky"):
            self._flight_type = None
            self._finished = True
        elif self._flight_type is not None and not self._finished:
            self.airlines.append(Airline(heading, self._flight_type))


class ScheduleParser(HTMLParser):
    """Vyberie destináciu, IATA kód a číslo letu z tabuľky odletov."""

    def __init__(self) -> None:
        super().__init__()
        self.routes: list[tuple[str, Destination]] = []
        self._in_row = False
        self._in_cell = False
        self._cell_parts: list[str] = []
        self._cells: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = (dict(attrs).get("class") or "").split()
        if tag.lower() == "tr" and "flights-schedule-row" in classes:
            self._in_row = True
            self._cells = []
        elif tag.lower() == "td" and self._in_row:
            self._in_cell = True
            self._cell_parts = []

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "td" and self._in_cell:
            value = " ".join("".join(self._cell_parts).split())
            self._cells.append(value)
            self._in_cell = False
            self._cell_parts = []
        elif tag.lower() == "tr" and self._in_row:
            self._save_row()
            self._in_row = False
            self._cells = []

    def _save_row(self) -> None:
        if len(self._cells) < 9:
            return

        destination_name = self._cells[1]
        destination_iata = self._cells[2]
        flight_number = self._cells[8].upper()
        prefix_match = re.match(r"([A-Z0-9]{2})\s*\d+", flight_number)

        if destination_name and destination_iata and prefix_match:
            self.routes.append(
                (
                    prefix_match.group(1),
                    Destination(destination_name, destination_iata),
                )
            )


def download_page(url: str) -> str:
    """Stiahne HTML stránku s hlavičkami vhodnými pre osobný skener."""

    request = Request(
        url,
        headers={
            "User-Agent": "FlightScanner/1.0 (+personal flight search project)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "sk,en;q=0.8",
        },
    )
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        encoding = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(encoding, errors="replace")


def fetch_airlines() -> tuple[list[Airline], str]:
    """Stiahne aktuálny zoznam z oficiálnej stránky letiska."""

    parser = AirlinesParser()
    parser.feed(download_page(SOURCE_URL))

    if not parser.airlines:
        raise ValueError("Na stránke sa nepodarilo nájsť žiadne letecké spoločnosti.")

    # Odstránenie prípadných duplicít pri zachovaní poradia z oficiálnej stránky.
    unique_airlines: list[Airline] = []
    seen: set[tuple[str, str]] = set()
    for airline in parser.airlines:
        key = (airline.name.casefold(), airline.flight_type)
        if key not in seen:
            unique_airlines.append(airline)
            seen.add(key)

    return unique_airlines, parser.schedule_url or DEFAULT_SCHEDULE_URL


def load_airlines() -> tuple[list[Airline], str, str]:
    """Vráti online zoznam alebo lokálny záložný zoznam."""

    try:
        airlines, schedule_url = fetch_airlines()
        return airlines, "official_web", schedule_url
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeError, ValueError) as error:
        print(
            "Upozornenie: oficiálnu stránku sa nepodarilo načítať "
            f"({error}). Používam záložný zoznam overený 1. 9. 2026.\n",
            file=sys.stderr,
        )
        return list(FALLBACK_AIRLINES), "built_in_fallback", DEFAULT_SCHEDULE_URL


def fetch_destinations(
    schedule_url: str,
) -> tuple[dict[str, tuple[Destination, ...]], list[str]]:
    """Spočíta unikátne destinácie aeroliniek z aktuálneho letového poriadku."""

    parser = ScheduleParser()
    parser.feed(download_page(schedule_url))
    if not parser.routes:
        raise ValueError("V letovom poriadku sa nepodarilo nájsť žiadne odlety.")

    destinations_by_airline: dict[str, set[Destination]] = {}
    unknown_prefixes: set[str] = set()
    for prefix, destination in parser.routes:
        airline_name = AIRLINE_BY_PREFIX.get(prefix)
        if airline_name is None:
            unknown_prefixes.add(prefix)
            continue
        destinations_by_airline.setdefault(airline_name, set()).add(destination)

    sorted_destinations = {
        airline_name: tuple(sorted(destinations, key=lambda item: item.name))
        for airline_name, destinations in destinations_by_airline.items()
    }
    return sorted_destinations, sorted(unknown_prefixes)


def load_destinations(
    schedule_url: str,
) -> tuple[dict[str, tuple[Destination, ...]], str, list[str]]:
    """Vráti destinácie z cestovného poriadku alebo označí údaje ako nedostupné."""

    try:
        destinations, unknown_prefixes = fetch_destinations(schedule_url)
        if unknown_prefixes:
            print(
                "Upozornenie: neznáme prefixy letov v cestovnom poriadku: "
                + ", ".join(unknown_prefixes),
                file=sys.stderr,
            )
        return destinations, "official_schedule", unknown_prefixes
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeError, ValueError) as error:
        print(
            "Upozornenie: letový poriadok sa nepodarilo načítať "
            f"({error}). Počty destinácií nie sú dostupné.\n",
            file=sys.stderr,
        )
        return {}, "unavailable", []


def add_destinations(
    airlines: list[Airline],
    destinations_by_airline: dict[str, tuple[Destination, ...]],
) -> list[Airline]:
    """Priradí pravidelným aerolinkám ich unikátne destinácie."""

    return [
        Airline(
            name=airline.name,
            flight_type=airline.flight_type,
            destinations=destinations_by_airline.get(airline.name, ()),
        )
        for airline in airlines
    ]


def save_to_json(
    airlines: list[Airline],
    data_origin: str,
    schedule_url: str,
    schedule_data_origin: str,
    unknown_prefixes: list[str],
) -> None:
    """Uloží zoznam do Data/airlines.json pre ďalšie skripty projektu."""

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "airport": {
            "name": "Letisko M. R. Štefánika – Airport Bratislava",
            "iata": "BTS",
        },
        "source_url": SOURCE_URL,
        "data_origin": data_origin,
        "schedule_source_url": schedule_url,
        "schedule_data_origin": schedule_data_origin,
        "unmapped_flight_prefixes": unknown_prefixes,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "airline_count": len(airlines),
        "airlines": [
            {
                "name": airline.name,
                "flight_type": airline.flight_type,
                "destination_count": (
                    len(airline.destinations)
                    if airline.flight_type == SCHEDULED
                    and schedule_data_origin == "official_schedule"
                    else None
                ),
                "destinations": [
                    asdict(destination) for destination in airline.destinations
                ],
            }
            for airline in airlines
        ],
    }
    OUTPUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def destination_label(count: int) -> str:
    """Vráti správny slovenský tvar slova destinácia."""

    if count == 1:
        return "destinácia"
    if 2 <= count <= 4:
        return "destinácie"
    return "destinácií"


def print_airlines(airlines: list[Airline], destination_data_available: bool) -> None:
    """Vypíše prehľadný zoznam do terminálu."""

    print("Letecké spoločnosti na letisku Bratislava (BTS)")
    print("=" * 49)

    for flight_type in (SCHEDULED, NON_SCHEDULED):
        matching = [airline for airline in airlines if airline.flight_type == flight_type]
        print(f"\n{flight_type.capitalize()} ({len(matching)}):")
        for number, airline in enumerate(matching, start=1):
            if flight_type == SCHEDULED and destination_data_available:
                count = len(airline.destinations)
                print(
                    f"  {number:>2}. {airline.name:<24} "
                    f"{count:>2} {destination_label(count)}"
                )
            elif flight_type == SCHEDULED:
                print(f"  {number:>2}. {airline.name:<24} údaj nie je dostupný")
            else:
                print(f"  {number:>2}. {airline.name}")

    print(f"\nSpolu: {len(airlines)} leteckých spoločností")
    print(f"JSON uložený do: {OUTPUT_FILE.relative_to(PROJECT_DIR)}")


def main() -> int:
    airlines, data_origin, schedule_url = load_airlines()
    destinations, schedule_data_origin, unknown_prefixes = load_destinations(
        schedule_url
    )
    airlines = add_destinations(airlines, destinations)
    save_to_json(
        airlines,
        data_origin,
        schedule_url,
        schedule_data_origin,
        unknown_prefixes,
    )
    print_airlines(
        airlines,
        destination_data_available=schedule_data_origin == "official_schedule",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
