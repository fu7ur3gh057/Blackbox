SHELL := /bin/bash
PYTHON := python3
VENV := .venv
PIP := $(VENV)/bin/pip
PY := $(VENV)/bin/python
CONFIG := config.yaml
SERVICE := blackbox
UNIT_PATH := /etc/systemd/system/$(SERVICE).service

.PHONY: help setup install run install-service uninstall-service install-cli uninstall-cli start stop restart status logs clean

help:
	@echo "BlackBox — targets:"
	@echo "  make setup              интерактивная настройка (config.yaml + опц. systemd)"
	@echo "  make install            создать venv и поставить зависимости"
	@echo "  make run                запустить в foreground (нужен $(CONFIG))"
	@echo "  make install-service    поставить systemd-юнит (sudo)"
	@echo "  make uninstall-service  остановить и удалить systemd-юнит (sudo)"
	@echo "  make install-cli        поставить глобальную команду 'blackbox' в ~/.local/bin"
	@echo "  make uninstall-cli      удалить глобальную команду"
	@echo "  make start | stop | restart | status | logs"
	@echo "  make clean              убрать venv и __pycache__"

$(VENV):
	$(PYTHON) -m venv $(VENV)
	$(PIP) install -q --upgrade pip
	$(PIP) install -q -r requirements.txt

install: $(VENV)

setup:
	@bash deploy/scripts/setup.sh

run: install
	@if [ ! -f $(CONFIG) ]; then echo "$(CONFIG) не найден — запусти 'make setup'"; exit 1; fi
	$(PY) -m src.main $(CONFIG)

install-service:
	@bash deploy/scripts/install-service.sh

uninstall-service:
	@bash deploy/scripts/uninstall-service.sh

install-cli:
	@bash deploy/scripts/install-cli.sh

uninstall-cli:
	@rm -f $(HOME)/.local/bin/blackbox && echo "removed: $(HOME)/.local/bin/blackbox"

# start/stop/restart graceful — проверяем что юнит установлен
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
