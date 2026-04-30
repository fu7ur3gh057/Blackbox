"""SQLModel tables for blackbox.

All four are designed to be cheap to write per-event and small enough to
keep on disk indefinitely with a periodic cleanup.

- CheckResult: append-only history of every check execution (drives metric
  graphs in the admin UI).
- AlertEvent: append-only log of each Alert that left a notifier (timeline
  of "what fired and when").
- CheckStateEntry: latest known severity per check — replaces the in-memory
  StateTracker so transitions survive restarts.
- LogSignatureEntry: dedup table for LogProcessor; first-seen state survives
  across daemon restarts so we don't re-fire `notify_log_first` for old
  errors that were already digested.
- LogEvent: append-only log of every matched line LogProcessor records.
  Pruned periodically per `retention_days` / `max_rows` so the table stays
  bounded — replaces the legacy JSONL file storage.
- TerminalAuditEntry: audit log for the in-browser web terminal.
  EVERY keystroke chunk is recorded — including whatever was typed, even
  passwords and tokens. Treat the table as sensitive: same access level
  as the JWT secret and DB itself.
- Settings: singleton (id=1) holding what used to live in config.yaml's
  notifiers/checks/report/logs sections. config.yaml is now boot-only:
  it seeds the DB on first run and provides db.path / web.host / port /
  jwt.secret / prefix. Everything else is editable at runtime.
- User: replaces the single `web.user.{username, password_hash}` block
  in config.yaml. Multiple users with role + active flag, normal
  login flow goes through this table.
"""

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class CheckResult(SQLModel, table=True):
    __tablename__ = "check_results"

    id: int | None = Field(default=None, primary_key=True)
    ts: float = Field(index=True)
    name: str = Field(index=True)
    kind: str
    level: str  # ok | warn | crit
    detail: str | None = None
    metrics: dict | None = Field(default=None, sa_column=Column(JSON))


class AlertEvent(SQLModel, table=True):
    __tablename__ = "alerts"

    id: int | None = Field(default=None, primary_key=True)
    ts: float = Field(index=True)
    name: str = Field(index=True)
    level: str
    kind: str | None = None
    detail: str | None = None
    metrics: dict | None = Field(default=None, sa_column=Column(JSON))


class CheckStateEntry(SQLModel, table=True):
    __tablename__ = "check_state"

    name: str = Field(primary_key=True)
    level: str
    updated_at: float


class LogSignatureEntry(SQLModel, table=True):
    __tablename__ = "log_signatures"

    sig: str = Field(primary_key=True)
    source: str
    sample: str
    first_seen: float
    total: int = 0


class LogEvent(SQLModel, table=True):
    __tablename__ = "log_events"

    id: int | None = Field(default=None, primary_key=True)
    ts: float = Field(index=True)
    source: str = Field(index=True)
    sig: str = Field(index=True)
    first: bool = False
    line: str


class TerminalAuditEntry(SQLModel, table=True):
    """Append-only audit log for `/terminal` WS sessions.

    Records session lifecycle events (open/close/kill) and every input
    chunk the user sends through the PTY. The data column holds the raw
    bytes decoded as UTF-8 (replace errors), so passwords typed at a
    prompt end up here verbatim — guard the DB accordingly.
    """

    __tablename__ = "terminal_audit"

    id: int | None = Field(default=None, primary_key=True)
    ts: float = Field(index=True)
    sid: str = Field(index=True)
    username: str = Field(index=True)
    kind: str  # "open" | "input" | "close" | "kill" | "denied"
    data: str | None = None


class Settings(SQLModel, table=True):
    """Runtime-editable settings — was the contents of config.yaml's
    notifiers/checks/report/logs/terminal sections. One row, id=1.

    Each section is a JSON column so we can `UPDATE settings SET checks=?`
    without serialising the whole blob. Order of `notifiers` / `checks` /
    `report.docker` matters and JSON arrays preserve it.
    """

    __tablename__ = "settings"

    id: int | None = Field(default=1, primary_key=True)
    notifiers: list | None = Field(default=None, sa_column=Column(JSON))
    checks:    list | None = Field(default=None, sa_column=Column(JSON))
    report:    dict | None = Field(default=None, sa_column=Column(JSON))
    logs:      dict | None = Field(default=None, sa_column=Column(JSON))
    terminal:  dict | None = Field(default=None, sa_column=Column(JSON))
    updated_at: float = 0.0


class User(SQLModel, table=True):
    """Web admin user. Replaces the single web.user.{username,
    password_hash} block in config.yaml — multiple users with a role
    and an active flag.
    """

    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    role: str = "admin"          # "admin" | future roles ("viewer", etc)
    is_active: bool = True
    created_at: float = 0.0
    last_login_ts: float | None = None
