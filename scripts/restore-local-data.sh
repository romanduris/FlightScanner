#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
patch_file=$(mktemp)
trap 'rm -f "$patch_file"' EXIT
gzip -dc recovery/local-data-2026-09-16.patch.gz > "$patch_file"
if git apply --reverse --check "$patch_file" 2>/dev/null; then
  printf 'Saved local scan changes are already present.\n'
  exit 0
fi
if ! git diff --quiet HEAD -- Data/airlines.json Data/destinations_2026_09.json; then
  printf 'Existing local data changes differ from the backup; nothing was overwritten.\n' >&2
  exit 1
fi
git apply --check "$patch_file"
git apply "$patch_file"
printf 'Restored local scan changes from 2026-09-16 (intentionally uncommitted).\n'
