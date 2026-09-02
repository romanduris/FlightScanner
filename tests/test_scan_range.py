from __future__ import annotations

import importlib.util
import unittest
from datetime import date
from pathlib import Path

from providers.base import FlightOffer, OutboundOffer, ReturnOffer


MODULE_PATH = Path(__file__).resolve().parents[1] / "2.Destination.py"
SPEC = importlib.util.spec_from_file_location("destination_scanner", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
destination_scanner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(destination_scanner)


class ScanRangeTest(unittest.TestCase):
    def test_months_in_range_crosses_year_boundary(self) -> None:
        self.assertEqual(
            destination_scanner.months_in_range(
                date(2026, 12, 20), date(2027, 1, 18)
            ),
            [(2026, 12), (2027, 1)],
        )

    def test_merge_keeps_only_requested_outbound_days(self) -> None:
        september = self._offer(
            (
                self._outbound("2026-09-01T08:00", 8),
                self._outbound("2026-09-30T08:00", 30),
            ),
            (self._return("2026-10-02T08:00", 20),),
        )
        october = self._offer(
            (
                self._outbound("2026-10-01T08:00", 10),
                self._outbound("2026-10-02T08:00", 5),
            ),
            (self._return("2026-10-11T08:00", 40),),
        )

        result = destination_scanner.merge_offers_for_range(
            [september, october], date(2026, 9, 2), date(2026, 10, 1)
        )

        self.assertEqual(len(result), 1)
        offer = result[0]
        self.assertEqual(
            [item.departure_local for item in offer.outbound_offers],
            ["2026-09-30T08:00", "2026-10-01T08:00"],
        )
        self.assertEqual(offer.departure_local, "2026-10-01T08:00")
        self.assertEqual(offer.price, 10)
        self.assertEqual(
            [item.departure_local for item in offer.return_offers],
            ["2026-10-02T08:00", "2026-10-11T08:00"],
        )
        self.assertEqual(offer.operating_schedule, ("Str 08:00", "Štv 08:00"))

    @staticmethod
    def _outbound(departure: str, price: float) -> OutboundOffer:
        return OutboundOffer(
            departure_local=departure,
            arrival_local=departure,
            price=price,
            currency="EUR",
            flight_number="XX1",
            duration_minutes=60,
        )

    @staticmethod
    def _return(departure: str, price: float) -> ReturnOffer:
        return ReturnOffer(
            airline="Test Air",
            origin_iata="TST",
            destination_iata="BTS",
            departure_local=departure,
            arrival_local=None,
            price=price,
            currency="EUR",
        )

    @staticmethod
    def _offer(
        outbounds: tuple[OutboundOffer, ...], returns: tuple[ReturnOffer, ...]
    ) -> FlightOffer:
        cheapest = min(outbounds, key=lambda item: item.price)
        return FlightOffer(
            airline="Test Air",
            origin_iata="BTS",
            destination_name="Test",
            destination_iata="TST",
            flight_number=cheapest.flight_number,
            departure_local=cheapest.departure_local,
            arrival_local=cheapest.arrival_local,
            price=cheapest.price,
            currency=cheapest.currency,
            outbound_offers=outbounds,
            return_offers=returns,
        )


if __name__ == "__main__":
    unittest.main()
