from __future__ import annotations

import importlib.util
import sys
import unittest
from datetime import date
from pathlib import Path
from typing import Any

from providers.base import Destination


MODULE_PATH = Path(__file__).resolve().parents[1] / "4.ProviderHorizon.py"
SPEC = importlib.util.spec_from_file_location("provider_horizon", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
provider_horizon = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = provider_horizon
SPEC.loader.exec_module(provider_horizon)


class FakeProbe(provider_horizon.AirlineHorizonProbe):
    airline_name = "RYANAIR"

    def __init__(self, available: dict[tuple[str, str], list[date]]) -> None:
        self.available = available
        self.request_count = 0

    def fetch_route_month(
        self,
        origin_iata: str,
        destination_iata: str,
        month_start: date,
        today: date,
    ) -> list[date]:
        del origin_iata, today
        self.request_count += 1
        return self.available.get(
            (destination_iata, month_start.strftime("%Y-%m")), []
        )


class ProviderHorizonTest(unittest.TestCase):
    def test_add_months_crosses_year(self) -> None:
        self.assertEqual(
            provider_horizon.add_months(date(2026, 11, 1), 3),
            date(2027, 2, 1),
        )

    def test_finds_boundary_and_exact_last_date(self) -> None:
        destinations = [
            Destination("London", "STN"),
            Destination("Dublin", "DUB"),
            Destination("Rome", "CIA"),
            Destination("Malta", "MLA"),
        ]
        available: dict[tuple[str, str], list[date]] = {}
        for month in range(9, 13):
            available[("STN", f"2026-{month:02d}")] = [date(2026, month, 15)]
        available[("STN", "2027-01")] = [date(2027, 1, 20)]
        available[("MLA", "2027-01")] = [date(2027, 1, 31)]

        result = provider_horizon.find_airline_horizon(
            FakeProbe(available),
            destinations,
            date(2026, 9, 4),
            max_months=9,
            step_months=3,
        )

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["last_bookable_month"], "2027-01")
        self.assertEqual(result["last_bookable_date"], "2027-01-31")
        self.assertFalse(result["search_limit_reached"])
        self.assertEqual(result["destinations_checked_in_final_month"], 4)

    def test_ryanair_parser_keeps_only_future_priced_fares(self) -> None:
        class StubClient:
            def get_json(self, _url: str) -> dict[str, Any]:
                return {
                    "outbound": {
                        "fares": [
                            {
                                "departureDate": "2026-09-03T10:00:00",
                                "price": {"value": 10},
                            },
                            {
                                "departureDate": "2026-09-12T10:00:00",
                                "price": {"value": 20},
                            },
                            {
                                "departureDate": "2026-09-20T10:00:00",
                                "price": None,
                            },
                        ]
                    }
                }

        probe = provider_horizon.RyanairHorizonProbe(0)
        probe.client = StubClient()
        self.assertEqual(
            probe.fetch_route_month(
                "BTS", "STN", date(2026, 9, 1), date(2026, 9, 4)
            ),
            [date(2026, 9, 12)],
        )

    def test_wizz_request_contains_only_outbound_route(self) -> None:
        class StubClient:
            def __init__(self) -> None:
                self.payload: dict[str, Any] | None = None

            def post_json(
                self,
                _url: str,
                payload: dict[str, Any],
                extra_headers: dict[str, str] | None = None,
            ) -> dict[str, Any]:
                del extra_headers
                self.payload = payload
                return {
                    "outboundFlights": [
                        {
                            "priceType": "price",
                            "departureDate": "2027-02-16T06:00:00",
                            "price": {"amount": 29.99},
                        }
                    ]
                }

        probe = provider_horizon.WizzAirHorizonProbe(0)
        client = StubClient()
        probe.client = client
        probe._api_url = "https://example.test/Api"

        dates = probe.fetch_route_month(
            "BTS", "LTN", date(2027, 2, 1), date(2026, 9, 4)
        )

        self.assertEqual(dates, [date(2027, 2, 16)])
        assert client.payload is not None
        self.assertEqual(len(client.payload["flightList"]), 1)
        self.assertEqual(client.payload["adultCount"], 1)
        self.assertEqual(client.payload["flightList"][0]["to"], "2027-02-28")


if __name__ == "__main__":
    unittest.main()
