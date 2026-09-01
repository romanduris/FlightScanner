"""Načítanie detailov odletov z oficiálneho letového poriadku BTS."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


REQUEST_TIMEOUT_SECONDS = 20
DAY_NAMES = ("Pon", "Uto", "Str", "Štv", "Pia", "Sob", "Ned")


class BtsScheduleError(RuntimeError):
    """Chyba pri načítaní alebo spracovaní letového poriadku BTS."""


@dataclass(frozen=True)
class ScheduledFlight:
    destination_iata: str
    valid_from: date
    valid_to: date
    operating_days: tuple[str, ...]
    departure_time: time
    arrival_time: time
    arrival_day_offset: int
    flight_number: str

    def operates_at(self, departure: datetime) -> bool:
        return (
            self.valid_from <= departure.date() <= self.valid_to
            and DAY_NAMES[departure.weekday()] in self.operating_days
            and self.departure_time == departure.time()
        )

    def arrival_datetime_for(self, departure: datetime) -> datetime:
        arrival_date = departure.date() + timedelta(days=self.arrival_day_offset)
        return datetime.combine(arrival_date, self.arrival_time)


class BtsScheduleParser(HTMLParser):
    """Parser riadkov tabuľky aktuálneho cestovného poriadku."""

    def __init__(self) -> None:
        super().__init__()
        self.flights: list[ScheduledFlight] = []
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
            self._cells.append(" ".join(" ".join(self._cell_parts).split()))
            self._in_cell = False
            self._cell_parts = []
        elif tag.lower() == "tr" and self._in_row:
            self._save_row()
            self._in_row = False
            self._cells = []

    def _save_row(self) -> None:
        if len(self._cells) < 10:
            return

        try:
            destination_iata = self._cells[2].upper()
            valid_from = datetime.strptime(self._cells[3], "%d. %m. %Y").date()
            valid_to = datetime.strptime(self._cells[4], "%d. %m. %Y").date()
            operating_days = tuple(self._cells[5].split())
            departure_time = datetime.strptime(self._cells[6], "%H:%M").time()
            arrival_parts = self._cells[7].split()
            arrival_time = datetime.strptime(arrival_parts[0], "%H:%M").time()
            arrival_day_offset = 1 if "(+1)" in arrival_parts else 0
            flight_number = self._cells[8].replace(" ", "").upper()
        except (ValueError, IndexError):
            return

        self.flights.append(
            ScheduledFlight(
                destination_iata=destination_iata,
                valid_from=valid_from,
                valid_to=valid_to,
                operating_days=operating_days,
                departure_time=departure_time,
                arrival_time=arrival_time,
                arrival_day_offset=arrival_day_offset,
                flight_number=flight_number,
            )
        )


def schedule_url_from_airlines_json(path: Path) -> str:
    """Získa URL aktuálneho poriadku uloženú prvým skriptom."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        schedule_url = str(payload.get("schedule_source_url") or "").strip()
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise BtsScheduleError(f"Nepodarilo sa načítať {path}: {error}") from error

    if not schedule_url:
        raise BtsScheduleError(f"V {path} chýba schedule_source_url.")
    return schedule_url


def load_bts_schedule(url: str) -> list[ScheduledFlight]:
    """Stiahne a spracuje aktuálny odletový poriadok BTS."""

    request = Request(
        url,
        headers={
            "User-Agent": "FlightScanner/1.0 (+personal flight search project)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "sk,en;q=0.8",
        },
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            encoding = response.headers.get_content_charset() or "utf-8"
            page = response.read().decode(encoding, errors="replace")
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        raise BtsScheduleError(f"Letový poriadok BTS sa nepodarilo stiahnuť: {error}") from error

    parser = BtsScheduleParser()
    parser.feed(page)
    if not parser.flights:
        raise BtsScheduleError("V letovom poriadku BTS sa nenašli žiadne lety.")
    return parser.flights


def find_scheduled_flight(
    schedule: list[ScheduledFlight],
    destination_iata: str,
    departure: datetime,
    carrier_prefixes: tuple[str, ...],
) -> ScheduledFlight | None:
    """Nájde let podľa destinácie, dátumu, miestneho času a prefixu dopravcu."""

    candidates = [
        flight
        for flight in schedule
        if flight.destination_iata == destination_iata
        and flight.flight_number.startswith(carrier_prefixes)
        and flight.operates_at(departure)
    ]
    return candidates[0] if candidates else None
