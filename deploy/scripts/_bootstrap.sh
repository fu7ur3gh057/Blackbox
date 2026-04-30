#!/usr/bin/env bash
# Sourced by setup.sh / install-service.sh / install-cli.sh / uninstall-service.sh.
# Picks a Python >= 3.10, creates the venv if missing, syncs deps.

ensure_venv() {
    local PROJECT_ROOT="$1"
    local PYTHON=""

    for cand in python3.13 python3.12 python3.11 python3.10; do
        if command -v "$cand" >/dev/null 2>&1; then
            PYTHON="$cand"
            break
        fi
    done

    if [ -z "$PYTHON" ] && command -v python3 >/dev/null 2>&1; then
        if python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then
            PYTHON=python3
        fi
    fi

    if [ -z "$PYTHON" ]; then
        local found
        found=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "none")
        cat >&2 <<EOF

BlackBox requires Python 3.10 or newer, but found: $found

To install on Ubuntu/Debian:
  Ubuntu 22.04+:  sudo apt install -y python3.11 python3.11-venv
  Older systems:  sudo add-apt-repository -y ppa:deadsnakes/ppa
                  sudo apt update
                  sudo apt install -y python3.11 python3.11-venv

Then re-run this command.

EOF
        return 1
    fi

    cd "$PROJECT_ROOT" || return 1

    if [ ! -x .venv/bin/python ]; then
        echo "  creating venv with $PYTHON..."
        if ! "$PYTHON" -m venv .venv; then
            cat >&2 <<EOF

Failed to create venv with $PYTHON. On Debian/Ubuntu install the matching
venv package:
  sudo apt install -y ${PYTHON}-venv

EOF
            return 1
        fi
    fi

    # On some distros (Debian/Ubuntu without python3-venv, or a partially-broken
    # leftover venv), .venv/bin/python exists but pip is missing. Bootstrap it.
    if [ ! -x .venv/bin/pip ]; then
        echo "  bootstrapping pip..."
        if ! .venv/bin/python -m ensurepip --upgrade >/dev/null 2>&1; then
            cat >&2 <<EOF

Venv is missing pip and ensurepip failed. On Debian/Ubuntu install:
  sudo apt install -y ${PYTHON}-venv python3-pip

Then drop the broken venv and retry:
  rm -rf "$PROJECT_ROOT/.venv"

EOF
            return 1
        fi
    fi

    # Use 'python -m pip' instead of '.venv/bin/pip' — works even if the pip
    # entrypoint script is broken or absent but the pip module is importable.
    .venv/bin/python -m pip install -q --upgrade pip
    .venv/bin/python -m pip install -q -r requirements.txt
}
