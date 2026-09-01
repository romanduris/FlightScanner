"""Statické údaje letísk potrebné pre filtre a mapu dashboardu."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AirportInfo:
    country: str
    country_code: str
    latitude: float
    longitude: float


# Súradnice predstavujú polohu letiska, nie centra mesta.
AIRPORTS: dict[str, AirportInfo] = {
    "BTS": AirportInfo("Slovensko", "SK", 48.1702, 17.2127),
    "ACE": AirportInfo("Španielsko", "ES", 28.9455, -13.6052),
    "AGP": AirportInfo("Španielsko", "ES", 36.6749, -4.4991),
    "AHO": AirportInfo("Taliansko", "IT", 40.6321, 8.2908),
    "ALC": AirportInfo("Španielsko", "ES", 38.2822, -0.5582),
    "ATH": AirportInfo("Grécko", "GR", 37.9364, 23.9445),
    "BCN": AirportInfo("Španielsko", "ES", 41.2974, 2.0833),
    "BER": AirportInfo("Nemecko", "DE", 52.3667, 13.5033),
    "BOJ": AirportInfo("Bulharsko", "BG", 42.5696, 27.5152),
    "BRI": AirportInfo("Taliansko", "IT", 41.1389, 16.7606),
    "BSL": AirportInfo("Švajčiarsko", "CH", 47.5900, 7.5290),
    "CFU": AirportInfo("Grécko", "GR", 39.6019, 19.9117),
    "CIA": AirportInfo("Taliansko", "IT", 41.7999, 12.5949),
    "CRL": AirportInfo("Belgicko", "BE", 50.4592, 4.4538),
    "DLM": AirportInfo("Turecko", "TR", 36.7131, 28.7925),
    "DTM": AirportInfo("Nemecko", "DE", 51.5183, 7.6122),
    "DUB": AirportInfo("Írsko", "IE", 53.4213, -6.2701),
    "EDI": AirportInfo("Spojené kráľovstvo", "GB", 55.9500, -3.3725),
    "EIN": AirportInfo("Holandsko", "NL", 51.4501, 5.3745),
    "EVN": AirportInfo("Arménsko", "AM", 40.1473, 44.3959),
    "FCO": AirportInfo("Taliansko", "IT", 41.8003, 12.2389),
    "GDN": AirportInfo("Poľsko", "PL", 54.3776, 18.4662),
    "JMK": AirportInfo("Grécko", "GR", 37.4351, 25.3481),
    "JSI": AirportInfo("Grécko", "GR", 39.1771, 23.5037),
    "KSC": AirportInfo("Slovensko", "SK", 48.6631, 21.2411),
    "KUT": AirportInfo("Gruzínsko", "GE", 42.1767, 42.4826),
    "LBA": AirportInfo("Spojené kráľovstvo", "GB", 53.8659, -1.6606),
    "LCA": AirportInfo("Cyprus", "CY", 34.8751, 33.6249),
    "LTN": AirportInfo("Spojené kráľovstvo", "GB", 51.8747, -0.3683),
    "MAN": AirportInfo("Spojené kráľovstvo", "GB", 53.3537, -2.2750),
    "MLA": AirportInfo("Malta", "MT", 35.8575, 14.4775),
    "MXP": AirportInfo("Taliansko", "IT", 45.6306, 8.7281),
    "NAP": AirportInfo("Taliansko", "IT", 40.8860, 14.2908),
    "NCE": AirportInfo("Francúzsko", "FR", 43.6584, 7.2159),
    "OHD": AirportInfo("Severné Macedónsko", "MK", 41.1800, 20.7423),
    "OSL": AirportInfo("Nórsko", "NO", 60.1939, 11.1004),
    "PDV": AirportInfo("Bulharsko", "BG", 42.0678, 24.8508),
    "PFO": AirportInfo("Cyprus", "CY", 34.7180, 32.4857),
    "PMI": AirportInfo("Španielsko", "ES", 39.5517, 2.7388),
    "PMO": AirportInfo("Taliansko", "IT", 38.1759, 13.0910),
    "PRN": AirportInfo("Kosovo", "XK", 42.5728, 21.0358),
    "PSA": AirportInfo("Taliansko", "IT", 43.6839, 10.3927),
    "RMO": AirportInfo("Moldavsko", "MD", 46.9277, 28.9310),
    "SKG": AirportInfo("Grécko", "GR", 40.5197, 22.9709),
    "SKP": AirportInfo("Severné Macedónsko", "MK", 41.9616, 21.6214),
    "STN": AirportInfo("Spojené kráľovstvo", "GB", 51.8850, 0.2350),
    "SUF": AirportInfo("Taliansko", "IT", 38.9054, 16.2423),
    "TGD": AirportInfo("Čierna Hora", "ME", 42.3594, 19.2519),
    "TIA": AirportInfo("Albánsko", "AL", 41.4147, 19.7206),
    "TLV": AirportInfo("Izrael", "IL", 32.0114, 34.8867),
    "TPS": AirportInfo("Taliansko", "IT", 37.9114, 12.4880),
    "TZL": AirportInfo("Bosna a Hercegovina", "BA", 44.4587, 18.7248),
    "VAR": AirportInfo("Bulharsko", "BG", 43.2321, 27.8251),
    "WAW": AirportInfo("Poľsko", "PL", 52.1657, 20.9671),
    "WMI": AirportInfo("Poľsko", "PL", 52.4511, 20.6518),
    "ZAD": AirportInfo("Chorvátsko", "HR", 44.1083, 15.3467),
}


def get_airport_info(iata: str) -> AirportInfo | None:
    """Vráti mapové údaje letiska, ak ich poznáme."""

    return AIRPORTS.get(iata.upper())
