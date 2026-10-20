"""Retain usable deployed offers with their original collection timestamp."""
from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from datetime import date, timedelta

from providers.base import RETURN_WINDOW_DAYS, build_weekly_schedule, parse_local_datetime


def recover_provider_data(payload: dict, previous_file: Path) -> dict:
    try:
        source = previous_file.read_text(encoding="utf-8")
        match = re.search(r"window\.FLIGHT_DATA\s*=\s*(\{.*\})\s*;\s*$", source, re.S)
        previous = json.loads(match.group(1)) if match else {}
    except (OSError, ValueError):
        previous = {}
    if previous.get("origin_iata") != payload["origin_iata"]:
        previous = {}
    for airline, summary in payload["summary"].items():
        summary["scanned_at_utc"] = payload["scanned_at_utc"]
        summary["end_date"] = payload["end_date"]
        if summary.get("status") != "unavailable":
            continue
        old_summary = previous.get("summary", {}).get(airline, {})
        collected = old_summary.get("scanned_at_utc") or previous.get("scanned_at_utc")
        recovered = []
        for raw in previous.get("offers", []):
            if raw.get("airline") != airline or not collected:
                continue
            offer = copy.deepcopy(raw)
            outbound = [item for item in offer.get("outbound_offers", [])
                        if payload["start_date"] <= item["departure_local"][:10] <= payload["end_date"]]
            if not outbound:
                continue
            cheapest = min(outbound, key=lambda item: (item["price"], item["departure_local"]))
            offer.update(cheapest)
            offer["outbound_offers"] = outbound
            offer["operating_schedule"] = list(build_weekly_schedule([
                parse_local_datetime(item["departure_local"]) for item in outbound
            ]))
            return_end = (date.fromisoformat(payload["end_date"]) + timedelta(days=RETURN_WINDOW_DAYS)).isoformat()
            offer["return_offers"] = [item for item in offer.get("return_offers", [])
                                      if payload["start_date"] < item["departure_local"][:10] <= return_end]
            recovered.append(offer)
        if recovered:
            payload["offers"].extend(recovered)
            summary.update(status="stale", scanned_at_utc=collected,
                           end_date=min(payload["end_date"], old_summary.get("end_date") or previous.get("end_date") or payload["end_date"]),
                           offers=len(recovered),
                           return_offers=sum(len(item.get("return_offers", [])) for item in recovered))
        else:
            summary["scanned_at_utc"] = None
    payload["offer_count"] = len(payload["offers"])
    payload["return_offer_count"] = sum(len(item.get("return_offers", [])) for item in payload["offers"])
    return payload
