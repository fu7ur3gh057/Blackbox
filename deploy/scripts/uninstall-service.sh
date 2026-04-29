#!/usr/bin/env bash
# Thin wrapper: ensure venv, then hand off to setup.py for systemd uninstall.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -x .venv/bin/python ]; then
    echo "  creating venv..."
    python3 -m venv .venv >/dev/null
    .venv/bin/pip install -q --upgrade pip
    .venv/bin/pip install -q -r requirements.txt
fi

exec .venv/bin/python "$SCRIPT_DIR/setup.py" --uninstall-service "$@"
