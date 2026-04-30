"""SQLite-backed log event store. Replaces JsonlStorage.

Every matched log line lands in the `log_events` table. Tail/seed reads
go through `tail()` (`/api/logs/recent`, `RecentErrorsSection`). Bounded
size is maintained by `prune()` — wired from `tasks.logs.prune_log_events`,
runs hourly:

    prune by age:   DELETE WHERE ts < now - retention_days * 86400
    prune by count: DELETE WHERE id <= (max id - max_rows)

Both fire on every prune call; whichever is tighter wins.
"""

import logging
import time
from typing import Iterable

from sqlalchemy import delete, func, select as sa_select
from sqlmodel import desc, select as sm_select
# Re-export for the readability of the tail() query — sqlmodel's `select`
# yields a ScalarResult on session.exec; the raw `sa_select` is for COUNT
# and DELETE statements where we need session.execute + .rowcount/.scalar.

log = logging.getLogger(__name__)


class LogEventStore:
    def __init__(
        self,
        retention_days: int = 7,
        max_rows: int = 200_000,
    ) -> None:
        self.retention_days = max(1, int(retention_days))
        self.max_rows = max(10, int(max_rows))

    # ── writes ────────────────────────────────────────────────────────

    async def insert(self, event: dict) -> None:
        """Append one event. Caller is responsible for the dict shape:
        {ts, source, sig, first, line}."""
        from db.models import LogEvent
        from services.taskiq.broker import broker

        sm = broker.state.data.get("db_session_maker")
        if sm is None:
            return
        try:
            async with sm() as session:
                session.add(LogEvent(
                    ts=float(event["ts"]),
                    source=str(event["source"]),
                    sig=str(event["sig"]),
                    first=bool(event.get("first", False)),
                    line=str(event.get("line", ""))[:8192],
                ))
                await session.commit()
        except Exception:
            log.exception("log-store: insert failed")

    async def insert_many(self, events: Iterable[dict]) -> None:
        """Batch insert. Use when ingesting bursts to amortise commit cost."""
        from db.models import LogEvent
        from services.taskiq.broker import broker

        sm = broker.state.data.get("db_session_maker")
        if sm is None:
            return
        try:
            async with sm() as session:
                for ev in events:
                    session.add(LogEvent(
                        ts=float(ev["ts"]),
                        source=str(ev["source"]),
                        sig=str(ev["sig"]),
                        first=bool(ev.get("first", False)),
                        line=str(ev.get("line", ""))[:8192],
                    ))
                await session.commit()
        except Exception:
            log.exception("log-store: insert_many failed")

    # ── reads ─────────────────────────────────────────────────────────

    async def tail(
        self,
        *,
        source: str | None = None,
        before: float | None = None,
        limit: int = 200,
    ) -> list[dict]:
        """Newest-first list of events. Optional `source` filter and
        `before` cursor (returns rows with ts < before). Limit clamped
        to [1, 2000]."""
        from db.models import LogEvent
        from services.taskiq.broker import broker

        sm = broker.state.data.get("db_session_maker")
        if sm is None:
            return []
        limit = max(1, min(2000, int(limit)))

        async with sm() as session:
            q = sm_select(LogEvent).order_by(desc(LogEvent.ts)).limit(limit)
            if source:
                q = q.where(LogEvent.source == source)
            if before is not None:
                q = q.where(LogEvent.ts < float(before))
            rows = (await session.exec(q)).all()

        return [
            {
                "ts": r.ts,
                "source": r.source,
                "sig": r.sig,
                "first": r.first,
                "line": r.line,
            }
            for r in rows
        ]

    # ── retention ─────────────────────────────────────────────────────

    async def prune(self) -> int:
        """Delete rows older than retention_days, then trim to max_rows.
        Returns the number of rows removed."""
        from db.models import LogEvent
        from services.taskiq.broker import broker

        sm = broker.state.data.get("db_session_maker")
        if sm is None:
            return 0

        cutoff_ts = time.time() - self.retention_days * 86400
        removed = 0
        try:
            async with sm() as session:
                # by-age
                age_res = await session.execute(
                    delete(LogEvent).where(LogEvent.ts < cutoff_ts),
                )
                removed += age_res.rowcount or 0

                # by-count: find boundary id, keep newest `max_rows`.
                count_res = await session.execute(
                    sa_select(func.count()).select_from(LogEvent),
                )
                total = count_res.scalar_one() or 0
                excess = total - self.max_rows
                if excess > 0:
                    boundary_res = await session.execute(
                        sa_select(LogEvent.id)
                        .order_by(LogEvent.id)
                        .offset(excess - 1)
                        .limit(1),
                    )
                    cutoff_id = boundary_res.scalar_one_or_none()
                    if cutoff_id is not None:
                        cnt_res = await session.execute(
                            delete(LogEvent).where(LogEvent.id <= cutoff_id),
                        )
                        removed += cnt_res.rowcount or 0
                await session.commit()
        except Exception:
            log.exception("log-store: prune failed")
            return removed

        if removed:
            log.info("log-store: pruned %d row(s)", removed)
        return removed
