#!/usr/bin/env bash
# Thin bootstrap: ensure venv + deps in sync, then hand off to the Python wizard.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=_bootstrap.sh
. "$SCRIPT_DIR/_bootstrap.sh"
ensure_venv "$PROJECT_ROOT" || exit 1

exec .venv/bin/python "$SCRIPT_DIR/setup.py" "$@"
