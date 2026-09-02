#!/usr/bin/env python3
"""Obnoví zdrojové dáta, ceny letov a dáta HTML dashboardu."""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_SCAN_DAYS = 30


def positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("hodnota musí byť celé číslo") from error
    if number < 1:
        raise argparse.ArgumentTypeError("hodnota musí byť aspoň 1")
    return number


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Kompletne aktualizuje FlightScanner dashboard."
    )
    parser.add_argument(
        "--days",
        type=positive_int,
        default=DEFAULT_SCAN_DAYS,
        help=f"Počet dní skenovaných od dneška (predvolene {DEFAULT_SCAN_DAYS}).",
    )
    parser.add_argument(
        "--workers",
        type=positive_int,
        default=4,
        help="Počet paralelných požiadaviek providerov (predvolene 4).",
    )
    return parser.parse_args()


def run_step(label: str, command: list[str]) -> None:
    print(f"\n=== {label} ===", flush=True)
    subprocess.run(command, cwd=PROJECT_DIR, check=True)


def main() -> int:
    args = parse_args()
    today = datetime.now(timezone.utc).date()
    output_file = (
        PROJECT_DIR
        / "Data"
        / f"destinations_{today.year:04d}_{today.month:02d}.json"
    )

    try:
        run_step(
            "1/3 Obnova aeroliniek a destinácií",
            [sys.executable, str(PROJECT_DIR / "1.ListOfAirlines.py")],
        )
        run_step(
            f"2/3 Sken cien na najbližších {args.days} dní",
            [
                sys.executable,
                str(PROJECT_DIR / "2.Destination.py"),
                "--days",
                str(args.days),
                "--workers",
                str(args.workers),
            ],
        )
        run_step(
            "3/3 Generovanie dát dashboardu",
            [
                sys.executable,
                str(PROJECT_DIR / "3.GenerateDashboard.py"),
                "--data",
                str(output_file),
            ],
        )
    except subprocess.CalledProcessError as error:
        print(
            f"\nAktualizácia zlyhala v kroku s návratovým kódom {error.returncode}.",
            file=sys.stderr,
        )
        return error.returncode or 1

    print("\nDashboard je úspešne aktualizovaný: HTML/index.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
