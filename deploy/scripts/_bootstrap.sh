#!/usr/bin/env bash
# Sourced by setup.sh / install-service.sh / install-cli.sh / uninstall-service.sh.
# Picks a Python >= 3.10, creates the venv if missing, syncs deps.
#
# Every install action is preceded by a confirm prompt with an honest
# disk-size estimate. Set BLACKBOX_YES=1 to skip all prompts (CI / --yes
# style automation).


# ── prompt helpers ────────────────────────────────────────────────────


_bb_color() {
    # Colors only when stdout is a TTY — keeps logs clean.
    if [ -t 1 ]; then
        case "$1" in
            cyan)   printf '\033[36m';;
            yellow) printf '\033[33m';;
            green)  printf '\033[32m';;
            dim)    printf '\033[2m';;
            bold)   printf '\033[1m';;
            reset)  printf '\033[0m';;
        esac
    fi
}


# Pretty-print one install step before asking the user to confirm.
# Args: 1=label, 2=size estimate (e.g. "~80 MB"), 3=details
_bb_install_card() {
    local label="$1" size="$2" detail="$3"
    printf '\n  %s%s%s' "$(_bb_color cyan)" "$label" "$(_bb_color reset)"
    printf '   %s%s%s\n' "$(_bb_color dim)" "$size" "$(_bb_color reset)"
    if [ -n "$detail" ]; then
        printf '  %s%s%s\n' "$(_bb_color dim)" "$detail" "$(_bb_color reset)"
    fi
}


# Yes/No confirm. Default Yes — Enter alone proceeds. BLACKBOX_YES=1 skips.
# Returns 0 on yes / 1 on no.
_bb_confirm() {
    local prompt="$1"
    if [ "${BLACKBOX_YES:-}" = "1" ]; then
        printf '  %s [Y/n] auto-yes (BLACKBOX_YES=1)\n' "$prompt"
        return 0
    fi
    if [ ! -t 0 ]; then
        # No interactive stdin — proceed silently; install scripts shouldn't
        # block in CI when running via `bash <(curl ...)` either.
        printf '  %s [Y/n] auto-yes (non-interactive stdin)\n' "$prompt"
        return 0
    fi
    local reply
    printf '  %s %s[Y/n]%s ' "$prompt" "$(_bb_color dim)" "$(_bb_color reset)"
    read -r reply </dev/tty
    case "$reply" in
        ""|y|Y|yes|YES) return 0 ;;
        *)              return 1 ;;
    esac
}


# Same as _bb_confirm but DEFAULT NO — for destructive operations.
_bb_confirm_destructive() {
    local prompt="$1"
    if [ "${BLACKBOX_YES:-}" = "1" ]; then
        printf '  %s [y/N] auto-yes (BLACKBOX_YES=1)\n' "$prompt"
        return 0
    fi
    if [ ! -t 0 ]; then
        printf '  %s [y/N] declined (non-interactive)\n' "$prompt"
        return 1
    fi
    local reply
    printf '  %s %s[y/N]%s ' "$prompt" "$(_bb_color dim)" "$(_bb_color reset)"
    read -r reply </dev/tty
    case "$reply" in
        y|Y|yes|YES) return 0 ;;
        *)           return 1 ;;
    esac
}


# ── Python venv + deps ────────────────────────────────────────────────


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
        _bb_install_card \
            "Python venv ($PYTHON)" \
            "~50 MB" \
            "creates ./.venv with isolated interpreter + pip"
        if ! _bb_confirm "create venv now?"; then
            echo "  declined — re-run when ready" >&2
            return 1
        fi
        echo "  creating venv..."
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

    # Sync Python deps. Only ask if the install actually has work to do
    # (saves the operator from confirming a 1-second no-op every run).
    if .venv/bin/python -m pip install --dry-run -q -r requirements.txt 2>/dev/null \
       | grep -q "^Would install"; then
        _bb_install_card \
            "Python dependencies" \
            "~80 MB" \
            "fastapi, sqlmodel, taskiq, psutil, bcrypt, pyjwt, …"
        if ! _bb_confirm "install / update them?"; then
            echo "  declined — daemon may not start without these" >&2
            return 1
        fi
    fi
    .venv/bin/python -m pip install -q --upgrade pip
    .venv/bin/python -m pip install -q -r requirements.txt
}


# ── Node.js bootstrap ─────────────────────────────────────────────────


# Ensure Node.js >= 18 is available for the web client build.
# Returns 0 on success / 1 if unavailable and not auto-installable.
ensure_node() {
    if command -v node >/dev/null 2>&1; then
        local ver
        ver=$(node --version 2>/dev/null | sed 's/^v//;s/\..*//')
        if [ -n "$ver" ] && [ "$ver" -ge 18 ] 2>/dev/null; then
            return 0
        fi
        echo "  node $(node --version) is too old, need >= 18" >&2
    fi

    # Build a prefix that's either empty (we're already root) or
    # `sudo -E` (preserve env for NodeSource setup script).
    local RUN=""
    if [ "$(id -u)" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then
            RUN="sudo -E"
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

    _bb_install_card \
        "Node.js 20 LTS" \
        "~50 MB system-wide" \
        "from NodeSource (apt/dnf) or distro repo — needed to build the web client"
    if ! _bb_confirm "install now?"; then
        echo "  declined — client build will be skipped, the daemon still starts (placeholder UI)" >&2
        return 1
    fi
    echo "  installing..."

    # Each branch streams stderr/stdout straight to the user.
    if command -v apt-get >/dev/null 2>&1; then
        if ! command -v curl >/dev/null 2>&1; then
            echo "  installing curl + ca-certificates..."
            $RUN apt-get update -qq || true
            $RUN apt-get install -y -qq curl ca-certificates || true
        fi
        if curl -fsSL https://deb.nodesource.com/setup_20.x | $RUN bash -; then
            if $RUN apt-get install -y nodejs; then
                echo "  ✓ installed node $(node --version 2>/dev/null)"
                return 0
            fi
        fi
        echo "  NodeSource failed; falling back to distro repo (older Node)..."
        $RUN apt-get update -qq || true
        if $RUN apt-get install -y nodejs npm; then
            echo "  ✓ installed node $(node --version 2>/dev/null) (distro)"
            return 0
        fi

    elif command -v dnf >/dev/null 2>&1; then
        if curl -fsSL https://rpm.nodesource.com/setup_20.x | $RUN bash - \
           && $RUN dnf install -y nodejs; then
            echo "  ✓ installed node $(node --version 2>/dev/null)"
            return 0
        fi
        $RUN dnf install -y nodejs npm && {
            echo "  ✓ installed node $(node --version 2>/dev/null) (distro)"
            return 0
        }
    elif command -v yum >/dev/null 2>&1; then
        if curl -fsSL https://rpm.nodesource.com/setup_20.x | $RUN bash - \
           && $RUN yum install -y nodejs; then
            echo "  ✓ installed node $(node --version 2>/dev/null)"
            return 0
        fi

    elif command -v pacman >/dev/null 2>&1; then
        if $RUN pacman -Sy --noconfirm nodejs npm; then
            echo "  ✓ installed node $(node --version 2>/dev/null)"
            return 0
        fi

    elif command -v apk >/dev/null 2>&1; then
        if $RUN apk add --no-cache nodejs npm; then
            echo "  ✓ installed node $(node --version 2>/dev/null)"
            return 0
        fi
    fi

    cat >&2 <<'EOF'

Failed to auto-install Node.js. The error is above; install Node manually
with your package manager and re-run. The client build will be skipped
this run; the daemon still starts (you'll see a placeholder page until
the bundle is built).

EOF
    return 1
}
