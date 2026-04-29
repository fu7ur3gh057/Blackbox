"""BlackBox interactive setup wizard with dev/service modes and en/ru i18n."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import psutil
import questionary
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
        "ask_hostname": "hostname",
        "ask_report_int": "report interval (sec)",
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
        "service_summary": "service will run as [cyan]{user}:{group}[/cyan] from [cyan]{root}[/cyan]",
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
        "ask_hostname": "hostname",
        "ask_report_int": "интервал репорта (сек)",
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
        "service_summary": "сервис будет запущен под [cyan]{user}:{group}[/cyan] из [cyan]{root}[/cyan]",
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
    bot_token = Prompt.ask(f"  [bold]{t('ask_bot_token')}[/bold]", password=True)
    chat_id = Prompt.ask(f"  [bold]{t('ask_chat_id')}[/bold]")

    section(t("section_host"))
    hostname = Prompt.ask(f"  {t('ask_hostname')}", default=socket.gethostname())
    report_int = Prompt.ask(f"  {t('ask_report_int')}", default="2700")
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

    yaml_text = build_yaml(
        bot_token=bot_token, chat_id=chat_id,
        hostname=hostname, report_interval=int(report_int),
        warn_pct=int(warn_pct), crit_pct=int(crit_pct),
        disks=disks, docker_blocks=docker_blocks,
        net_cfg=net_cfg, systemd_units=systemd_units,
        notifier_lang=LANG,
    )

    section(t("section_writing"))
    if CONFIG_FILE.exists():
        backup = CONFIG_FILE.with_suffix(".yaml.bak")
        step(t("step_backup", name=backup.name), lambda: shutil.copy(CONFIG_FILE, backup))
    step(t("step_write"), lambda: CONFIG_FILE.write_text(yaml_text))


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
    hostname: str,
    report_interval: int,
    warn_pct: int,
    crit_pct: int,
    disks: list[str],
    docker_blocks: list[dict],
    net_cfg: dict | bool = True,
    systemd_units: list[str] | None = None,
    notifier_lang: str = "en",
) -> str:
    systemd_units = systemd_units or []
    parts: list[str] = []
    parts.append(f"""\
notifiers:
  - type: telegram
    bot_token: "{bot_token}"
    chat_id: "{chat_id}"
    lang: {notifier_lang}

checks:
  - type: cpu
    name: cpu
    interval: 60
    warn_pct: {warn_pct}
    crit_pct: {crit_pct}
  - type: memory
    name: memory
    interval: 60
    warn_pct: {warn_pct}
    crit_pct: {crit_pct}
""")
    for d in disks:
        parts.append(f"""\
  - type: disk
    name: disk-{_slug(d)}
    interval: 60
    path: "{d}"
    warn_pct: {warn_pct}
    crit_pct: {crit_pct}
""")
    for unit in systemd_units:
        unit_slug = unit.replace(".service", "").replace(".", "-")
        parts.append(f"""\
  - type: systemd
    name: systemd-{unit_slug}
    interval: 60
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
    return subprocess.call([str(venv_py), "-m", "src.main", str(CONFIG_FILE)])


# ── systemd ─────────────────────────────────────────────────────────────────

def install_systemd() -> int:
    venv_py = ensure_venv()
    section(t("section_service"))

    user = os.environ.get("SUDO_USER") or os.environ.get("USER") or "root"
    group = subprocess.check_output(["id", "-gn", user], text=True).strip()

    console.print(f"  [dim]user:[/dim] [bold cyan]{user}:{group}[/bold cyan]")
    console.print(f"  [dim]path:[/dim] [cyan]{PROJECT_ROOT}[/cyan]")
    console.print(f"  [dim]unit:[/dim] [cyan]{UNIT_PATH}[/cyan]")

    if not Confirm.ask(f"[bold]{t('confirm_install')}[/bold]", default=True):
        return 0

    if not _ensure_sudo():
        console.print("[red]sudo failed[/red]")
        return 1

    unit = build_unit(user=user, group=group, venv_py=venv_py)

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


def build_unit(*, user: str, group: str, venv_py: Path) -> str:
    return f"""[Unit]
Description=BlackBox monitoring daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={user}
Group={group}
WorkingDirectory={PROJECT_ROOT}
ExecStart={venv_py} -m src.main {CONFIG_FILE}
Restart=on-failure
RestartSec=5s

NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=yes
ReadWritePaths={PROJECT_ROOT}

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
