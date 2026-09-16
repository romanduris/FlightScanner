#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci --prefix contact-worker
if ! command -v codex >/dev/null 2>&1; then
  npm install --global @openai/codex
fi
codex_home=${CODEX_HOME:-"$HOME/.codex"}
mkdir -p "$codex_home"
if [ ! -e "$codex_home/config.toml" ]; then
  cp recovery/codex-preferences.toml "$codex_home/config.toml"
fi
bash scripts/restore-local-data.sh
printf '\nWorkspace ready. Read WORKSPACE_HANDOFF.md. Sign into Codex separately.\n'
