from __future__ import annotations

import unittest
from datetime import date, datetime, time
from urllib.parse import parse_qs, urlparse

from providers.base import Destination
from providers.ryanair import RyanairProvider
from providers.wizzair import WizzAirProvider
from services.bts_schedule import ScheduledFlight


class RyanairReturnOffersTest(unittest.TestCase):
    def test_return_window_crosses_month_and_filters_outside_dates(self) -> None:
        responses = {
            "2026-09-01": [
                self._fare("2026-09-28T10:00:00", "2026-09-28T12:00:00", 99),
                self._fare("2026-09-29T10:00:00", "2026-09-29T12:00:00", 35),
            ],
            "2026-10-01": [
                self._fare("2026-10-02T10:00:00", "2026-10-02T12:00:00", 25),
                self._fare("2026-10-09T10:00:00", "2026-10-09T12:00:00", 55),
            ],
        }

        class StubClient:
            def __init__(self) -> None:
                self.requested_months: list[str] = []

            def get_json(self, url: str) -> dict:
                month = parse_qs(urlparse(url).query)["outboundMonthOfDate"][0]
                self.requested_months.append(month)
                return {"outbound": {"fares": responses[month]}}

        provider = RyanairProvider(max_workers=1)
        client = StubClient()
        provider.client = client  # type: ignore[assignment]
        offers = provider._get_return_offers(
            "BCN",
            "BTS",
            [
                datetime(2026, 9, 28, 8, 0),
                datetime(2026, 9, 30, 8, 0),
            ],
        )

        self.assertEqual(client.requested_months, ["2026-09-01", "2026-10-01"])
        self.assertEqual(
            [offer.departure_local for offer in offers],
            ["2026-09-29T10:00", "2026-10-02T10:00", "2026-10-09T10:00"],
        )
        self.assertEqual([offer.price for offer in offers], [35, 25, 55])

    @staticmethod
    def _fare(departure: str, arrival: str, price: int) -> dict:
        return {
            "departureDate": departure,
            "arrivalDate": arrival,
            "price": {"value": price, "currencyCode": "EUR"},
            "unavailable": False,
        }


class WizzReturnOffersTest(unittest.TestCase):
    def test_return_pool_keeps_dates_for_all_outbound_choices(self) -> None:
        provider = WizzAirProvider(max_workers=1)
        flights = [
            self._flight("2026-09-22T11:25:00", 9),
            self._flight("2026-09-23T11:25:00", 19),
            self._flight("2026-10-02T11:25:00", 29),
            self._flight("2026-10-03T11:25:00", 39),
        ]

        offers = provider._get_return_offers(
            "TZL",
            "BTS",
            flights,
        )

        self.assertEqual(
            [offer.departure_local for offer in offers],
            [
                "2026-09-22T11:25",
                "2026-09-23T11:25",
                "2026-10-02T11:25",
                "2026-10-03T11:25",
            ],
        )
        self.assertEqual([offer.price for offer in offers], [9, 19, 29, 39])

    def test_cheapest_offer_keeps_all_concrete_outbound_dates(self) -> None:
        provider = WizzAirProvider(max_workers=1)
        flights = [
            self._flight("2026-09-22T12:55:00", 9),
            self._flight("2026-09-25T12:55:00", 29),
        ]
        schedule = [
            ScheduledFlight(
                destination_iata="TZL",
                valid_from=date(2026, 9, 1),
                valid_to=date(2026, 9, 30),
                operating_days=("Uto", "Pia"),
                departure_time=time(12, 55),
                arrival_time=time(14, 0),
                arrival_day_offset=0,
                flight_number="W64244",
            )
        ]

        offer = provider._build_cheapest_offer(
            "BTS",
            Destination("Tuzla", "TZL"),
            flights,
            schedule,
        )

        self.assertIsNotNone(offer)
        assert offer is not None
        self.assertEqual(offer.departure_local, "2026-09-22T12:55")
        self.assertEqual(
            [item.departure_local for item in offer.outbound_offers],
            ["2026-09-22T12:55", "2026-09-25T12:55"],
        )
        self.assertEqual([item.price for item in offer.outbound_offers], [9, 29])

    def test_month_request_fetches_outbound_and_return_together(self) -> None:
        class StubClient:
            def __init__(self) -> None:
                self.payload: dict | None = None

            def post_json(self, url: str, payload: dict, extra_headers: dict) -> dict:
                self.payload = payload
                return {"outboundFlights": [], "returnFlights": []}

        provider = WizzAirProvider(max_workers=1)
        provider._api_url = "https://example.test/api"
        client = StubClient()
        provider.client = client  # type: ignore[assignment]

        outbound, returns, failures = provider._load_monthly_flights(
            "BTS",
            [Destination("Tuzla", "TZL")],
            2099,
            9,
        )

        self.assertEqual((outbound, returns, failures), ([], [], {}))
        self.assertIsNotNone(client.payload)
        routes = client.payload["flightList"]  # type: ignore[index]
        self.assertEqual(len(routes), 2)
        self.assertEqual(
            (routes[0]["departureStation"], routes[0]["arrivalStation"]),
            ("BTS", "TZL"),
        )
        self.assertEqual(
            (routes[1]["departureStation"], routes[1]["arrivalStation"]),
            ("TZL", "BTS"),
        )
        self.assertEqual(routes[1]["to"], "2099-10-10")

    @staticmethod
    def _flight(departure: str, price: int) -> dict:
        return {
            "departureDate": departure,
            "priceType": "price",
            "price": {"amount": price, "currencyCode": "EUR"},
        }


if __name__ == "__main__":
    unittest.main()
