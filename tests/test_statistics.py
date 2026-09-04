from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "build_statistics.py"
SPEC = importlib.util.spec_from_file_location("build_statistics", MODULE_PATH)
assert SPEC and SPEC.loader
build_statistics = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build_statistics)


class StatisticsBuilderTests(unittest.TestCase):
    def test_snapshot_counts_routes_flights_and_provider_breakdown(self) -> None:
        payload = {
            "scanned_at_utc": "2026-09-04T08:00:00+00:00",
            "scan_days": 90,
            "offers": [
                {
                    "airline": "RYANAIR",
                    "destination_iata": "BER",
                    "destination_name": "Berlín",
                    "country": "Nemecko",
                    "outbound_offers": [
                        {"departure_local": "2026-09-05T10:00", "price": 19.99, "currency": "EUR"},
                        {"departure_local": "2026-09-07T10:00", "price": 29.99, "currency": "EUR"},
                    ],
                    "return_offers": [{"departure_local": "2026-09-09T10:00", "price": 30}],
                },
                {
                    "airline": "Wizz Air",
                    "destination_iata": "BER",
                    "destination_name": "Berlín",
                    "country": "Nemecko",
                    "outbound_offers": [{"departure_local": "2026-09-06T10:00", "price": 15.99}],
                    "return_offers": [],
                },
            ],
            "failures": {"RYANAIR": [], "Wizz Air": ["temporary"]},
        }

        snapshot = build_statistics.flight_snapshot(payload)

        self.assertEqual(snapshot["routes"], 2)
        self.assertEqual(snapshot["destinations"], 1)
        self.assertEqual(snapshot["flights"], 3)
        self.assertEqual(snapshot["return_flights"], 1)
        self.assertEqual(snapshot["failures"], 1)
        self.assertEqual(snapshot["cheapest_one_way"]["price"], 15.99)

    def test_route_changes_are_derived_between_scans(self) -> None:
        history = [
            {"scanned_at_utc": "2026-09-05T08:00:00Z", "route_iatas": ["RYANAIR:BER", "Wizz Air:SKP"]},
            {"scanned_at_utc": "2026-09-04T08:00:00Z", "route_iatas": ["RYANAIR:BER", "Wizz Air:KSC"]},
        ]

        build_statistics.attach_changes(history)

        self.assertEqual(history[0]["new_routes"], ["Wizz Air:SKP"])
        self.assertEqual(history[0]["removed_routes"], ["Wizz Air:KSC"])


if __name__ == "__main__":
    unittest.main()
