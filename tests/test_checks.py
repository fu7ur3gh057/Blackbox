"""Check handlers: thresholds map to levels, kind is set, metrics make sense.

External I/O (psutil, shutil.disk_usage, httpx, systemctl) is monkey-patched.
"""

from collections import namedtuple

import httpx
import pytest
import respx

from core.checks.cpu import CpuCheck
from core.checks.disk import DiskCheck
from core.checks.http import HttpCheck
from core.checks.memory import MemoryCheck
from core.checks.systemd_unit import SystemdUnitCheck


# ── CPU ────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("pct,level", [(10, "ok"), (80, "warn"), (95, "crit")])
async def test_cpu_thresholds(monkeypatch, pct: float, level: str):
    monkeypatch.setattr("core.checks.cpu.psutil.cpu_percent", lambda interval: pct)
    res = await CpuCheck("cpu", interval=60, warn_pct=80, crit_pct=90).run()
    assert res.level == level
    assert res.kind == "cpu"
    assert res.metrics["value"] == pct


async def test_cpu_at_warn_threshold_is_warn(monkeypatch):
    """Boundary: pct == warn_pct → warn (>= comparison)."""
    monkeypatch.setattr("core.checks.cpu.psutil.cpu_percent", lambda interval: 80.0)
    res = await CpuCheck("cpu", interval=60, warn_pct=80, crit_pct=90).run()
    assert res.level == "warn"


# ── Memory ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("pct,level", [(40, "ok"), (85, "warn"), (99, "crit")])
async def test_memory_thresholds(monkeypatch, pct: float, level: str):
    Vm = namedtuple("Vm", "percent")
    monkeypatch.setattr("core.checks.memory.psutil.virtual_memory", lambda: Vm(pct))
    res = await MemoryCheck("mem", interval=60, warn_pct=80, crit_pct=90).run()
    assert res.level == level
    assert res.kind == "memory"


# ── Disk ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("used_pct,level", [(50, "ok"), (85, "warn"), (95, "crit")])
async def test_disk_thresholds(monkeypatch, used_pct: int, level: str):
    Du = namedtuple("Du", "total used free")
    total = 100 * 1024 ** 3
    used = used_pct * 1024 ** 3
    free = total - used
    monkeypatch.setattr("core.checks.disk.shutil.disk_usage", lambda p: Du(total, used, free))
    res = await DiskCheck("disk", interval=60, path="/", warn_pct=80, crit_pct=90).run()
    assert res.level == level
    assert res.kind == "disk"
    assert res.metrics["path"] == "/"
    assert res.metrics["free_gb"] == pytest.approx(100 - used_pct, rel=0.01)


# ── HTTP ───────────────────────────────────────────────────────────────────

@respx.mock
async def test_http_ok():
    respx.get("https://example.com/health").mock(return_value=httpx.Response(200))
    res = await HttpCheck("svc", interval=60, url="https://example.com/health").run()
    assert res.level == "ok"
    assert res.kind == "http"


@respx.mock
async def test_http_wrong_status():
    respx.get("https://example.com/health").mock(return_value=httpx.Response(503))
    res = await HttpCheck("svc", interval=60, url="https://example.com/health").run()
    assert res.level == "crit"
    assert "503" in res.detail


@respx.mock
async def test_http_network_error():
    respx.get("https://example.com/health").mock(side_effect=httpx.ConnectError("boom"))
    res = await HttpCheck("svc", interval=60, url="https://example.com/health").run()
    assert res.level == "crit"
    assert "ConnectError" in res.detail


@respx.mock
async def test_http_custom_expect_status():
    respx.get("https://example.com/redir").mock(return_value=httpx.Response(302))
    res = await HttpCheck("svc", interval=60, url="https://example.com/redir",
                          expect_status=302).run()
    assert res.level == "ok"


# ── Systemd ────────────────────────────────────────────────────────────────

class _FakeProc:
    def __init__(self, stdout: bytes):
        self._stdout = stdout

    async def communicate(self):
        return self._stdout, b""


async def test_systemd_active(monkeypatch):
    async def fake_exec(*args, **kwargs):
        return _FakeProc(b"active\n")
    monkeypatch.setattr("core.checks.systemd_unit.asyncio.create_subprocess_exec", fake_exec)

    res = await SystemdUnitCheck("svc", interval=60, unit="nginx.service").run()
    assert res.level == "ok"
    assert res.metrics["state"] == "active"


async def test_systemd_inactive(monkeypatch):
    async def fake_exec(*args, **kwargs):
        return _FakeProc(b"inactive\n")
    monkeypatch.setattr("core.checks.systemd_unit.asyncio.create_subprocess_exec", fake_exec)

    res = await SystemdUnitCheck("svc", interval=60, unit="nginx.service").run()
    assert res.level == "crit"
    assert res.metrics["state"] == "inactive"


async def test_systemd_missing_binary(monkeypatch):
    async def fake_exec(*args, **kwargs):
        raise FileNotFoundError
    monkeypatch.setattr("core.checks.systemd_unit.asyncio.create_subprocess_exec", fake_exec)

    res = await SystemdUnitCheck("svc", interval=60, unit="nginx.service").run()
    assert res.level == "crit"
    assert "systemctl not found" in res.detail
