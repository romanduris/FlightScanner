"""Spoločné dátové modely a HTTP klient pre všetkých leteckých providerov."""

from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


WEEKDAY_LABELS = ("Pon", "Uto", "Str", "Štv", "Pia", "Sob", "Ned")
RETURN_WINDOW_DAYS = 10


@dataclass(frozen=True)
class Destination:
    """Destinácia dostupná z vybraného letiska."""

    name: str
    iata: str


@dataclass(frozen=True)
class OutboundOffer:
    """Konkrétny cenový odlet v rámci skenovaného mesiaca."""

    departure_local: str
    arrival_local: str
    price: float
    currency: str
    flight_number: str | None = None
    duration_minutes: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ReturnOffer:
    """Cenová možnosť návratu do pôvodného letiska."""

    airline: str
    origin_iata: str
    destination_iata: str
    departure_local: str
    arrival_local: str | None
    price: float
    currency: str
    flight_number: str | None = None
    duration_minutes: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class FlightOffer:
    """Najlacnejší nájdený let pre jednu destináciu a jeho možné návraty."""

    airline: str
    origin_iata: str
    destination_name: str
    destination_iata: str
    flight_number: str | None
    departure_local: str
    arrival_local: str
    price: float
    currency: str
    fare_type: str = "basic_one_way"
    operating_schedule: tuple[str, ...] = ()
    duration_minutes: int | None = None
    outbound_offers: tuple[OutboundOffer, ...] = ()
    return_offers: tuple[ReturnOffer, ...] = ()
    return_search_error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class RouteFailure:
    """Trasa, pre ktorú sa nepodarilo nájsť použiteľnú cenu."""

    destination_name: str
    destination_iata: str
    reason: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


class ProviderError(RuntimeError):
    """Chyba komunikácie s poskytovateľom letov."""


class JsonHttpClient:
    """Malý JSON HTTP klient s timeoutom a opakovaním dočasných chýb."""

    def __init__(self, timeout_seconds: int = 20, retries: int = 2) -> None:
        self.timeout_seconds = timeout_seconds
        self.retries = retries

    def get_json(self, url: str) -> dict[str, Any]:
        request = Request(
            url,
            headers={
                "User-Agent": "FlightScanner/1.0 (+personal flight search project)",
                "Accept": "application/json",
                "Accept-Language": "sk,en;q=0.8",
            },
        )

        return self._send_json(request)

    def post_json(
        self,
        url: str,
        payload: dict[str, Any],
        extra_headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Odošle JSON cez POST a vráti JSON odpoveď."""

        headers = {
            "User-Agent": "FlightScanner/1.0 (+personal flight search project)",
            "Accept": "application/json",
            "Accept-Language": "sk,en;q=0.8",
            "Content-Type": "application/json",
        }
        if extra_headers:
            headers.update(extra_headers)

        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        return self._send_json(request)

    def _send_json(self, request: Request) -> dict[str, Any]:
        """Vykoná pripravenú požiadavku s opakovaním dočasných chýb."""

        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    encoding = response.headers.get_content_charset() or "utf-8"
                    payload = json.loads(
                        response.read().decode(encoding, errors="strict")
                    )
                if not isinstance(payload, dict):
                    raise ProviderError("Server nevrátil očakávaný JSON objekt.")
                return payload
            except HTTPError as error:
                try:
                    error_detail = error.read().decode("utf-8", errors="replace").strip()
                except OSError:
                    error_detail = ""
                message = f"HTTP {error.code}"
                if error_detail:
                    message += f": {error_detail}"
                last_error = ProviderError(message)
                if error.code not in {429, 500, 502, 503, 504}:
                    break
            except (URLError, TimeoutError, OSError, UnicodeError, json.JSONDecodeError) as error:
                last_error = error

            if attempt < self.retries:
                time.sleep(1.5 * (attempt + 1))

        raise ProviderError(f"HTTP požiadavka zlyhala: {last_error}") from last_error


class BaseAirlineProvider(ABC):
    """Spoločné rozhranie, ktoré neskôr použije aj Wizz Air provider."""

    airline_name: str

    @abstractmethod
    def scan_month(
        self,
        origin_iata: str,
        destinations: list[Destination],
        year: int,
        month: int,
    ) -> tuple[list[FlightOffer], list[RouteFailure]]:
        """Nájde najlacnejší jednosmerný let mesiaca pre každú destináciu."""


def parse_local_datetime(value: str) -> datetime:
    """Prevedie lokálny čas aerolinky vo formáte ISO na datetime bez časovej zóny."""

    try:
        return datetime.fromisoformat(value)
    except ValueError as error:
        raise ProviderError(f"Neplatný dátum alebo čas od providera: {value}") from error


def build_weekly_schedule(departures: list[datetime]) -> tuple[str, ...]:
    """Zoskupí odlety mesiaca do unikátnych kombinácií dňa a času."""

    times_by_weekday: dict[int, set[str]] = {}
    for departure in departures:
        times_by_weekday.setdefault(departure.weekday(), set()).add(
            departure.strftime("%H:%M")
        )

    return tuple(
        f"{WEEKDAY_LABELS[weekday]} {departure_time}"
        for weekday in range(7)
        for departure_time in sorted(times_by_weekday.get(weekday, set()))
    )
