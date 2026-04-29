#!/usr/bin/env bash
# Thin bootstrap: ensure venv + deps in sync, then hand off to the Python wizard.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -x .venv/bin/python ]; then
    echo "  creating venv..."
    python3 -m venv .venv >/dev/null
fi

# always sync deps (idempotent, fast when nothing changed)
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

exec .venv/bin/python "$SCRIPT_DIR/setup.py" "$@"
