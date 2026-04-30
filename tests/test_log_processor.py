"""LogProcessor: signature normalization, dedup, persistence, task dispatch."""

import asyncio
from pathlib import Path
from typing import AsyncIterator

import pytest

from core.logs.processor import LogProcessor, _signature
from core.logs.storage import JsonlStorage


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


async def test_first_seen_kicks_notify_log_first(monkeypatch, tmp_path: Path):
    storage = JsonlStorage(tmp_path / "log.jsonl")
    proc = LogProcessor([], storage, digest_interval=3600)

    kicked: list[tuple[str, str]] = []

    class FakeKick:
        async def kiq(self, source, sample):
            kicked.append((source, sample))

    # Patch the lazy import inside _kick_first
    monkeypatch.setattr("tasks.logs.notify_log_first", FakeKick())

    proc._record("nginx", "Error: connection refused")
    # _kick_first is fired via create_task — yield the loop once
    await asyncio.sleep(0)
    assert kicked == [("nginx", "Error: connection refused")]


async def test_repeated_lines_dont_kick_first_again(monkeypatch, tmp_path: Path):
    storage = JsonlStorage(tmp_path / "log.jsonl")
    proc = LogProcessor([], storage, digest_interval=3600)

    kicked = []

    class FakeKick:
        async def kiq(self, source, sample):
            kicked.append((source, sample))

    monkeypatch.setattr("tasks.logs.notify_log_first", FakeKick())

    proc._record("svc", "boom 1")
    proc._record("svc", "boom 2")  # same signature post-normalization
    await asyncio.sleep(0)
    assert len(kicked) == 1


async def test_digest_kicks_repeats_only(monkeypatch, tmp_path: Path):
    storage = JsonlStorage(tmp_path / "log.jsonl")
    proc = LogProcessor([], storage, digest_interval=3600)

    # Track first-kicks too so they don't accidentally show up in the digest
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

    # 3 hits of one signature, 1 of another
    proc._record("svc", "error 1")
    proc._record("svc", "error 2")
    proc._record("svc", "error 3")
    proc._record("svc", "warning N")  # different signature, single hit
    await asyncio.sleep(0)

    await proc._send_digest()

    # Only the 3-hit signature should be in the digest
    assert captured["items"]
    assert all(item["count"] >= 2 for item in captured["items"])
    assert sum(item["count"] for item in captured["items"]) == 3


def test_period_label_ru_vs_en():
    p_ru = LogProcessor([], JsonlStorage(Path("/tmp/_x.jsonl")), digest_interval=3600, lang="ru")
    p_en = LogProcessor([], JsonlStorage(Path("/tmp/_x.jsonl")), digest_interval=3600, lang="en")
    assert "час" in p_ru._period_label()
    assert "hour" in p_en._period_label()


async def test_run_with_source_consumes_lines(monkeypatch, tmp_path: Path):
    storage = JsonlStorage(tmp_path / "log.jsonl")
    src = FakeSource("svc", ["error a", "error a", "error a"])
    proc = LogProcessor([src], storage, digest_interval=3600)

    class _Noop:
        async def kiq(self, *a, **k): pass
    monkeypatch.setattr("tasks.logs.notify_log_first", _Noop())
    monkeypatch.setattr("tasks.logs.notify_log_digest", _Noop())

    # Run with a small timeout — the digest loop sleeps 3600s, source finishes quickly
    task = asyncio.create_task(proc._consume(src))
    await asyncio.wait_for(task, timeout=2)

    assert len(proc._sigs) == 1
    [info] = proc._sigs.values()
    assert info["total"] == 3
