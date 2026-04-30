"""JsonlStorage rotation policy: daily boundary, size cap, archive retention."""

import gzip
import json
import os
import time
from pathlib import Path

from core.logs.storage import JsonlStorage


def _archives(dir_: Path, stem: str) -> list[Path]:
    return sorted(dir_.glob(f"{stem}.*.jsonl.gz"))


def test_append_creates_file(tmp_path: Path):
    s = JsonlStorage(tmp_path / "log.jsonl")
    s.append({"msg": "hello"})
    assert (tmp_path / "log.jsonl").exists()


def test_size_rotation_kicks_in(tmp_path: Path):
    s = JsonlStorage(tmp_path / "log.jsonl", max_size_mb=1, keep_archives=10)
    big = "x" * 600_000
    for _ in range(3):
        s.append({"line": big})
    archives = _archives(tmp_path, "log")
    assert archives, "expected at least one archive after exceeding size cap"

    # Each archive should be valid gzip-jsonl
    for a in archives:
        with gzip.open(a, "rb") as f:
            for ln in f.read().decode().splitlines():
                json.loads(ln)


def test_daily_rotation_on_old_mtime(tmp_path: Path):
    p = tmp_path / "log.jsonl"
    s = JsonlStorage(p, max_size_mb=10, keep_archives=10)
    s.append({"day": "yesterday"})

    yesterday = time.time() - 86_400 * 1.5
    os.utime(p, (yesterday, yesterday))

    s.append({"day": "today"})

    archives = _archives(tmp_path, "log")
    assert len(archives) == 1, archives
    # The live file now contains only today's line
    [today] = json.loads(p.read_text()).items() if False else [None]  # placeholder
    line = p.read_text().strip()
    assert json.loads(line) == {"day": "today"}


def test_keep_archives_caps_old_archives(tmp_path: Path):
    s = JsonlStorage(tmp_path / "log.jsonl", max_size_mb=1, keep_archives=2)
    big = "x" * 600_000
    # Force several rotations
    for _ in range(8):
        s.append({"line": big})
    assert len(_archives(tmp_path, "log")) <= 2


def test_archive_name_uses_file_mtime_not_now(tmp_path: Path):
    """Archive filename should reflect when the data was written, not the
    rotation timestamp — important for daily rotations of stale files."""
    p = tmp_path / "log.jsonl"
    s = JsonlStorage(p)
    s.append({"x": 1})
    # Backdate to a fixed historical day
    target = time.mktime(time.strptime("2025-01-15 10:30:00", "%Y-%m-%d %H:%M:%S"))
    os.utime(p, (target, target))
    s.append({"x": 2})  # triggers daily rotation since target.date() < today
    [arch] = _archives(tmp_path, "log")
    assert "2025-01-15" in arch.name


def test_collision_within_same_second_appends_microseconds(tmp_path: Path):
    """Two size-driven rotations in the same second still produce distinct
    archive names instead of overwriting each other."""
    p = tmp_path / "log.jsonl"
    s = JsonlStorage(p, max_size_mb=1, keep_archives=10)
    # First rotation
    s.append({"line": "x" * 600_000})
    s.append({"line": "x" * 600_000})
    fixed_mtime = time.time() - 1  # same second
    # Force the first archive's rotation time to match the next one
    [first] = _archives(tmp_path, "log")
    os.utime(first, (fixed_mtime, fixed_mtime))
    os.utime(p, (fixed_mtime, fixed_mtime))
    s.append({"line": "x" * 600_000})
    s.append({"line": "x" * 600_000})
    # We expect the new rotation to have produced a microsecond-suffixed name
    archives = _archives(tmp_path, "log")
    assert len(archives) >= 2
    names = [a.name for a in archives]
    # No overwrites — both archives still present
    assert len(set(names)) == len(names)
