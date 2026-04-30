SHELL := /bin/bash
PYTHON := python3
VENV := .venv
PIP := $(VENV)/bin/pip
PY := $(VENV)/bin/python
CONFIG := config.yaml
SERVICE := blackbox
UNIT_PATH := /etc/systemd/system/$(SERVICE).service
CLIENT_DIR := client

.PHONY: help setup install run run-web ensure-node client-install client-dev client-build client-clean install-service uninstall-service install-cli uninstall-cli start stop restart status logs clean

help:
	@echo "BlackBox — targets:"
	@echo "  make setup              интерактивная настройка (config.yaml + опц. systemd)"
	@echo "  make install            создать venv и поставить зависимости"
	@echo "  make run                воркер в foreground (нужен $(CONFIG))"
	@echo "  make run-web            воркер + FastAPI на 127.0.0.1:8765"
	@echo ""
	@echo "  make client-install     поставить npm-зависимости фронта"
	@echo "  make client-dev         запустить Next.js dev-сервер (proxy на бэк)"
	@echo "  make client-build       собрать статику в client/out (бэк её отдаёт)"
	@echo "  make client-clean       снести client/.next и client/out"
	@echo ""
	@echo "  make install-service    поставить systemd-юнит (sudo)"
	@echo "  make uninstall-service  остановить и удалить systemd-юнит (sudo)"
	@echo "  make install-cli        поставить глобальную команду 'blackbox' в ~/.local/bin"
	@echo "  make uninstall-cli      удалить глобальную команду"
	@echo "  make start | stop | restart | status | logs"
	@echo "  make clean              убрать venv и __pycache__"

$(VENV):
	@bash -c '. deploy/scripts/_bootstrap.sh && ensure_venv "$$PWD"'

install: $(VENV)

setup:
	@bash deploy/scripts/setup.sh

run: install
	@if [ ! -f $(CONFIG) ]; then echo "$(CONFIG) не найден — запусти 'make setup'"; exit 1; fi
	PYTHONPATH=src $(PY) -m main $(CONFIG)

run-web: install
	@if [ ! -f $(CONFIG) ]; then echo "$(CONFIG) не найден — запусти 'make setup'"; exit 1; fi
	PYTHONPATH=src $(PY) -m main $(CONFIG) --web

# ── client (Next.js) ─────────────────────────────────────────────────────

# Auto-install Node.js >= 18 if missing (NodeSource on apt/dnf, distro repo
# on pacman/apk). No-op when Node is already present.
ensure-node:
	@bash -c '. deploy/scripts/_bootstrap.sh && ensure_node'

# pnpm preferred, fall back to npm — resolved at recipe runtime so the
# detection picks up Node that was just installed by `ensure-node`.
PKG_LOOKUP := PKG=$$(command -v pnpm 2>/dev/null || command -v npm 2>/dev/null); \
	if [ -z "$$PKG" ]; then echo "neither pnpm nor npm found"; exit 1; fi

client-install: ensure-node
	@$(PKG_LOOKUP); cd $(CLIENT_DIR) && $$PKG install

client-dev: ensure-node
	@$(PKG_LOOKUP); cd $(CLIENT_DIR) && $$PKG run dev

# `client-build` syncs deps automatically — both when node_modules is
# missing AND when package.json / package-lock.json have been touched
# more recently (e.g. `git pull` brought in new dependencies). Without
# the second check, `make client-build` after a pull silently builds
# against stale node_modules and fails with "Can't resolve …" errors.
client-build: ensure-node
	@$(PKG_LOOKUP); \
	NM=$(CLIENT_DIR)/node_modules; \
	PJ=$(CLIENT_DIR)/package.json; \
	PL=$(CLIENT_DIR)/package-lock.json; \
	NEEDS_INSTALL=0; \
	if [ ! -d $$NM ]; then NEEDS_INSTALL=1; \
	elif [ $$PJ -nt $$NM ]; then NEEDS_INSTALL=1; \
	elif [ -f $$PL ] && [ $$PL -nt $$NM ]; then NEEDS_INSTALL=1; \
	fi; \
	if [ $$NEEDS_INSTALL = 1 ]; then \
		echo "  dependencies out of sync — running $$PKG install..."; \
		cd $(CLIENT_DIR) && $$PKG install; cd ..; \
	fi; \
	cd $(CLIENT_DIR) && $$PKG run build

client-clean:
	rm -rf $(CLIENT_DIR)/.next $(CLIENT_DIR)/out

# ── service ──────────────────────────────────────────────────────────────

install-service:
	@bash deploy/scripts/install-service.sh

uninstall-service:
	@bash deploy/scripts/uninstall-service.sh

install-cli:
	@bash deploy/scripts/install-cli.sh

uninstall-cli:
	@rm -f $(HOME)/.local/bin/blackbox && echo "removed: $(HOME)/.local/bin/blackbox"

# Graceful start/stop/restart — check unit exists first
start:
	@if [ -f $(UNIT_PATH) ]; then sudo systemctl start $(SERVICE); else echo "$(SERVICE).service не установлен — запусти 'make install-service'"; fi
stop:
	@if [ -f $(UNIT_PATH) ]; then sudo systemctl stop $(SERVICE); else echo "$(SERVICE).service не установлен — нечего останавливать"; fi
restart:
	@if [ -f $(UNIT_PATH) ]; then sudo systemctl restart $(SERVICE); else echo "$(SERVICE).service не установлен — запусти 'make install-service'"; fi
status:
	@if [ -f $(UNIT_PATH) ]; then systemctl status $(SERVICE) --no-pager; else echo "$(SERVICE).service не установлен"; fi
logs:
	@if [ -f $(UNIT_PATH) ]; then sudo journalctl -u $(SERVICE) -f; else echo "$(SERVICE).service не установлен"; fi

clean:
	rm -rf $(VENV)
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
