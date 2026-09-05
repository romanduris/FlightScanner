from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date, time
from pathlib import Path
from unittest.mock import patch

from services.bts_schedule import (
    BtsScheduleError,
    ScheduledFlight,
    load_bts_schedules,
    schedule_urls_from_airlines_json,
)


class BtsScheduleSourcesTest(unittest.TestCase):
    def test_reads_and_deduplicates_multiple_schedule_urls(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "airlines.json"
            path.write_text(
                json.dumps({"schedule_source_urls": ["summer", "winter", "summer"]}),
                encoding="utf-8",
            )

            self.assertEqual(
                schedule_urls_from_airlines_json(path),
                ("summer", "winter"),
            )

    def test_keeps_available_schedule_when_supplemental_source_fails(self) -> None:
        flight = ScheduledFlight(
            destination_iata="SKP",
            valid_from=date(2026, 10, 25),
            valid_to=date(2027, 3, 27),
            operating_days=("Ned",),
            departure_time=time(23, 45),
            arrival_time=time(1, 15),
            arrival_day_offset=1,
            flight_number="W64704",
        )
        with patch(
            "services.bts_schedule.load_bts_schedule",
            side_effect=[[flight], BtsScheduleError("unavailable")],
        ):
            self.assertEqual(load_bts_schedules(["winter", "missing"]), [flight])


if __name__ == "__main__":
    unittest.main()
