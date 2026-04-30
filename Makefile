SHELL := /bin/bash
PYTHON := python3
VENV := .venv
PIP := $(VENV)/bin/pip
PY := $(VENV)/bin/python
CONFIG := config.yaml
SERVICE := blackbox
UNIT_PATH := /etc/systemd/system/$(SERVICE).service

.PHONY: help setup install run run-web install-service uninstall-service install-cli uninstall-cli start stop restart status logs clean

help:
	@echo "BlackBox — targets:"
	@echo "  make setup              интерактивная настройка (config.yaml + опц. systemd)"
	@echo "  make install            создать venv и поставить зависимости"
	@echo "  make run                воркер в foreground (нужен $(CONFIG))"
	@echo "  make run-web            воркер + FastAPI на 127.0.0.1:8765"
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
