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
