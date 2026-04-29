# BlackBox

Lightweight server monitoring daemon that sends rich, actionable alerts to Telegram.
One Python process that watches your host and reports problems with full context.
No agents, no databases, no service mesh.

## Features

- **Reactive alerts** — CPU, memory, disk, HTTP endpoints, systemd units. Three
  severity levels (`ok` / `warn` / `crit`) with separate thresholds. Alerts fire
  only on transitions, never spam while a problem persists.
- **Periodic status digest** — full snapshot of host and Docker Compose projects
  on a configurable schedule. Composable sections: memory, swap, CPU load, disks,
  network, containers, Postgres, DLQ.
- **Log streaming with dedup** — tails files, `docker compose logs`, or
  `journalctl -u`. Similar errors are collapsed by signature; first occurrence
  alerts immediately, repeats are summarized in periodic digests. Everything is
  appended to a rotating jsonl archive.
- **Bilingual** — full English and Russian support across UI, Telegram messages,
  date formatting (`Apr 29, 14:50` vs `29 апреля, 14:50`).
- **Interactive setup wizard** — auto-detects mounted disks, network interfaces,
  running Docker Compose projects with their containers, and active systemd
  services. Pick what to monitor via terminal checkboxes.
- **systemd-ready** — install as a service in one command, runs as your user
  with sandboxing flags by default.

## Requirements

- Linux, Python 3.10+
- `make`, `bash`
- Optional: `docker compose` v2 (for Docker monitoring), `systemctl` (for
  systemd checks), `journalctl` (for journal log streaming)

## Quick start

```bash
git clone https://github.com/fu7ur3gh057/Blackbox.git
cd Blackbox
make setup
```

After the wizard, install a global `blackbox` command so you can run it from
anywhere:

```bash
make install-cli      # one-time, drops a shim into ~/.local/bin/blackbox
blackbox              # opens the wizard from any cwd
blackbox run          # foreground
blackbox status       # systemctl status
blackbox cd           # prints project root (use: cd $(blackbox cd))
blackbox help         # all commands
```

(`make install-cli` doesn't relocate the project — the shim points at wherever
you cloned it. Move the project and re-run `make install-cli` to update.)

The wizard walks you through:

1. UI language (English / Russian)
2. Telegram bot token and chat ID
3. Disks to monitor (auto-detected mountpoints, checkbox)
4. Network interfaces for traffic counter (auto-detected, filtered from
   loopback / docker / virtual interfaces)
5. Docker Compose projects to track (auto-detected via `docker compose ls`,
   per-project container picker)
6. Systemd services to alert on (auto-detected from `systemctl list-units`,
   filtered from system noise)
7. Final choice: run in foreground or install as a systemd service

Need Telegram credentials?
- **bot_token** — message [@BotFather](https://t.me/BotFather), `/newbot`
- **chat_id** — message your bot, then
  `curl https://api.telegram.org/bot<TOKEN>/getUpdates` and look for `chat.id`
  (group / channel chat IDs start with `-100`)

## Running

```bash
make run                  # foreground, useful for first-run debugging
make install-service      # write /etc/systemd/system/blackbox.service, enable, start
make start | stop | restart | status | logs   # systemctl shortcuts
make uninstall-service    # full removal
make install-cli          # global `blackbox` command in ~/.local/bin
make uninstall-cli        # remove the global command
make clean                # drop venv and __pycache__
```

`start` / `stop` / `restart` are graceful — they print a friendly message if
the unit isn't installed instead of failing.

## Configuration

A single `config.yaml` at the project root. The wizard generates it; you can
also edit by hand. Full sample at `deploy/config.example.yaml`.

```yaml
notifiers:
  - type: telegram
    bot_token: "..."
    chat_id: "..."
    lang: ru                # ru | en — language for all Telegram messages

checks:
  - type: cpu
    name: cpu
    interval: 60
    warn_pct: 80            # yellow alert above this
    crit_pct: 90            # red alert above this
  - type: memory
    name: memory
    interval: 60
    warn_pct: 80
    crit_pct: 90
  - type: disk
    name: disk-root
    interval: 60
    path: /
    warn_pct: 80
    crit_pct: 90
  - type: systemd
    name: systemd-nginx
    interval: 60
    unit: nginx.service
  - type: http
    name: api-health
    interval: 60
    url: https://example.com/health
    expect_status: 200

report:
  interval: 2700            # seconds, full digest every 45 min
  hostname: my-server
  notifier: telegram

  host:
    memory: {}
    swap: {}
    cpu: {}
    disks:
      paths: ["/"]
    net:
      interfaces: [eth0]    # or `net: true` to sum all interfaces

  docker:
    - compose: /opt/goda/docker-compose.yaml
      containers: [goda-platform, goda-engine, goda-db]
      starred: [goda-platform]
    - compose: /opt/tanos/docker-compose.yaml

  postgres:
    - dsn: "postgresql://user:pass@localhost/goda"
      label: "Goda DB"
      warn_conns: 50

  dlq:
    - dsn: "postgresql://user:pass@localhost/goda"
      query: "SELECT count(*) FROM dlq_messages"
      label: "Goda DLQ"
      warn_above: 1

logs:
  notifier: telegram
  digest_interval: 3600     # send digest of recurring errors every hour
  storage:
    path: logs/blackbox.jsonl
    max_size_mb: 10         # rotate when current file exceeds this
    keep_archives: 7        # how many .jsonl.gz archives to keep
  sources:
    - type: file
      name: nginx-error
      path: /var/log/nginx/error.log
      pattern: ".+"
    - type: docker
      name: goda-app
      compose: /opt/goda/docker-compose.yaml
      service: goda-platform
      pattern: "ERROR|CRITICAL|Traceback"
    - type: journal
      name: nginx-systemd
      unit: nginx.service
      pattern: "(?i)error|warn"
```

Each top-level block (`checks` / `report` / `logs`) is optional. The minimum
viable config is just `notifiers` plus one of the three.

## What it sends to Telegram

**On startup:**
```
🟢 Monitoring connected

Apr 29, 19:24
```

**Critical alert:**
```
🔴 Disk space critical

Partition / is at 64.4% (threshold: 60%, free: 70.5 GB).

Apr 29, 19:24
```

**Recovery:**
```
✅ CPU back to normal

CPU is now at 25.0%.

Apr 29, 19:24
```

**Status report (every 45 min by default):**
```
📊 Status report  ·  vmi3030960
Apr 29, 19:24 · up 1d 20h

🐳 Containers
8/8 running
✅ goda-platform ⭐ Up 2 days
🟡 goda-engine ⭐ Up 3 days
...

💾 Memory
🟢 RAM: 3.1 / 11.7 GB (27%)

⚙️ CPU
🟢 load: 0.74 / 0.51 / 0.49 (6 cores, 0.12/core)

💿 Disk
🟢 /: 162.6 GB free (84% of 193GB)

🌐 Net (eth0)
↑ 145 KB/s   ↓ 312 KB/s

⚠️ 1 alerts
🟡 container goda-engine unhealthy
```

**First time a unique log error appears:**
```
📜 New error  ·  goda-app

ERROR django.request: Internal Server Error: /api/orders/123
ValueError: invalid literal for int() with base 10: 'foo'

Apr 29, 19:24
```

**Hourly digest of recurring errors:**
```
📜 Error digest  ·  last hour

📦 goda-app  ·  47×
ValueError: invalid literal for int()

📦 nginx-error  ·  3×
[error] connection refused

Apr 29, 19:24
```

## How it works

Three independent components run concurrently in one asyncio event loop:

1. **Checks** — each check runs on its own interval. A central state tracker
   only fires alerts on severity transitions: `ok → warn`, `warn → crit`,
   `* → ok`. `crit → warn` is silent (improvement, but still a problem).
   Sustained issues alert once.

2. **Report** — single timer that gathers all configured sections in parallel
   (`asyncio.gather`) and sends one HTML-formatted digest message.

3. **Log streaming** — each source is a long-lived async generator. Lines are
   filtered by regex, normalized (numbers / UUIDs / quoted strings replaced
   with placeholders), and hashed into a 12-char signature. New signatures
   trigger immediate alerts; repeats increment a counter and are summarized
   in periodic digests. The signature dict is bounded with LRU eviction.

All output to Telegram uses HTML `parse_mode` for typography (`<b>`, `<i>`,
`<code>`, `<pre>`).

## Architecture

```
src/
├── main.py                # entry: load config, build notifiers, gather all components
├── config.py              # yaml -> dataclasses
├── runner.py              # check loop, dispatches alerts on transitions
├── state.py               # severity tracker (ok/warn/crit)
├── i18n.py                # localized date / uptime helpers
├── checks/                # check type per file
│   ├── base.py            # Check Protocol, Result(level, kind, metrics, detail)
│   ├── cpu.py
│   ├── memory.py
│   ├── disk.py
│   ├── http.py
│   └── systemd_unit.py
├── notifiers/
│   ├── base.py            # Notifier Protocol, Alert dataclass
│   └── telegram.py        # HTML rendering, i18n templates per (kind, level, lang)
├── report/
│   ├── runner.py          # periodic snapshot loop
│   ├── builder.py         # message assembly with bold section titles
│   └── sections/          # one file per section
│       ├── memory.py
│       ├── swap.py
│       ├── cpu.py
│       ├── disk.py
│       ├── net.py
│       ├── docker.py
│       ├── postgres.py
│       └── dlq.py
└── logs/
    ├── processor.py       # signature dedup, first-seen + digest scheduler
    ├── storage.py         # rotating jsonl with gzip archives
    └── sources/
        ├── file.py        # tail -f with rotation handling
        ├── docker.py      # docker compose logs -f
        └── journal.py     # journalctl -u <unit> -f
```

## Extending

Adding a new component is one file plus one line in a registry:

| Component | Add file at | Register in |
|---|---|---|
| Check type | `src/checks/<name>.py` | `build_check()` in `src/checks/__init__.py` |
| Notifier (Slack, Discord, email) | `src/notifiers/<name>.py` | `build_notifier()` in `src/notifiers/__init__.py` |
| Report section | `src/report/sections/<name>.py` | `_build_sections()` in `src/report/__init__.py` |
| Log source | `src/logs/sources/<name>.py` | `build_log_processor()` in `src/logs/__init__.py` |

Protocols are minimal — see each `*/base.py`.

## Project layout

```
.
├── Makefile               # all common ops
├── README.md
├── requirements.txt
├── deploy/
│   ├── config.example.yaml
│   └── scripts/
│       ├── setup.sh / setup.py            # interactive wizard with rich + questionary
│       ├── install-service.sh             # systemd install (delegates to setup.py)
│       └── uninstall-service.sh           # systemd remove (delegates to setup.py)
└── src/
```

## License

MIT
