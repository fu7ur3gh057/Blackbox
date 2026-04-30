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
