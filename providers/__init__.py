"""Poskytovatelia letov a cien jednotlivých leteckých spoločností."""

from .base import (
    BaseAirlineProvider,
    Destination,
    FlightOffer,
    OutboundOffer,
    RETURN_WINDOW_DAYS,
    ReturnOffer,
    RouteFailure,
)


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
    "OutboundOffer",
    "RETURN_WINDOW_DAYS",
    "ReturnOffer",
    "RouteFailure",
    "get_provider_classes",
]
