"""Poskytovatelia letov a cien jednotlivých leteckých spoločností."""

from .base import BaseAirlineProvider, Destination, FlightOffer, RouteFailure


def get_provider_classes() -> tuple[type[BaseAirlineProvider], ...]:
    """Vráti všetkých providerov, ktoré má spustiť spoločný skener."""

    # Lokálny import zabráni dvojitému načítaniu pri spustení
    # `python3 -m providers.ryanair`.
    from .ryanair import RyanairProvider
    from .wizzair import WizzAirProvider

    return (RyanairProvider, WizzAirProvider)

__all__ = [
    "BaseAirlineProvider",
    "Destination",
    "FlightOffer",
    "RouteFailure",
    "get_provider_classes",
]
