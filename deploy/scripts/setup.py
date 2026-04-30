"""BlackBox interactive setup wizard with dev/service modes and en/ru i18n."""
from __future__ import annotations

import argparse
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import psutil
import questionary
import yaml
from rich.align import Align
from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.spinner import Spinner
from rich.text import Text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONFIG_FILE = PROJECT_ROOT / "config.yaml"
SERVICE_NAME = "blackbox"
UNIT_PATH = f"/etc/systemd/system/{SERVICE_NAME}.service"

console = Console()

LOGO = "█▄▄ █   ▄▀█ █▀▀ █▄▀ █▄▄ █▀█ ▀▄▀\n█▄█ █▄▄ █▀█ █▄▄ █ █ █▄█ █▄█ █ █"

# ── i18n ────────────────────────────────────────────────────────────────────

LOCALES: dict[str, dict[str, str]] = {
    "en": {
        "subtitle": "⬛  server monitoring → telegram",
        "lang_q": "Language / Язык",
        "menu_title": "Choose action",
        "menu_dev": "run in dev mode (foreground)",
        "menu_service": "install as systemd service",
        "menu_edit": "edit config (re-run wizard)",
        "menu_exit": "exit",
        "config_found": "config found: {path}",
        "config_missing": "no config yet — we'll create one",
        "section_tg": "Telegram",
        "section_host": "Host",
        "section_disks": "Disks",
        "section_docker": "Docker compose",
        "section_writing": "Writing",
        "section_service": "Systemd service",
        "ask_bot_token": "bot token",
        "ask_chat_id": "chat id",
        "ask_proxy_yn": "use SOCKS5 proxy for Telegram?",
        "ask_proxy_host": "  proxy host",
        "ask_proxy_port": "  proxy port",
        "ask_proxy_user": "  proxy user (empty if none)",
        "ask_proxy_pass": "  proxy password (empty if none)",
        "have_tg_creds": "found existing Telegram setup: chat_id={chat_id}{proxy}",
        "ask_keep_tg_creds": "keep current bot token and chat id?",
        "ask_keep_proxy": "keep current proxy ({proxy})?",
        "ask_hostname": "hostname",
        "ask_check_int": "check interval, sec — how often cpu/mem/disk/systemd run (min 30)",
        "ask_report_int": "report interval, sec — full status digest in TG (min 30)",
        "min_clamp": "value below {minimum}s — clamping to {minimum}s",
        "ask_warn": "warn threshold %",
        "ask_crit": "crit threshold %",
        "ask_disk_paths": "paths (comma-separated)",
        "ask_docker_yn": "monitor docker compose?",
        "ask_compose_path": "compose path (empty = done)",
        "ask_containers": "containers (csv, empty = all)",
        "ask_starred": "starred (csv, empty = none)",
        "step_detecting": "detecting running compose projects",
        "docker_none_found": "no running compose projects detected — falling back to manual entry",
        "docker_pick_projects": "Which compose projects to monitor?",
        "docker_custom_path": "+ add path manually",
        "docker_pick_containers": "Containers to watch in '{project}'",
        "docker_pick_starred": "Star ⭐ which? (optional)",
        "docker_hint": "[space] toggle  [enter] confirm  [a] toggle all",
        "step_detect_disks": "detecting mounted disks",
        "disks_pick": "Which disks to monitor?",
        "disks_custom": "+ add path manually",
        "disks_custom_input": "additional paths (csv, empty = none)",
        "section_net": "Network",
        "step_detect_net": "detecting network interfaces",
        "net_pick": "Which interfaces to track for traffic?",
        "net_none": "no interfaces detected, will sum all",
        "section_systemd": "Systemd units",
        "ask_systemd_yn": "monitor systemd services?",
        "step_detect_systemd": "detecting running services",
        "systemd_pick": "Which services to alert on if they go down?",
        "systemd_none": "no user services detected",
        "section_web": "Web client (FastAPI)",
        "ask_web_yn": "expose the web client (Swagger + admin API)?",
        "ask_web_port": "  port",
        "ask_web_username": "  admin username",
        "ask_web_password": "  admin password (8+ chars)",
        "ask_web_password_confirm": "  repeat password",
        "ask_web_keep_user": "found existing admin user '{username}' — keep current password?",
        "web_password_short": "password too short, min 8 chars — try again",
        "web_password_mismatch": "passwords don't match — try again",
        "step_client_install": "installing client deps (npm)",
        "step_client_build":   "building client bundle (next build)",
        "step_restart_service": "restarting blackbox.service",
        "client_pkg_missing": "node/npm not found — skip client build (install Node 20+ then run `make client-build`)",
        "client_build_skipped": "client/ folder missing — skip build",
        "client_build_failed": "client build failed — re-run `make client-build` after fixing the error above",
        "web_url_hint": "after start: http://<vps-ip>:{port}/blackbox/api/docs",
        "web_summary_header": "Web client URLs (paste into browser):",
        "web_summary_swagger": "  Swagger UI:   {url}",
        "web_summary_redoc":   "  ReDoc:        {url}",
        "web_summary_openapi": "  OpenAPI JSON: {url}",
        "web_summary_health":  "  Healthcheck:  {url}",
        "web_summary_login":   "  login as:     {username}",
        "web_summary_firewall": "if it doesn't open — open port {port} in your VPS firewall (ufw allow {port}, or your provider's panel)",
        "warn_not_found": "{path} not found, including anyway",
        "step_backup": "backing up to {name}",
        "step_write": "writing config.yaml",
        "step_venv": "creating venv",
        "step_deps": "installing dependencies",
        "step_unit": "writing systemd unit",
        "step_reload": "systemctl daemon-reload",
        "step_enable": "enable + start blackbox",
        "section_uninstall": "Uninstall systemd service",
        "no_service": "service is not installed",
        "confirm_uninstall": "stop and remove systemd unit?",
        "step_disable": "stop + disable blackbox",
        "step_remove_unit": "removing unit file",
        "service_removed": "service stopped and removed",
        "starting_dev": "starting BlackBox (Ctrl+C to stop)",
        "confirm_install": "proceed with install?",
        "service_done": "service installed and started",
        "logs_hint": "logs:    make logs",
        "status_hint": "status:  make status",
        "no_config": "config.yaml missing — run wizard first",
        "bye": "bye",
        "aborted": "aborted",
        "choice": "choice",
    },
    "ru": {
        "subtitle": "⬛  мониторинг сервера → telegram",
        "lang_q": "Язык / Language",
        "menu_title": "Что делаем",
        "menu_dev": "запустить в dev-режиме (foreground)",
        "menu_service": "поставить как systemd-сервис",
        "menu_edit": "переписать конфиг (мастер заново)",
        "menu_exit": "выход",
        "config_found": "найден конфиг: {path}",
        "config_missing": "конфига ещё нет — создадим",
        "section_tg": "Telegram",
        "section_host": "Хост",
        "section_disks": "Диски",
        "section_docker": "Docker compose",
        "section_writing": "Запись",
        "section_service": "Systemd-сервис",
        "ask_bot_token": "токен бота",
        "ask_chat_id": "chat id",
        "ask_proxy_yn": "использовать SOCKS5-прокси для Telegram?",
        "ask_proxy_host": "  хост прокси",
        "ask_proxy_port": "  порт прокси",
        "ask_proxy_user": "  юзер прокси (пусто если без авторизации)",
        "ask_proxy_pass": "  пароль прокси (пусто если без авторизации)",
        "have_tg_creds": "найдены данные Telegram: chat_id={chat_id}{proxy}",
        "ask_keep_tg_creds": "оставить текущий токен и chat id?",
        "ask_keep_proxy": "оставить текущий прокси ({proxy})?",
        "ask_hostname": "hostname",
        "ask_check_int": "интервал проверок, сек — как часто запускать cpu/mem/disk/systemd (мин. 30)",
        "ask_report_int": "интервал репорта, сек — полный отчёт в TG (мин. 30)",
        "min_clamp": "значение меньше {minimum}с — округляю до {minimum}с",
        "ask_warn": "warn порог %",
        "ask_crit": "crit порог %",
        "ask_disk_paths": "пути (через запятую)",
        "ask_docker_yn": "мониторить docker compose?",
        "ask_compose_path": "путь к compose (пусто = готово)",
        "ask_containers": "контейнеры (csv, пусто = все)",
        "ask_starred": "избранные (csv, пусто = нет)",
        "step_detecting": "ищу запущенные compose-проекты",
        "docker_none_found": "запущенных compose-проектов не найдено — переходим к ручному вводу",
        "docker_pick_projects": "Какие compose-проекты мониторим?",
        "docker_custom_path": "+ добавить путь вручную",
        "docker_pick_containers": "Контейнеры для мониторинга в '{project}'",
        "docker_pick_starred": "Какие пометить ⭐? (опционально)",
        "docker_hint": "[пробел] выбор  [enter] подтвердить  [a] все",
        "step_detect_disks": "ищу примонтированные диски",
        "disks_pick": "Какие диски мониторим?",
        "disks_custom": "+ добавить путь вручную",
        "disks_custom_input": "доп. пути (csv, пусто = нет)",
        "section_net": "Сеть",
        "step_detect_net": "ищу сетевые интерфейсы",
        "net_pick": "По каким интерфейсам считать трафик?",
        "net_none": "интерфейсов не найдено, буду считать все",
        "section_systemd": "Systemd-сервисы",
        "ask_systemd_yn": "мониторить systemd-сервисы?",
        "step_detect_systemd": "ищу запущенные сервисы",
        "systemd_pick": "Какие сервисы алертить при падении?",
        "systemd_none": "пользовательских сервисов не найдено",
        "section_web": "Веб-клиент (FastAPI)",
        "ask_web_yn": "поднимать веб-клиент (Swagger + admin API)?",
        "ask_web_port": "  порт",
        "ask_web_username": "  логин админа",
        "ask_web_password": "  пароль админа (8+ символов)",
        "ask_web_password_confirm": "  повтори пароль",
        "ask_web_keep_user": "найден админ '{username}' — оставить текущий пароль?",
        "web_password_short": "слишком короткий пароль (минимум 8 символов) — попробуй ещё",
        "web_password_mismatch": "пароли не совпадают — попробуй ещё",
        "step_client_install": "ставлю зависимости фронта (npm)",
        "step_client_build":   "собираю фронт (next build)",
        "step_restart_service": "рестартую blackbox.service",
        "client_pkg_missing": "node/npm не найден — пропускаю сборку (поставь Node 20+ и запусти `make client-build`)",
        "client_build_skipped": "папка client/ не найдена — пропускаю сборку",
        "client_build_failed": "сборка фронта упала — после фикса ошибки выше запусти `make client-build`",
        "web_url_hint": "после старта: http://<ip-впс>:{port}/blackbox/api/docs",
        "web_summary_header": "URL'ы веб-клиента (вставь в браузер):",
        "web_summary_swagger": "  Swagger UI:   {url}",
        "web_summary_redoc":   "  ReDoc:        {url}",
        "web_summary_openapi": "  OpenAPI JSON: {url}",
        "web_summary_health":  "  Healthcheck:  {url}",
        "web_summary_login":   "  логин:        {username}",
        "web_summary_firewall": "если не открывается — открой порт {port} в фаерволе VPS (ufw allow {port} или в панели хостера)",
        "warn_not_found": "{path} не найден, добавляю всё равно",
        "step_backup": "бэкаплю в {name}",
        "step_write": "пишу config.yaml",
        "step_venv": "создаю venv",
        "step_deps": "ставлю зависимости",
        "step_unit": "пишу systemd-юнит",
        "step_reload": "systemctl daemon-reload",
        "step_enable": "enable + запуск blackbox",
        "section_uninstall": "Удаление systemd-сервиса",
        "no_service": "сервис не установлен",
        "confirm_uninstall": "остановить и удалить юнит?",
        "step_disable": "stop + disable blackbox",
        "step_remove_unit": "удаляю unit-файл",
        "service_removed": "сервис остановлен и удалён",
        "starting_dev": "запускаю BlackBox (Ctrl+C чтобы остановить)",
        "confirm_install": "ставим?",
        "service_done": "сервис установлен и запущен",
        "logs_hint": "логи:    make logs",
        "status_hint": "статус:  make status",
        "no_config": "config.yaml не найден — сначала запусти мастер",
        "bye": "пока",
        "aborted": "прервано",
        "choice": "выбор",
    },
}

LANG = "en"


def t(key: str, **kwargs) -> str:
    s = LOCALES[LANG].get(key, key)
    return s.format(**kwargs) if kwargs else s


def detect_lang() -> str:
    env = (os.environ.get("BLACKBOX_LANG") or os.environ.get("LANG", "")).lower()
    return "ru" if env.startswith("ru") else "en"


# ── UI helpers ──────────────────────────────────────────────────────────────

def banner() -> None:
    console.print(Align.center(Text(LOGO, style="bold white")))
    console.print(Align.center(Text(t("subtitle"), style="dim cyan")))
    console.print()


def banner_minimal() -> None:
    console.print(Align.center(Text(LOGO, style="bold white")))
    console.print()


def section(title: str) -> None:
    console.print(f"\n[bold magenta]{title}[/bold magenta]")


def step(label: str, work, delay: float = 0.3):
    spinner = Spinner("dots", text=Text(label, style="cyan"), style="cyan")
    with Live(spinner, console=console, refresh_per_second=12, transient=True):
        result = work()
        time.sleep(delay)
    console.print(f"  [green]✓[/green] {label}")
    return result


def warn_line(msg: str) -> None:
    console.print(f"  [yellow]![/yellow] {msg}")


def _ask_seconds(prompt_key: str, *, default: int, minimum: int) -> int:
    """Ask for an interval in seconds, fall back to `default` on bad input,
    clamp anything below `minimum` to `minimum` (and tell the user why)."""
    raw = Prompt.ask(f"  {t(prompt_key)}", default=str(default))
    try:
        n = int(raw)
    except ValueError:
        n = default
    if n < minimum:
        warn_line(t("min_clamp", minimum=minimum))
        n = minimum
    return n


# ── existing config helpers ─────────────────────────────────────────────────

def _load_existing_telegram() -> dict | None:
    if not CONFIG_FILE.exists():
        return None
    try:
        raw = yaml.safe_load(CONFIG_FILE.read_text()) or {}
    except Exception:
        return None
    for n in raw.get("notifiers") or []:
        if n.get("type") == "telegram" and n.get("bot_token") and n.get("chat_id"):
            return n
    return None


def _mask_proxy(url: str) -> str:
    """socks5h://user:pass@host:port -> socks5h://user:***@host:port"""
    import re as _re
    return _re.sub(r"(://[^:@/]+):[^@]*(@)", r"\1:***\2", url) or url


def _ask_proxy() -> str:
    p_host = Prompt.ask(t("ask_proxy_host"))
    p_port = Prompt.ask(t("ask_proxy_port"), default="1080")
    p_user = Prompt.ask(t("ask_proxy_user"), default="", show_default=False)
    p_pass = ""
    if p_user:
        p_pass = Prompt.ask(t("ask_proxy_pass"), default="", show_default=False, password=True)
    if p_user:
        return f"socks5h://{p_user}:{p_pass}@{p_host}:{p_port}"
    return f"socks5h://{p_host}:{p_port}"


def _gather_telegram() -> tuple[str, str, str]:
    """Returns (bot_token, chat_id, proxy_url). Reuses existing values if user opts in."""
    existing = _load_existing_telegram()

    if existing:
        proxy_existing = existing.get("proxy") or ""
        proxy_hint = " + proxy" if proxy_existing else ""
        console.print(f"  [dim italic]{t('have_tg_creds', chat_id=existing['chat_id'], proxy=proxy_hint)}[/dim italic]")

        if Confirm.ask(f"  {t('ask_keep_tg_creds')}", default=True):
            bot_token = existing["bot_token"]
            chat_id = str(existing["chat_id"])

            if proxy_existing:
                masked = _mask_proxy(proxy_existing)
                if Confirm.ask(f"  {t('ask_keep_proxy', proxy=masked)}", default=True):
                    return bot_token, chat_id, proxy_existing
                # User wants to change/remove proxy
                if Confirm.ask(f"  {t('ask_proxy_yn')}", default=False):
                    return bot_token, chat_id, _ask_proxy()
                return bot_token, chat_id, ""

            # No existing proxy — offer to add one
            if Confirm.ask(f"  {t('ask_proxy_yn')}", default=False):
                return bot_token, chat_id, _ask_proxy()
            return bot_token, chat_id, ""

    # Fresh setup or user declined to reuse
    bot_token = Prompt.ask(f"  [bold]{t('ask_bot_token')}[/bold]", password=True)
    chat_id = Prompt.ask(f"  [bold]{t('ask_chat_id')}[/bold]")
    proxy_url = _ask_proxy() if Confirm.ask(f"  {t('ask_proxy_yn')}", default=False) else ""
    return bot_token, chat_id, proxy_url


# ── language ────────────────────────────────────────────────────────────────

def pick_language() -> None:
    global LANG
    default = detect_lang()
    console.print(
        "  [bold cyan]1[/bold cyan])[bold] English[/bold]   "
        "[bold cyan]2[/bold cyan])[bold] Русский[/bold]"
    )
    choice = Prompt.ask(
        f"[bold]{LOCALES[default]['lang_q']}[/bold]",
        choices=["1", "2"],
        default="1" if default == "en" else "2",
        show_choices=False,
    )
    LANG = "en" if choice == "1" else "ru"


# ── menus ───────────────────────────────────────────────────────────────────

def main_menu() -> str:
    if CONFIG_FILE.exists():
        console.print(
            f"[green]✓[/green] {t('config_found', path='').rstrip(': ')}: "
            f"[cyan]{CONFIG_FILE}[/cyan]"
        )
    else:
        console.print(f"[yellow]·[/yellow] [italic dim]{t('config_missing')}[/italic dim]")
    console.print(
        f"  [bold cyan]1[/bold cyan]) [bold]{t('menu_dev')}[/bold]   "
        f"[bold cyan]2[/bold cyan]) [bold]{t('menu_service')}[/bold]   "
        f"[bold cyan]3[/bold cyan]) {t('menu_edit')}   "
        f"[bold cyan]4[/bold cyan]) [dim]{t('menu_exit')}[/dim]"
    )
    choice = Prompt.ask(
        f"[bold]{t('choice')}[/bold]",
        choices=["1", "2", "3", "4"],
        default="1",
        show_choices=False,
    )
    return {"1": "dev", "2": "service", "3": "edit", "4": "exit"}[choice]


# ── wizard ──────────────────────────────────────────────────────────────────

def run_wizard() -> None:
    section(t("section_tg"))
    bot_token, chat_id, proxy_url = _gather_telegram()

    section(t("section_host"))
    hostname = Prompt.ask(f"  {t('ask_hostname')}", default=socket.gethostname())
    check_int = _ask_seconds("ask_check_int", default=60, minimum=30)
    report_int = _ask_seconds("ask_report_int", default=2700, minimum=30)
    warn_pct = Prompt.ask(f"  {t('ask_warn')}", default="80")
    crit_pct = Prompt.ask(f"  {t('ask_crit')}", default="90")

    section(t("section_disks"))
    disks = configure_disks()

    section(t("section_net"))
    net_cfg = configure_network()

    section(t("section_docker"))
    docker_blocks: list[dict] = []
    if Confirm.ask(f"  {t('ask_docker_yn')}", default=False):
        docker_blocks = configure_docker()

    section(t("section_systemd"))
    systemd_units: list[str] = []
    if Confirm.ask(f"  {t('ask_systemd_yn')}", default=False):
        systemd_units = configure_systemd()

    section(t("section_web"))
    web_cfg = configure_web()

    yaml_text = build_yaml(
        bot_token=bot_token, chat_id=chat_id, proxy=proxy_url,
        hostname=hostname,
        check_interval=check_int,
        report_interval=report_int,
        warn_pct=int(warn_pct), crit_pct=int(crit_pct),
        disks=disks, docker_blocks=docker_blocks,
        net_cfg=net_cfg, systemd_units=systemd_units,
        web_cfg=web_cfg,
        notifier_lang=LANG,
    )

    section(t("section_writing"))
    if CONFIG_FILE.exists():
        backup = CONFIG_FILE.with_suffix(".yaml.bak")
        step(t("step_backup", name=backup.name), lambda: shutil.copy(CONFIG_FILE, backup))
    step(t("step_write"), lambda: CONFIG_FILE.write_text(yaml_text))

    # If web was enabled, build the bundle and bounce the service in place.
    # Both are no-ops if the prerequisites aren't met (Node missing, unit
    # not installed yet) — the user can always finish the steps manually.
    build_client_bundle(web_cfg)
    if web_cfg and web_cfg.get("enabled"):
        restart_service_if_installed()

    print_web_summary(web_cfg)


# ── disk detection ─────────────────────────────────────────────────────────

_FS_SKIP = {"squashfs", "iso9660", "tmpfs", "devtmpfs", "overlay"}
_MOUNT_SKIP_PREFIXES = ("/snap/", "/boot/efi", "/var/snap/", "/run/")


def detect_disks() -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for p in psutil.disk_partitions(all=False):
        if p.fstype in _FS_SKIP or not p.fstype:
            continue
        if any(p.mountpoint.startswith(pref) for pref in _MOUNT_SKIP_PREFIXES):
            continue
        if p.mountpoint in seen:
            continue
        try:
            usage = shutil.disk_usage(p.mountpoint)
        except OSError:
            continue
        seen.add(p.mountpoint)
        out.append({
            "mountpoint": p.mountpoint,
            "fstype": p.fstype,
            "total_gb": usage.total / 1024 ** 3,
            "used_pct": (usage.used / usage.total * 100) if usage.total else 0.0,
        })
    return out


def configure_disks() -> list[str]:
    detected = step(t("step_detect_disks"), detect_disks, delay=0.0)

    if not detected:
        disks_input = Prompt.ask(t("ask_disk_paths"), default="/")
        return [d.strip() for d in disks_input.split(",") if d.strip()] or ["/"]

    choices = [
        questionary.Choice(
            title=f"{d['mountpoint']:<20s} {d['total_gb']:>6.1f} GB  "
                  f"{d['used_pct']:>5.1f}% used  ({d['fstype']})",
            value=d["mountpoint"],
            checked=(d["mountpoint"] == "/"),
        )
        for d in detected
    ]
    choices.append(questionary.Choice(title=t("disks_custom"), value=None))

    console.print(f"  [dim]{t('docker_hint')}[/dim]")
    selected = questionary.checkbox(t("disks_pick"), choices=choices).ask() or []

    paths = [s for s in selected if s is not None]
    if None in selected:
        custom = Prompt.ask(t("disks_custom_input"), default="")
        for d in custom.split(","):
            d = d.strip()
            if d:
                paths.append(d)

    return paths or ["/"]


# ── network detection ──────────────────────────────────────────────────────

_NET_SKIP_PREFIXES = ("lo", "docker", "br-", "veth", "virbr", "tun", "tap")


def detect_network_interfaces() -> list[dict]:
    out: list[dict] = []
    try:
        stats = psutil.net_if_stats()
        addrs = psutil.net_if_addrs()
    except Exception:
        return []
    import socket as _s
    for name, st in stats.items():
        if not st.isup:
            continue
        if name.startswith(_NET_SKIP_PREFIXES):
            continue
        ipv4 = next(
            (a.address for a in addrs.get(name, []) if a.family == _s.AF_INET),
            "",
        )
        out.append({"name": name, "speed": st.speed, "ipv4": ipv4})
    return out


def configure_network() -> dict | bool:
    """Returns True (all interfaces), False (skip section), or {interfaces: [...]}"""
    detected = step(t("step_detect_net"), detect_network_interfaces, delay=0.0)
    if not detected:
        warn_line(t("net_none"))
        return True

    choices = [
        questionary.Choice(
            title=f"{d['name']:<10s}  {d['ipv4'] or '(no ipv4)':<16s}  "
                  f"{d['speed']} Mbps" if d["speed"] else f"{d['name']:<10s}  {d['ipv4'] or '(no ipv4)'}",
            value=d["name"],
            checked=True,
        )
        for d in detected
    ]
    console.print(f"  [dim]{t('docker_hint')}[/dim]")
    selected = questionary.checkbox(t("net_pick"), choices=choices).ask() or []
    if not selected:
        return False
    if len(selected) == len(detected):
        return True
    return {"interfaces": selected}


# ── systemd detection ──────────────────────────────────────────────────────

_SYSTEMD_SKIP_PREFIXES = ("systemd-", "user@", "session-")
_SYSTEMD_SKIP_EXACT = {
    "dbus.service", "dbus-broker.service", "polkit.service",
    "wpa_supplicant.service", "ModemManager.service", "NetworkManager.service",
    "rsyslog.service", "cron.service", "snapd.service", "snap.service",
    "accounts-daemon.service", "udisks2.service", "upower.service",
    "avahi-daemon.service", "thermald.service", "irqbalance.service",
    "cups.service", "cups-browsed.service", "bluetooth.service",
    "ssh.service", "sshd.service",  # keep these? leave them in, user may want
}
_SYSTEMD_SKIP_EXACT.discard("ssh.service")
_SYSTEMD_SKIP_EXACT.discard("sshd.service")


def detect_systemd_units() -> list[dict]:
    try:
        proc = subprocess.run(
            ["systemctl", "list-units", "--type=service", "--state=running",
             "--no-legend", "--no-pager", "--plain"],
            capture_output=True, text=True, timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    if proc.returncode != 0:
        return []
    out = []
    for line in proc.stdout.splitlines():
        parts = line.split(None, 4)
        if len(parts) < 4:
            continue
        name = parts[0]
        if not name.endswith(".service"):
            continue
        if name.startswith(_SYSTEMD_SKIP_PREFIXES) or name in _SYSTEMD_SKIP_EXACT:
            continue
        desc = parts[4] if len(parts) > 4 else ""
        out.append({"name": name, "desc": desc})
    return out


def configure_systemd() -> list[str]:
    """Returns list of unit names to monitor."""
    detected = step(t("step_detect_systemd"), detect_systemd_units, delay=0.0)
    if not detected:
        warn_line(t("systemd_none"))
        return []
    choices = [
        questionary.Choice(
            title=f"{u['name']:<30s}  [dim]{u['desc']}[/dim]" if False
                  else f"{u['name']:<30s}  {u['desc']}",
            value=u["name"],
            checked=False,
        )
        for u in detected
    ]
    console.print(f"  [dim]{t('docker_hint')}[/dim]")
    return questionary.checkbox(t("systemd_pick"), choices=choices).ask() or []


# ── web client ─────────────────────────────────────────────────────────────

def configure_web() -> dict | None:
    """Ask whether to expose the web client + create an admin user. Returns
    a dict ready to splice into config.yaml — {enabled, port, user, jwt} —
    or None if the user declines."""
    if not Confirm.ask(f"  {t('ask_web_yn')}", default=False):
        return None
    port_str = Prompt.ask(f"{t('ask_web_port')}", default="8765")
    try:
        port = int(port_str)
    except ValueError:
        port = 8765

    user_block, jwt_block = _gather_web_user()
    console.print(f"  [dim italic]{t('web_url_hint', port=port)}[/dim italic]")
    return {
        "enabled": True,
        "port": port,
        "user": user_block,
        "jwt": jwt_block,
    }


def _gather_web_user() -> tuple[dict, dict]:
    """Returns (user_dict, jwt_dict). Reuses existing creds if present and the
    operator confirms — otherwise hashes a fresh password and rotates the
    JWT secret (which invalidates any existing sessions, intentional)."""
    import bcrypt

    existing = _load_existing_web_user()
    if existing and Confirm.ask(
        f"  {t('ask_web_keep_user', username=existing['user']['username'])}",
        default=True,
    ):
        return existing["user"], existing["jwt"]

    default_user = (existing or {}).get("user", {}).get("username", "admin")
    username = Prompt.ask(f"{t('ask_web_username')}", default=default_user) or "admin"

    while True:
        password = Prompt.ask(f"{t('ask_web_password')}", password=True)
        if len(password) < 8:
            warn_line(t("web_password_short"))
            continue
        confirm = Prompt.ask(f"{t('ask_web_password_confirm')}", password=True)
        if password != confirm:
            warn_line(t("web_password_mismatch"))
            continue
        break

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt(),
    ).decode("utf-8")
    jwt_secret = secrets.token_hex(32)
    return (
        {"username": username, "password_hash": password_hash},
        {"secret": jwt_secret, "expiry_seconds": 7 * 24 * 3600},
    )


def _load_existing_web_user() -> dict | None:
    """Read web.user/jwt from a prior config.yaml so re-runs don't force a
    password reset every time."""
    if not CONFIG_FILE.exists():
        return None
    try:
        raw = yaml.safe_load(CONFIG_FILE.read_text()) or {}
    except Exception:
        return None
    web = raw.get("web") or {}
    user = web.get("user") or {}
    jwt_blk = web.get("jwt") or {}
    if user.get("username") and user.get("password_hash"):
        return {"user": user, "jwt": jwt_blk}
    return None


def detect_public_ip() -> str:
    """Best-effort: ipify for the egress IP, UDP-trick for the local IP,
    'localhost' as last resort. Used to print real URLs after the wizard."""
    import urllib.request

    try:
        req = urllib.request.Request("https://api.ipify.org", headers={"User-Agent": "blackbox-setup"})
        with urllib.request.urlopen(req, timeout=3) as r:
            ip = r.read().decode().strip()
            if ip:
                return ip
    except Exception:
        pass
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "localhost"
    finally:
        s.close()


def build_client_bundle(web_cfg: dict | None) -> None:
    """If web is enabled, install client deps and build the static bundle so
    FastAPI can serve `/blackbox/*` immediately. Skips silently when Node is
    missing or `client/` doesn't exist — falls through with a friendly note,
    we don't want to abort the whole wizard for a Node toolchain issue."""
    if not web_cfg or not web_cfg.get("enabled"):
        return

    client_dir = PROJECT_ROOT / "client"
    if not client_dir.exists() or not (client_dir / "package.json").exists():
        warn_line(t("client_build_skipped"))
        return

    pkg = shutil.which("pnpm") or shutil.which("npm")
    if not pkg:
        warn_line(t("client_pkg_missing"))
        return

    def _install():
        subprocess.run([pkg, "install"], cwd=client_dir, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)

    def _build():
        subprocess.run([pkg, "run", "build"], cwd=client_dir, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)

    try:
        step(t("step_client_install"), _install, delay=0.0)
        step(t("step_client_build"), _build, delay=0.0)
    except subprocess.CalledProcessError:
        warn_line(t("client_build_failed"))


def restart_service_if_installed() -> None:
    """If the systemd unit is already on disk, kick it so the freshly
    built client/out/ and the new config.yaml take effect immediately.
    No-op for first-time installs (the menu's `install service` path
    handles the initial start)."""
    if not Path(UNIT_PATH).exists():
        return
    def _restart():
        subprocess.run(["sudo", "systemctl", "restart", SERVICE_NAME],
                       check=True, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL)
    try:
        step(t("step_restart_service"), _restart, delay=0.0)
    except subprocess.CalledProcessError:
        pass  # missing sudo / unit not enabled — let the operator restart manually


def print_web_summary(web_cfg: dict | None) -> None:
    """Final block of the wizard — paste-ready URLs for the user."""
    if not web_cfg or not web_cfg.get("enabled"):
        return
    port = int(web_cfg.get("port", 8765))
    username = (web_cfg.get("user") or {}).get("username", "admin")
    ip = detect_public_ip()
    base = f"http://{ip}:{port}/blackbox"

    console.print()
    console.print(f"[bold green]{t('web_summary_header')}[/bold green]")
    console.print(t("web_summary_swagger", url=f"[cyan]{base}/api/docs[/cyan]"))
    console.print(t("web_summary_redoc",   url=f"[cyan]{base}/api/redoc[/cyan]"))
    console.print(t("web_summary_openapi", url=f"[cyan]{base}/api/openapi.json[/cyan]"))
    console.print(t("web_summary_health",  url=f"[cyan]{base}/health[/cyan]"))
    console.print(t("web_summary_login",   username=f"[bold cyan]{username}[/bold cyan]"))
    console.print(f"  [dim italic]{t('web_summary_firewall', port=port)}[/dim italic]")


# ── docker detection ───────────────────────────────────────────────────────

def detect_compose_projects() -> list[dict]:
    """Return [{Name, Status, ConfigFiles}, ...] of running compose projects."""
    try:
        result = subprocess.run(
            ["docker", "compose", "ls", "--format", "json"],
            capture_output=True, text=True, timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    if result.returncode != 0:
        return []
    try:
        return json.loads(result.stdout) or []
    except json.JSONDecodeError:
        return []


def list_compose_containers(compose_path: str) -> list[dict]:
    try:
        result = subprocess.run(
            ["docker", "compose", "-f", compose_path, "ps", "--format", "json", "--all"],
            capture_output=True, text=True, timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    if result.returncode != 0:
        return []
    out = result.stdout.strip()
    if not out:
        return []
    if out.startswith("["):
        return json.loads(out)
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def configure_docker() -> list[dict]:
    detected = step(t("step_detecting"), detect_compose_projects, delay=0.0)

    if not detected:
        warn_line(t("docker_none_found"))
        return manual_docker_entry()

    # Pick projects
    project_choices = [
        questionary.Choice(
            title=f"{p.get('Name','?'):<20s}  {p.get('ConfigFiles','').split(',')[0]}",
            value=p,
        )
        for p in detected
    ]
    project_choices.append(questionary.Choice(title=t("docker_custom_path"), value=None))

    console.print(f"  [dim]{t('docker_hint')}[/dim]")
    selected = questionary.checkbox(
        t("docker_pick_projects"), choices=project_choices,
    ).ask() or []

    blocks: list[dict] = []
    for proj in selected:
        if proj is None:
            blocks.extend(manual_docker_entry())
            continue

        path = proj.get("ConfigFiles", "").split(",")[0].strip()
        if not path:
            continue

        containers = list_compose_containers(path)
        if not containers:
            blocks.append({"compose": path, "containers": [], "starred": []})
            continue

        services = [
            {"name": c.get("Service") or c.get("Name", "?"), "status": c.get("Status", "")}
            for c in containers
        ]

        ctn_choices = [
            questionary.Choice(
                title=f"{s['name']:<25s} {s['status']}",
                value=s["name"],
                checked=True,
            )
            for s in services
        ]
        chosen = questionary.checkbox(
            t("docker_pick_containers", project=proj.get("Name", "?")),
            choices=ctn_choices,
        ).ask() or []

        starred: list[str] = []
        if chosen:
            star_choices = [
                questionary.Choice(title=name, value=name, checked=False)
                for name in chosen
            ]
            starred = questionary.checkbox(
                t("docker_pick_starred"), choices=star_choices,
            ).ask() or []

        blocks.append({"compose": path, "containers": chosen, "starred": starred})

    return blocks


def manual_docker_entry() -> list[dict]:
    blocks: list[dict] = []
    idx = 1
    while True:
        path = Prompt.ask(
            f"  [{idx}] {t('ask_compose_path')}",
            default="",
            show_default=False,
        )
        if not path:
            break
        if not Path(path).is_file():
            warn_line(t("warn_not_found", path=path))
        containers = Prompt.ask(f"      {t('ask_containers')}", default="")
        starred = Prompt.ask(f"      {t('ask_starred')}", default="")
        blocks.append({
            "compose": path,
            "containers": [c.strip() for c in containers.split(",") if c.strip()],
            "starred": [s.strip() for s in starred.split(",") if s.strip()],
        })
        idx += 1
    return blocks


# ── yaml builder ────────────────────────────────────────────────────────────

def _slug(path: str) -> str:
    s = path.strip("/").replace("/", "-")
    return s or "root"


def build_yaml(
    *,
    bot_token: str,
    chat_id: str,
    proxy: str = "",
    hostname: str,
    check_interval: int = 60,
    report_interval: int,
    warn_pct: int,
    crit_pct: int,
    disks: list[str],
    docker_blocks: list[dict],
    net_cfg: dict | bool = True,
    systemd_units: list[str] | None = None,
    web_cfg: dict | None = None,
    notifier_lang: str = "en",
) -> str:
    systemd_units = systemd_units or []
    parts: list[str] = []
    proxy_line = f'    proxy: "{proxy}"\n' if proxy else ""
    parts.append(f"""\
notifiers:
  - type: telegram
    bot_token: "{bot_token}"
    chat_id: "{chat_id}"
    lang: {notifier_lang}
{proxy_line}
checks:
  - type: cpu
    name: cpu
    interval: {check_interval}
    warn_pct: {warn_pct}
    crit_pct: {crit_pct}
  - type: memory
    name: memory
    interval: {check_interval}
    warn_pct: {warn_pct}
    crit_pct: {crit_pct}
""")
    for d in disks:
        parts.append(f"""\
  - type: disk
    name: disk-{_slug(d)}
    interval: {check_interval}
    path: "{d}"
    warn_pct: {warn_pct}
    crit_pct: {crit_pct}
""")
    for unit in systemd_units:
        unit_slug = unit.replace(".service", "").replace(".", "-")
        parts.append(f"""\
  - type: systemd
    name: systemd-{unit_slug}
    interval: {check_interval}
    unit: {unit}
""")
    paths_yaml = ", ".join(f'"{d}"' for d in disks) or '"/"'

    if isinstance(net_cfg, dict) and net_cfg.get("interfaces"):
        ifaces_yaml = f"    interfaces: [{', '.join(net_cfg['interfaces'])}]\n"
    else:
        ifaces_yaml = ""

    parts.append(f"""
report:
  interval: {report_interval}
  hostname: {hostname}
  notifier: telegram

  host:
    disks: [{paths_yaml}]
{ifaces_yaml}    warn_pct: {warn_pct}
""")
    if docker_blocks:
        parts.append("\n  docker:\n")
        for b in docker_blocks:
            parts.append(f'    - compose: "{b["compose"]}"\n')
            if b["containers"]:
                parts.append(f"      containers: [{', '.join(b['containers'])}]\n")
            if b["starred"]:
                parts.append(f"      starred: [{', '.join(b['starred'])}]\n")

    if web_cfg and web_cfg.get("enabled"):
        port = int(web_cfg.get("port", 8765))
        user = web_cfg.get("user") or {}
        jwt_blk = web_cfg.get("jwt") or {}
        username = user.get("username", "admin")
        pw_hash = user.get("password_hash", "")
        secret = jwt_blk.get("secret", "")
        expiry = int(jwt_blk.get("expiry_seconds", 7 * 24 * 3600))
        parts.append(f"""
web:
  enabled: true
  host: 0.0.0.0
  port: {port}
  prefix: /blackbox
  user:
    username: {username}
    password_hash: "{pw_hash}"
  jwt:
    secret: "{secret}"
    expiry_seconds: {expiry}
""")
    return "".join(parts)


# ── venv ────────────────────────────────────────────────────────────────────

def ensure_venv() -> Path:
    venv_dir = PROJECT_ROOT / ".venv"
    venv_py = venv_dir / "bin" / "python"
    if venv_py.exists():
        return venv_py
    step(t("step_venv"), lambda: subprocess.run(
        [sys.executable, "-m", "venv", str(venv_dir)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ))
    step(t("step_deps"), lambda: subprocess.run(
        [str(venv_dir / "bin" / "pip"), "install", "-q",
         "-r", str(PROJECT_ROOT / "requirements.txt")],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ))
    return venv_py


# ── dev mode ────────────────────────────────────────────────────────────────

def run_dev() -> int:
    venv_py = ensure_venv()
    console.print(f"\n[bold green]→[/bold green] [bold]{t('starting_dev')}[/bold]\n")
    os.chdir(PROJECT_ROOT)
    env = {**os.environ, "PYTHONPATH": str(PROJECT_ROOT / "src")}
    return subprocess.call([str(venv_py), "-m", "main", str(CONFIG_FILE)], env=env)


# ── systemd ─────────────────────────────────────────────────────────────────

def install_systemd() -> int:
    venv_py = ensure_venv()
    section(t("section_service"))

    console.print(f"  [dim]user:[/dim] [bold cyan]root[/bold cyan]")
    console.print(f"  [dim]path:[/dim] [cyan]{PROJECT_ROOT}[/cyan]")
    console.print(f"  [dim]unit:[/dim] [cyan]{UNIT_PATH}[/cyan]")

    if not Confirm.ask(f"[bold]{t('confirm_install')}[/bold]", default=True):
        return 0

    if not _ensure_sudo():
        console.print("[red]sudo failed[/red]")
        return 1

    unit = build_unit(venv_py=venv_py)

    def write_unit():
        subprocess.run(
            ["sudo", "tee", UNIT_PATH],
            input=unit, text=True, check=True, stdout=subprocess.DEVNULL,
        )

    step(t("step_unit"), write_unit)
    step(t("step_reload"), lambda: subprocess.run(
        ["sudo", "systemctl", "daemon-reload"], check=True,
    ))
    step(t("step_enable"), lambda: subprocess.run(
        ["sudo", "systemctl", "enable", "--now", SERVICE_NAME], check=True,
    ))

    console.print(f"\n[bold green]✓[/bold green] [bold]{t('service_done')}[/bold]")
    console.print(f"  [dim italic]{t('logs_hint')}[/dim italic]")
    console.print(f"  [dim italic]{t('status_hint')}[/dim italic]")
    return 0


def systemd_unit_exists() -> bool:
    return Path(UNIT_PATH).exists()


def _ensure_sudo() -> bool:
    """Prime sudo credentials before entering any spinner Live context.
    Returns True if creds are available, False if user cancelled / failed."""
    test = subprocess.run(
        ["sudo", "-n", "true"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    if test.returncode == 0:
        return True
    console.print(f"  [dim italic]sudo: вводи пароль если попросит[/dim italic]")
    return subprocess.run(["sudo", "-v"]).returncode == 0


def uninstall_systemd() -> int:
    section(t("section_uninstall"))

    if not systemd_unit_exists():
        warn_line(t("no_service"))
        return 0

    console.print(f"  [dim]unit:[/dim] [cyan]{UNIT_PATH}[/cyan]")
    if not Confirm.ask(f"[bold]{t('confirm_uninstall')}[/bold]", default=True):
        return 0

    if not _ensure_sudo():
        console.print("[red]sudo failed[/red]")
        return 1

    def disable():
        subprocess.run(
            ["sudo", "systemctl", "disable", "--now", SERVICE_NAME],
            check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

    def remove():
        subprocess.run(["sudo", "rm", "-f", UNIT_PATH], check=True)

    step(t("step_disable"), disable)
    step(t("step_remove_unit"), remove)
    step(t("step_reload"), lambda: subprocess.run(
        ["sudo", "systemctl", "daemon-reload"], check=True,
    ))

    console.print(f"\n[bold green]✓[/bold green] [bold]{t('service_removed')}[/bold]")
    return 0


def build_unit(*, venv_py: Path) -> str:
    # Runs as root by default. Control-panel setups (FastPanel/ISPmanager/etc.)
    # put per-site configs under /var/www/<panel-user>/ with directory ACLs that
    # deny access to anyone outside the owning user — even members of the panel's
    # admin group fall into the explicit `---` group bits and lose traversal.
    # Running as root is the only way `docker compose` can reliably stat each
    # project's .env without per-host group surgery.
    #
    # Hardening flags (ProtectSystem/ProtectHome/PrivateTmp/ReadWritePaths) are
    # also omitted: they create a private mount namespace which hides those same
    # bind-mounted /var/www/<user>/ paths even from root.
    return f"""[Unit]
Description=BlackBox monitoring daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory={PROJECT_ROOT}
Environment=PYTHONPATH={PROJECT_ROOT}/src
ExecStart={venv_py} -m main {CONFIG_FILE}
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
"""


# ── entrypoint ──────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--install-service", action="store_true",
                        help="skip menus, install systemd service directly")
    parser.add_argument("--uninstall-service", action="store_true",
                        help="stop, disable and remove systemd service")
    parser.add_argument("--lang", choices=["en", "ru"], help="force ui language")
    args = parser.parse_args()

    global LANG

    console.clear()

    if args.lang:
        LANG = args.lang
        banner()
    elif args.install_service or args.uninstall_service:
        LANG = detect_lang()
        banner()
    else:
        banner_minimal()
        pick_language()
        console.clear()
        banner()

    if args.uninstall_service:
        return uninstall_systemd()

    if args.install_service:
        if not CONFIG_FILE.exists():
            console.print(f"[red]{t('no_config')}[/red]")
            return 1
        return install_systemd()

    while True:
        action = main_menu()
        if action == "exit":
            console.print(f"[dim]{t('bye')}[/dim]")
            return 0
        if action == "edit":
            run_wizard()
            console.clear()
            banner()
            continue
        if action == "dev":
            if not CONFIG_FILE.exists():
                run_wizard()
            return run_dev()
        if action == "service":
            if not CONFIG_FILE.exists():
                run_wizard()
            return install_systemd()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        console.print(f"\n[dim]{LOCALES[LANG]['aborted']}[/dim]")
        sys.exit(130)
