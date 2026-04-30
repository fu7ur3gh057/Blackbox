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


# Ensure Node.js >= 18 is available for the web client build.
#
# Returns 0 on success, 1 if Node is unavailable AND we couldn't auto-install
# (no sudo, unknown distro). The caller decides whether to abort or continue
# with a warning — by default we don't block the wizard, since the daemon
# runs fine without the client (the / route just shows a placeholder).
ensure_node() {
    if command -v node >/dev/null 2>&1; then
        local ver
        ver=$(node --version 2>/dev/null | sed 's/^v//;s/\..*//')
        if [ -n "$ver" ] && [ "$ver" -ge 18 ] 2>/dev/null; then
            return 0
        fi
        echo "  node $(node --version) is too old, need >= 18" >&2
    fi

    local SUDO=""
    if [ "$(id -u)" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then
            SUDO="sudo"
        else
            cat >&2 <<'EOF'

Node.js >= 18 is required for the web client and was not found.
Install manually, then re-run:

  Debian/Ubuntu:
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt install -y nodejs

  RHEL/Fedora:
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs

  Arch:    sudo pacman -S --noconfirm nodejs npm
  Alpine:  sudo apk add --no-cache nodejs npm

EOF
            return 1
        fi
    fi

    echo "  Node.js missing — installing..."

    if command -v apt-get >/dev/null 2>&1; then
        if ! command -v curl >/dev/null 2>&1; then
            $SUDO apt-get update -qq >/dev/null 2>&1 || true
            $SUDO apt-get install -y -qq curl ca-certificates >/dev/null 2>&1 || true
        fi
        if curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | $SUDO -E bash - >/dev/null 2>&1 \
           && $SUDO apt-get install -y -qq nodejs >/dev/null 2>&1; then
            echo "  ✓ installed node $(node --version 2>/dev/null)"
            return 0
        fi

    elif command -v dnf >/dev/null 2>&1; then
        if curl -fsSL https://rpm.nodesource.com/setup_20.x 2>/dev/null | $SUDO bash - >/dev/null 2>&1 \
           && $SUDO dnf install -y nodejs >/dev/null 2>&1; then
            echo "  ✓ installed node $(node --version 2>/dev/null)"
            return 0
        fi
    elif command -v yum >/dev/null 2>&1; then
        if curl -fsSL https://rpm.nodesource.com/setup_20.x 2>/dev/null | $SUDO bash - >/dev/null 2>&1 \
           && $SUDO yum install -y nodejs >/dev/null 2>&1; then
            echo "  ✓ installed node $(node --version 2>/dev/null)"
            return 0
        fi

    elif command -v pacman >/dev/null 2>&1; then
        if $SUDO pacman -Sy --noconfirm nodejs npm >/dev/null 2>&1; then
            echo "  ✓ installed node $(node --version 2>/dev/null)"
            return 0
        fi

    elif command -v apk >/dev/null 2>&1; then
        if $SUDO apk add --no-cache nodejs npm >/dev/null 2>&1; then
            echo "  ✓ installed node $(node --version 2>/dev/null)"
            return 0
        fi
    fi

    cat >&2 <<'EOF'

Failed to auto-install Node.js. Install it manually with your package
manager, then re-run. The client build will be skipped this run; the
daemon will still start (you'll see a placeholder page until the bundle
is built).

EOF
    return 1
}
