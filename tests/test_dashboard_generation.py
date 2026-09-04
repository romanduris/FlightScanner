from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "3.GenerateDashboard.py"
SPEC = importlib.util.spec_from_file_location("dashboard_generator", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
dashboard_generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dashboard_generator)


class DashboardGenerationTest(unittest.TestCase):
    def test_asset_versions_prevent_stale_browser_cache(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            index_path = Path(temporary_directory) / "index.html"
            index_path.write_text(
                '<link href="dashboard.css?v=old">'
                '<script src="flight-data.js"></script>'
                '<script src="i18n/sk.js?v=old"></script>'
                '<script src="i18n/en.js?v=old"></script>'
                '<script src="i18n/i18n.js?v=old"></script>'
                '<script src="booking/booking-com-config.js?v=old"></script>'
                '<script src="booking/booking-com.js?v=old"></script>'
                '<script src="booking/booking-buttons.js?v=old"></script>'
                '<script src="booking/ryanair.js?v=old"></script>'
                '<script src="booking/wizzair.js?v=old"></script>'
                '<script src="dashboard.js?v=old"></script>'
                '<script src="contact/contact.js?v=old"></script>',
                encoding="utf-8",
            )

            dashboard_generator.update_html_asset_versions(
                index_path,
                "2026-09-02T10:15:30.123456+00:00",
            )

            html = index_path.read_text(encoding="utf-8")
            self.assertIn("dashboard.css?v=202609021015301234560000", html)
            self.assertIn("flight-data.js?v=202609021015301234560000", html)
            self.assertIn("i18n/sk.js?v=202609021015301234560000", html)
            self.assertIn("i18n/en.js?v=202609021015301234560000", html)
            self.assertIn("i18n/i18n.js?v=202609021015301234560000", html)
            self.assertIn(
                "booking/booking-com-config.js?v=202609021015301234560000", html
            )
            self.assertIn(
                "booking/booking-com.js?v=202609021015301234560000", html
            )
            self.assertIn(
                "booking/booking-buttons.js?v=202609021015301234560000", html
            )
            self.assertIn("booking/ryanair.js?v=202609021015301234560000", html)
            self.assertIn("booking/wizzair.js?v=202609021015301234560000", html)
            self.assertIn("dashboard.js?v=202609021015301234560000", html)
            self.assertIn("contact/contact.js?v=202609021015301234560000", html)


if __name__ == "__main__":
    unittest.main()
