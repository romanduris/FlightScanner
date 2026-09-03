"""Testy šetrného tempa a opakovania HTTP požiadaviek."""

from __future__ import annotations

import io
import unittest
from email.message import Message
from unittest.mock import patch
from urllib.error import HTTPError

from providers.base import JsonHttpClient


class _JsonResponse:
    def __init__(self, body: bytes = b'{"ok": true}') -> None:
        self.body = body
        self.headers = Message()
        self.headers["Content-Type"] = "application/json; charset=utf-8"

    def __enter__(self) -> "_JsonResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return self.body


class JsonHttpClientPolicyTest(unittest.TestCase):
    def test_retry_after_header_controls_temporary_error_delay(self) -> None:
        headers = Message()
        headers["Retry-After"] = "7"
        throttled = HTTPError(
            "https://example.test/data",
            429,
            "Too Many Requests",
            headers,
            io.BytesIO(b"slow down"),
        )
        client = JsonHttpClient(
            retries=1,
            min_interval_seconds=0,
            backoff_base_seconds=1,
        )

        with patch("providers.base.urlopen", side_effect=[throttled, _JsonResponse()]), patch(
            "providers.base.time.sleep"
        ) as sleep:
            self.assertEqual(client.get_json("https://example.test/data"), {"ok": True})

        sleep.assert_called_once_with(7.0)

    def test_exponential_backoff_is_used_without_retry_after(self) -> None:
        error = HTTPError(
            "https://example.test/data",
            503,
            "Unavailable",
            Message(),
            io.BytesIO(b"temporarily unavailable"),
        )
        client = JsonHttpClient(
            retries=2,
            min_interval_seconds=0,
            backoff_base_seconds=1.5,
        )

        with patch(
            "providers.base.urlopen",
            side_effect=[error, error, _JsonResponse()],
        ), patch("providers.base.time.sleep") as sleep:
            self.assertEqual(client.get_json("https://example.test/data"), {"ok": True})

        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1.5, 3.0])


if __name__ == "__main__":
    unittest.main()
