"""Log sources: file tail, journal stream, docker compose poll.

Subprocess-based sources are tested via monkey-patching
asyncio.create_subprocess_exec to return canned bytes.
"""

import asyncio
from pathlib import Path

import pytest

from core.logs.sources.docker import DockerLogSource
from core.logs.sources.file import FileLogSource


class _FakeProc:
    def __init__(self, stdout: bytes, returncode: int = 0):
        self._stdout = stdout
        self.returncode = returncode

    async def communicate(self):
        return self._stdout, b""


# ── FileLogSource ──────────────────────────────────────────────────────────

async def test_file_source_picks_up_new_lines(tmp_path: Path):
    path = tmp_path / "log.txt"
    path.write_text("old line\n")
    src = FileLogSource("test", str(path), pattern=".+")

    collected: list[str] = []

    async def consume():
        async for line in src.stream():
            collected.append(line)
            if len(collected) == 2:
                return

    task = asyncio.create_task(consume())
    await asyncio.sleep(1.2)  # stream() polls at 1s intervals
    with path.open("a") as f:
        f.write("error one\n")
        f.write("error two\n")
    await asyncio.wait_for(task, timeout=5)

    assert collected == ["error one", "error two"]


async def test_file_source_pattern_filters(tmp_path: Path):
    path = tmp_path / "log.txt"
    path.write_text("")
    src = FileLogSource("test", str(path), pattern="ERROR")

    collected: list[str] = []

    async def consume():
        async for line in src.stream():
            collected.append(line)
            if collected:
                return

    task = asyncio.create_task(consume())
    await asyncio.sleep(1.2)
    with path.open("a") as f:
        f.write("INFO ok\n")
        f.write("ERROR boom\n")
    await asyncio.wait_for(task, timeout=5)

    assert collected == ["ERROR boom"]


async def test_file_source_handles_truncation(tmp_path: Path):
    path = tmp_path / "log.txt"
    path.write_text("a long initial line we'll start past\n")
    src = FileLogSource("test", str(path), pattern=".+")

    collected: list[str] = []

    async def consume():
        async for line in src.stream():
            collected.append(line)
            if collected:
                return

    task = asyncio.create_task(consume())
    await asyncio.sleep(1.2)
    # truncate
    path.write_text("after-truncate\n")
    await asyncio.wait_for(task, timeout=5)

    assert collected == ["after-truncate"]


# ── DockerLogSource ────────────────────────────────────────────────────────

async def test_docker_source_polls_filters_and_yields(monkeypatch):
    src = DockerLogSource("docker", "/x/dc.yaml", "svc",
                          pattern="ERROR", poll_interval=5)

    calls = []

    async def fake_exec(*args, **kwargs):
        calls.append(args)
        return _FakeProc(b"INFO hi\nERROR oops\nDEBUG x\n", returncode=0)

    monkeypatch.setattr("core.logs.sources.docker.asyncio.create_subprocess_exec", fake_exec)
    # Skip the long sleep — bind original sleep before patching to avoid recursion
    real_sleep = asyncio.sleep
    monkeypatch.setattr("core.logs.sources.docker.asyncio.sleep",
                        lambda *_a, **_k: real_sleep(0))

    received: list[str] = []

    async def consume():
        async for line in src.stream():
            received.append(line)
            if received:
                return

    await asyncio.wait_for(consume(), timeout=2)
    assert received == ["ERROR oops"]
    # First poll should pass --since with the *initial* timestamp recorded at __init__
    args = calls[0]
    assert "--since" in args
    assert "svc" in args


async def test_docker_source_skips_failed_invocation(monkeypatch):
    src = DockerLogSource("docker", "/x/dc.yaml", "svc",
                          pattern=".+", poll_interval=5)

    calls = []

    async def fake_exec(*args, **kwargs):
        calls.append(args)
        # First poll fails (rc!=0), second succeeds
        rc = 1 if len(calls) == 1 else 0
        return _FakeProc(b"second-line\n" if rc == 0 else b"", returncode=rc)

    monkeypatch.setattr("core.logs.sources.docker.asyncio.create_subprocess_exec", fake_exec)
    real_sleep = asyncio.sleep
    monkeypatch.setattr("core.logs.sources.docker.asyncio.sleep",
                        lambda *_a, **_k: real_sleep(0))

    received: list[str] = []

    async def consume():
        async for line in src.stream():
            received.append(line)
            if received:
                return

    await asyncio.wait_for(consume(), timeout=2)
    assert received == ["second-line"]
    assert len(calls) >= 2
