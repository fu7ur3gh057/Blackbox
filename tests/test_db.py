"""DB layer: lifetime, schema, session round-trip."""

import time
from pathlib import Path

from sqlmodel import select

from db.lifetime import init_db, shutdown_db
from db.models import (
    AlertEvent,
    CheckResult,
    CheckStateEntry,
    LogSignatureEntry,
)
from services.taskiq.broker import broker as global_broker


async def test_init_db_creates_file_and_attaches_state(tmp_path: Path):
    db_path = tmp_path / "fresh.sqlite"
    assert not db_path.exists()

    global_broker.state.data.clear()
    try:
        await init_db(db_path)
        assert db_path.exists()
        assert global_broker.state.data.get("db_engine") is not None
        assert global_broker.state.data.get("db_session_maker") is not None
    finally:
        await shutdown_db()


async def test_check_result_round_trip(tmp_path: Path):
    global_broker.state.data.clear()
    await init_db(tmp_path / "x.sqlite")
    try:
        async with global_broker.state.db_session_maker() as s:
            s.add(CheckResult(ts=time.time(), name="cpu", kind="cpu",
                              level="warn", detail="84%",
                              metrics={"value": 84.2, "threshold": 80}))
            await s.commit()
        async with global_broker.state.db_session_maker() as s:
            rows = (await s.exec(select(CheckResult))).all()
        assert len(rows) == 1
        assert rows[0].name == "cpu"
        assert rows[0].metrics == {"value": 84.2, "threshold": 80}
    finally:
        await shutdown_db()


async def test_check_state_upsert(tmp_path: Path):
    global_broker.state.data.clear()
    await init_db(tmp_path / "x.sqlite")
    try:
        async with global_broker.state.db_session_maker() as s:
            s.add(CheckStateEntry(name="cpu", level="warn", updated_at=1.0))
            await s.commit()

        async with global_broker.state.db_session_maker() as s:
            row = await s.get(CheckStateEntry, "cpu")
            row.level = "ok"
            row.updated_at = 2.0
            s.add(row)
            await s.commit()

        async with global_broker.state.db_session_maker() as s:
            row = await s.get(CheckStateEntry, "cpu")
        assert row.level == "ok"
        assert row.updated_at == 2.0
    finally:
        await shutdown_db()


async def test_alert_event_persists_metrics_json(tmp_path: Path):
    global_broker.state.data.clear()
    await init_db(tmp_path / "x.sqlite")
    try:
        async with global_broker.state.db_session_maker() as s:
            s.add(AlertEvent(ts=1.0, name="cpu", level="crit", kind="cpu",
                             detail="bad", metrics={"value": 95.5}))
            await s.commit()
        async with global_broker.state.db_session_maker() as s:
            [row] = (await s.exec(select(AlertEvent))).all()
        assert row.metrics == {"value": 95.5}
    finally:
        await shutdown_db()


async def test_log_signature_unique_by_sig(tmp_path: Path):
    """sig is the primary key — second insert with the same sig must fail or
    be idempotent (we use `add` after `get`, so we update via the same row)."""
    global_broker.state.data.clear()
    await init_db(tmp_path / "x.sqlite")
    try:
        async with global_broker.state.db_session_maker() as s:
            s.add(LogSignatureEntry(sig="abc", source="svc", sample="x",
                                    first_seen=1.0, total=1))
            await s.commit()

        # Same sig, fetch + update (the path LogProcessor uses)
        async with global_broker.state.db_session_maker() as s:
            row = await s.get(LogSignatureEntry, "abc")
            row.total = 5
            s.add(row)
            await s.commit()

        async with global_broker.state.db_session_maker() as s:
            rows = (await s.exec(select(LogSignatureEntry))).all()
        assert len(rows) == 1
        assert rows[0].total == 5
    finally:
        await shutdown_db()


async def test_init_db_is_idempotent(tmp_path: Path):
    """Re-running init_db on an existing file shouldn't blow up or wipe data."""
    db_path = tmp_path / "x.sqlite"
    global_broker.state.data.clear()
    try:
        await init_db(db_path)
        async with global_broker.state.db_session_maker() as s:
            s.add(CheckResult(ts=1.0, name="cpu", kind="cpu", level="ok"))
            await s.commit()
    finally:
        await shutdown_db()

    try:
        await init_db(db_path)  # second time on existing file
        async with global_broker.state.db_session_maker() as s:
            rows = (await s.exec(select(CheckResult))).all()
        assert len(rows) == 1, "previous data should still be there"
    finally:
        await shutdown_db()
