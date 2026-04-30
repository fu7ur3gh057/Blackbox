"""LogProcessor: signature normalization, dedup, persistence, task dispatch.

Uses the broker fixture so that broker.state.db_session_maker is available
— the processor persists signatures through it. _record is async now."""

import asyncio
from pathlib import Path
from typing import AsyncIterator

from sqlmodel import select

from core.logs.processor import LogProcessor, _signature
from core.logs.storage import JsonlStorage
from db.models import LogSignatureEntry


class FakeSource:
    def __init__(self, name: str, lines: list[str]):
        self.name = name
        self._lines = lines

    async def stream(self) -> AsyncIterator[str]:
        for ln in self._lines:
            yield ln


def test_signature_normalizes_numbers_and_hex_and_quotes():
    a = _signature("Error: id=12345 hash=deadbeefcafe")
    b = _signature("Error: id=99 hash=cafedeadbeef00")
    assert a == b, "numbers + long hex should normalize away"

    c = _signature('Failed query "SELECT * FROM users WHERE id=42"')
    d = _signature('Failed query "SELECT * FROM users WHERE id=999"')
    assert c == d, "quoted text should collapse via _QUOTED_RE"


def test_signature_keeps_distinct_messages_distinct():
    assert _signature("connection refused") != _signature("file not found")


async def test_first_seen_kicks_notify_log_first(broker, monkeypatch, tmp_path: Path):
    storage = JsonlStorage(tmp_path / "log.jsonl")
    proc = LogProcessor([], storage, digest_interval=3600)

    kicked: list[tuple[str, str]] = []

    class FakeKick:
        async def kiq(self, source, sample):
            kicked.append((source, sample))

    monkeypatch.setattr("tasks.logs.notify_log_first", FakeKick())

    await proc._record("nginx", "Error: connection refused")
    await asyncio.sleep(0)  # let the create_task'd kick run
    assert kicked == [("nginx", "Error: connection refused")]


async def test_repeated_lines_dont_kick_first_again(broker, monkeypatch, tmp_path: Path):
    storage = JsonlStorage(tmp_path / "log.jsonl")
    proc = LogProcessor([], storage, digest_interval=3600)

    kicked = []

    class FakeKick:
        async def kiq(self, source, sample):
            kicked.append((source, sample))

    monkeypatch.setattr("tasks.logs.notify_log_first", FakeKick())

    await proc._record("svc", "boom 1")
    await proc._record("svc", "boom 2")  # same signature post-normalization
    await asyncio.sleep(0)
    assert len(kicked) == 1


async def test_signature_persisted_to_db(broker, monkeypatch, tmp_path: Path):
    """First-seen state survives daemon restart — verify the row lands in
    log_signatures with total > 0."""
    storage = JsonlStorage(tmp_path / "log.jsonl")
    proc = LogProcessor([], storage, digest_interval=3600)

    class _Noop:
        async def kiq(self, *a, **k): pass
    monkeypatch.setattr("tasks.logs.notify_log_first", _Noop())

    await proc._record("svc", "error 1")
    await proc._record("svc", "error 2")  # numbers normalize → same signature

    async with broker.state.db_session_maker() as session:
        rows = (await session.exec(select(LogSignatureEntry))).all()
    assert len(rows) == 1
    assert rows[0].total == 2
    assert rows[0].source == "svc"


async def test_processor_hydrates_signatures_from_db(broker, monkeypatch, tmp_path: Path):
    """A fresh LogProcessor on the same DB should not re-fire `first` for
    a signature that's already known."""
    storage = JsonlStorage(tmp_path / "log.jsonl")

    class _NoopOne:
        async def kiq(self, *a, **k): pass
    monkeypatch.setattr("tasks.logs.notify_log_first", _NoopOne())

    proc1 = LogProcessor([], storage, digest_interval=3600)
    await proc1._record("svc", "boom 1")  # writes signature

    # Simulate restart: new processor instance, same DB
    proc2 = LogProcessor([], storage, digest_interval=3600)
    await proc2._hydrate_from_db()

    kicked = []

    class FakeKick:
        async def kiq(self, source, sample):
            kicked.append((source, sample))

    monkeypatch.setattr("tasks.logs.notify_log_first", FakeKick())

    await proc2._record("svc", "boom 2")  # numbers normalize → same signature
    await asyncio.sleep(0)
    assert kicked == [], "should not re-fire first-seen for a known signature"


async def test_digest_kicks_repeats_only(broker, monkeypatch, tmp_path: Path):
    storage = JsonlStorage(tmp_path / "log.jsonl")
    proc = LogProcessor([], storage, digest_interval=3600)

    class _NoopFirst:
        async def kiq(self, *a, **k):
            pass
    monkeypatch.setattr("tasks.logs.notify_log_first", _NoopFirst())

    captured: dict = {}

    class FakeDigest:
        async def kiq(self, items, period_label):
            captured["items"] = items
            captured["period"] = period_label

    monkeypatch.setattr("tasks.logs.notify_log_digest", FakeDigest())

    # 3 hits of one signature, 1 of another (different message)
    await proc._record("svc", "error 1")
    await proc._record("svc", "error 2")
    await proc._record("svc", "error 3")
    await proc._record("svc", "warning N")
    await asyncio.sleep(0)

    await proc._send_digest()

    assert captured["items"]
    assert all(item["count"] >= 2 for item in captured["items"])
    assert sum(item["count"] for item in captured["items"]) == 3


def test_period_label_ru_vs_en():
    p_ru = LogProcessor([], JsonlStorage(Path("/tmp/_x.jsonl")), digest_interval=3600, lang="ru")
    p_en = LogProcessor([], JsonlStorage(Path("/tmp/_x.jsonl")), digest_interval=3600, lang="en")
    assert "час" in p_ru._period_label()
    assert "hour" in p_en._period_label()


async def test_run_with_source_consumes_lines(broker, monkeypatch, tmp_path: Path):
    storage = JsonlStorage(tmp_path / "log.jsonl")
    src = FakeSource("svc", ["error a", "error a", "error a"])
    proc = LogProcessor([src], storage, digest_interval=3600)

    class _Noop:
        async def kiq(self, *a, **k): pass
    monkeypatch.setattr("tasks.logs.notify_log_first", _Noop())
    monkeypatch.setattr("tasks.logs.notify_log_digest", _Noop())

    task = asyncio.create_task(proc._consume(src))
    await asyncio.wait_for(task, timeout=2)

    assert len(proc._sigs) == 1
    [info] = proc._sigs.values()
    assert info["total"] == 3
