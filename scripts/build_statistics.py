#!/usr/bin/env python3
"""Build the public, non-sensitive data used by the statistics page."""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_DIR = Path(__file__).resolve().parents[1]
FLIGHT_DATA_PATH = PROJECT_DIR / "HTML" / "flight-data.js"
OUTPUT_PATH = PROJECT_DIR / "HTML" / "statistics" / "data.json"
PRODUCTION_DATA_URL = "https://btsflightscaner.rodulab.com/statistics/data.json"
RUNS_URL = (
    "https://api.github.com/repos/romanduris/FlightScanner/actions/workflows/"
    "refresh-dashboard.yml/runs?per_page=40"
)


def read_flight_data(path: Path) -> dict[str, Any]:
    source = path.read_text(encoding="utf-8")
    match = re.search(r"window\.FLIGHT_DATA\s*=\s*(\{.*\})\s*;\s*$", source, re.S)
    if not match:
        raise ValueError(f"V {path} sa nepodarilo nájsť FLIGHT_DATA.")
    return json.loads(match.group(1))


def request_json(url: str, token: str = "", timeout: int = 12) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "FlightScanner-statistics-builder",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def date_part(value: str | None) -> str | None:
    parsed = parse_datetime(value)
    return parsed.date().isoformat() if parsed else None


def flight_snapshot(payload: dict[str, Any]) -> dict[str, Any]:
    offers = payload.get("offers") or []
    outbound = [item for offer in offers for item in (offer.get("outbound_offers") or [])]
    returns = [item for offer in offers for item in (offer.get("return_offers") or [])]
    outbound_dates = sorted(
        value for item in outbound if (value := date_part(item.get("departure_local")))
    )
    prices = [float(item["price"]) for item in outbound if item.get("price") is not None]
    countries = sorted({str(offer.get("country")) for offer in offers if offer.get("country")})
    destinations = sorted({str(offer.get("destination_iata")) for offer in offers if offer.get("destination_iata")})
    routes = sorted({
        f"{offer.get('airline')}:{offer.get('destination_iata')}"
        for offer in offers
        if offer.get("airline") and offer.get("destination_iata")
    })
    failure_count = sum(len(items or []) for items in (payload.get("failures") or {}).values())

    airline_breakdown: list[dict[str, Any]] = []
    for airline in ("RYANAIR", "Wizz Air"):
        airline_offers = [offer for offer in offers if offer.get("airline") == airline]
        airline_breakdown.append(
            {
                "airline": airline,
                "routes": len(airline_offers),
                "flights": sum(len(offer.get("outbound_offers") or []) for offer in airline_offers),
                "returns": sum(len(offer.get("return_offers") or []) for offer in airline_offers),
                "failures": len((payload.get("failures") or {}).get(airline) or []),
            }
        )

    cheapest = None
    for offer in offers:
        for item in offer.get("outbound_offers") or []:
            if item.get("price") is None:
                continue
            candidate = {
                "destination": offer.get("destination_name"),
                "iata": offer.get("destination_iata"),
                "airline": offer.get("airline"),
                "date": date_part(item.get("departure_local")),
                "price": float(item["price"]),
                "currency": item.get("currency") or "EUR",
            }
            if cheapest is None or candidate["price"] < cheapest["price"]:
                cheapest = candidate

    return {
        "scanned_at_utc": payload.get("scanned_at_utc"),
        "scan_days": payload.get("scan_days"),
        "period_start": outbound_dates[0] if outbound_dates else None,
        "period_end": outbound_dates[-1] if outbound_dates else None,
        "routes": len(routes),
        "destinations": len(destinations),
        "route_iatas": routes,
        "countries": len(countries),
        "flights": len(outbound),
        "return_flights": len(returns),
        "failures": failure_count,
        "airlines": airline_breakdown,
        "cheapest_one_way": cheapest,
        "average_one_way_price": round(sum(prices) / len(prices), 2) if prices else None,
    }


def compact_run(run: dict[str, Any]) -> dict[str, Any]:
    started = parse_datetime(run.get("run_started_at") or run.get("created_at"))
    finished = parse_datetime(run.get("updated_at")) if run.get("status") == "completed" else None
    duration = max(0, round((finished - started).total_seconds())) if started and finished else None
    return {
        "id": run.get("id"),
        "event": run.get("event"),
        "status": run.get("status"),
        "conclusion": run.get("conclusion"),
        "started_at": run.get("run_started_at") or run.get("created_at"),
        "updated_at": run.get("updated_at"),
        "duration_seconds": duration,
        "url": run.get("html_url"),
        "commit": (run.get("head_sha") or "")[:7],
    }


def read_previous(path: Path, allow_remote: bool) -> dict[str, Any]:
    if allow_remote:
        try:
            return request_json(PRODUCTION_DATA_URL)
        except (OSError, urllib.error.URLError, json.JSONDecodeError):
            pass
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    return {}


def attach_changes(history: list[dict[str, Any]]) -> None:
    ordered = sorted(history, key=lambda item: item.get("scanned_at_utc") or "")
    previous_routes: set[str] | None = None
    for snapshot in ordered:
        current_routes = set(snapshot.get("route_iatas") or [])
        if previous_routes is None:
            snapshot["new_routes"] = []
            snapshot["removed_routes"] = []
        else:
            snapshot["new_routes"] = sorted(current_routes - previous_routes)
            snapshot["removed_routes"] = sorted(previous_routes - current_routes)
        previous_routes = current_routes


def build(args: argparse.Namespace) -> dict[str, Any]:
    payload = read_flight_data(args.flight_data)
    current = flight_snapshot(payload)
    previous = {} if args.reset_history else read_previous(args.output, not args.no_remote)
    history = [item for item in previous.get("scan_history", []) if isinstance(item, dict)]
    key = current.get("scanned_at_utc")
    history = [item for item in history if item.get("scanned_at_utc") != key]
    history.append(current)
    history.sort(key=lambda item: item.get("scanned_at_utc") or "", reverse=True)
    history = history[:180]
    attach_changes(history)

    runs: list[dict[str, Any]] = []
    try:
        response = request_json(RUNS_URL, os.environ.get("GITHUB_TOKEN", ""))
        runs = [compact_run(item) for item in response.get("workflow_runs", [])]
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as error:
        print(f"Upozornenie: GitHub behy sa nepodarilo načítať: {error}")
        runs = previous.get("action_runs", [])

    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "next_scheduled_scans": ["08:11 Europe/Bratislava", "18:11 Europe/Bratislava"],
        "current": current,
        "scan_history": history,
        "action_runs": runs,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Vygeneruje verejné dáta stránky štatistík.")
    parser.add_argument("--flight-data", type=Path, default=FLIGHT_DATA_PATH)
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--no-remote", action="store_true")
    parser.add_argument("--reset-history", action="store_true", help="Začne novú históriu bez existujúceho výstupu.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = build(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    current = result["current"]
    try:
        display_output = args.output.resolve().relative_to(PROJECT_DIR)
    except ValueError:
        display_output = args.output
    print(f"Štatistiky: {display_output}")
    print(f"Trasy: {current['routes']}, odlety: {current['flights']}, návraty: {current['return_flights']}")
    print(f"História zberov: {len(result['scan_history'])}, GitHub behy: {len(result['action_runs'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
