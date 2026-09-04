#!/usr/bin/env python3
"""Keep the newest deployed scan when a code-only push redeploys GitHub Pages."""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_URL = "https://btsflightscaner.rodulab.com/flight-data.js"
OUTPUT = PROJECT_DIR / "HTML" / "flight-data.js"
INDEX = PROJECT_DIR / "HTML" / "index.html"


def main() -> int:
    request = urllib.request.Request(DATA_URL, headers={"User-Agent": "FlightScanner-deployer"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            source = response.read().decode("utf-8")
    except (OSError, UnicodeError, urllib.error.URLError) as error:
        print(f"Upozornenie: produkčné dáta sa nepodarilo prevziať: {error}")
        print("Použijú sa dáta uložené v repozitári.")
        return 0

    match = re.search(r"window\.FLIGHT_DATA\s*=\s*(\{.*\})\s*;\s*$", source, re.S)
    if not match:
        print("Upozornenie: produkčný flight-data.js nemá očakávaný formát.")
        return 0
    payload = json.loads(match.group(1))
    scanned_at = str(payload.get("scanned_at_utc") or "")
    version = re.sub(r"[^0-9]", "", scanned_at)
    if not version:
        print("Upozornenie: v produkčných dátach chýba čas zberu.")
        return 0

    OUTPUT.write_text(source, encoding="utf-8")
    html = INDEX.read_text(encoding="utf-8")
    html, replacements = re.subn(
        r'(src="flight-data\.js)(?:\?v=[^"]*)?(\")',
        rf"\g<1>?v={version}\g<2>",
        html,
    )
    if replacements != 1:
        raise ValueError("V index.html sa nenašiel práve jeden flight-data.js asset.")
    INDEX.write_text(html, encoding="utf-8")
    print(f"Zachované produkčné dáta zo zberu {scanned_at}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
