"""Výpočet reálnej dĺžky letu z miestnych časov letísk."""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


# Časové pásma letísk používaných aktuálnymi trasami BTS.
# Neznáme budúce letisko vráti None a nezastaví celý skener.
AIRPORT_TIMEZONES = {
    "BTS": "Europe/Bratislava",
    "ACE": "Atlantic/Canary",
    "AGP": "Europe/Madrid",
    "AHO": "Europe/Rome",
    "ALC": "Europe/Madrid",
    "ATH": "Europe/Athens",
    "BCN": "Europe/Madrid",
    "BER": "Europe/Berlin",
    "BOJ": "Europe/Sofia",
    "BRI": "Europe/Rome",
    "BSL": "Europe/Zurich",
    "CFU": "Europe/Athens",
    "CIA": "Europe/Rome",
    "CRL": "Europe/Brussels",
    "DLM": "Europe/Istanbul",
    "DTM": "Europe/Berlin",
    "DUB": "Europe/Dublin",
    "EDI": "Europe/London",
    "EIN": "Europe/Amsterdam",
    "EVN": "Asia/Yerevan",
    "FCO": "Europe/Rome",
    "GDN": "Europe/Warsaw",
    "JMK": "Europe/Athens",
    "JSI": "Europe/Athens",
    "KSC": "Europe/Bratislava",
    "KUT": "Asia/Tbilisi",
    "LBA": "Europe/London",
    "LCA": "Asia/Nicosia",
    "LTN": "Europe/London",
    "MAN": "Europe/London",
    "MLA": "Europe/Malta",
    "MXP": "Europe/Rome",
    "NAP": "Europe/Rome",
    "NCE": "Europe/Paris",
    "OHD": "Europe/Skopje",
    "OSL": "Europe/Oslo",
    "PDV": "Europe/Sofia",
    "PFO": "Asia/Nicosia",
    "PMI": "Europe/Madrid",
    "PMO": "Europe/Rome",
    "PRN": "Europe/Belgrade",
    "PSA": "Europe/Rome",
    "RMO": "Europe/Chisinau",
    "SKG": "Europe/Athens",
    "SKP": "Europe/Skopje",
    "STN": "Europe/London",
    "SUF": "Europe/Rome",
    "TGD": "Europe/Podgorica",
    "TIA": "Europe/Tirane",
    "TLV": "Asia/Jerusalem",
    "TPS": "Europe/Rome",
    "TZL": "Europe/Sarajevo",
    "VAR": "Europe/Sofia",
    "WAW": "Europe/Warsaw",
    "WMI": "Europe/Warsaw",
    "ZAD": "Europe/Zagreb",
}


def calculate_duration_minutes(
    departure_local: datetime,
    arrival_local: datetime,
    origin_iata: str,
    destination_iata: str,
) -> int | None:
    """Vypočíta dĺžku letu po prevedení oboch miestnych časov na UTC."""

    origin_timezone = AIRPORT_TIMEZONES.get(origin_iata)
    destination_timezone = AIRPORT_TIMEZONES.get(destination_iata)
    if origin_timezone is None or destination_timezone is None:
        return None

    try:
        departure_utc = departure_local.replace(
            tzinfo=ZoneInfo(origin_timezone)
        ).astimezone(timezone.utc)
        arrival_utc = arrival_local.replace(
            tzinfo=ZoneInfo(destination_timezone)
        ).astimezone(timezone.utc)
    except ZoneInfoNotFoundError:
        return None

    duration_minutes = round((arrival_utc - departure_utc).total_seconds() / 60)
    return duration_minutes if duration_minutes > 0 else None
