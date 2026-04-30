"""End-to-end tests for protected API endpoints. Builds a real broker with
DB, seeds AppContext + auth state, then drives FastAPI through TestClient.
"""

import time
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from core.checks.base import Result
from core.config import CheckConfig, Config, NotifierConfig
from core.notifiers.base import Notifier as NotifierProto  # noqa: F401
from services.db.models import AlertEvent, CheckResult, CheckStateEntry, LogSignatureEntry
from services.taskiq.context import AppContext
from web.application import get_app
from web.auth.passwords import hash_password
from web.auth.tokens import encode_token


# ── fixtures ───────────────────────────────────────────────────────────────

class _StubNotifier:
    type = "telegram"
    lang = "en"

    def __init__(self):
        self.sent = []

    async def send(self, alert):
        self.sent.append(alert)

    async def send_text(self, text): ...
    async def send_startup(self): ...
    async def send_shutdown(self): ...
    async def send_log_first(self, *a, **k): ...
    async def send_log_digest(self, *a, **k): ...


class _StubCheck:
    interval = 60.0

    def __init__(self, name):
        self.name = name

    async def run(self):
        return Result(level="ok", kind="cpu", detail="ok")


@pytest.fixture
def app_ctx_seeded(broker, tmp_path):
    notifier = _StubNotifier()
    check_cfg = CheckConfig(type="cpu", name="cpu", interval=60.0, options={})
    log_path = tmp_path / "blackbox.jsonl"

    cfg = Config(
        checks=[check_cfg],
        notifiers=[NotifierConfig(type="telegram", options={})],
        report={"hostname": "vps", "host": {"disks": ["/"]}, "interval": 600},
        logs={"storage": {"path": str(log_path)}},
    )
    ctx = AppContext(
        config=cfg,
        checks_by_name={"cpu": _StubCheck("cpu")},
        notifiers_by_type={"telegram": notifier},
        notifiers=[notifier],
        log_storage_path=str(log_path),
    )
    broker.state.app_ctx = ctx
    broker.state.web_user = {
        "username": "admin",
        "password_hash": hash_password("hunter2pass"),
    }
    broker.state.web_jwt_secret = "test-secret-32-bytes-of-entropy.."
    broker.state.web_jwt_expiry = 3600
    return ctx, notifier, log_path


@pytest.fixture
def auth_headers(broker, app_ctx_seeded):
    token = encode_token({"sub": "admin"}, broker.state.web_jwt_secret, 60)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(app_ctx_seeded) -> Iterator[TestClient]:
    with TestClient(get_app(prefix="")) as c:
        yield c


# ── /api/system ────────────────────────────────────────────────────────────

def test_system_snapshot(client, auth_headers):
    r = client.get("/api/system", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "cpu_pct" in body
    assert "memory_pct" in body
    assert isinstance(body["disks"], list)
    assert body["disks"] and body["disks"][0]["path"] == "/"


# ── /api/checks ────────────────────────────────────────────────────────────

def test_checks_list_empty_state(client, auth_headers):
    r = client.get("/api/checks", headers=auth_headers)
    assert r.status_code == 200
    [check] = r.json()
    assert check["name"] == "cpu"
    assert check["level"] is None  # never run


async def test_checks_list_after_state_persist(broker, client, auth_headers):
    """Seed a state row + history result and verify the list endpoint exposes them."""
    async with broker.state.db_session_maker() as s:
        s.add(CheckStateEntry(name="cpu", level="warn", updated_at=100.0))
        s.add(CheckResult(ts=100.0, name="cpu", kind="cpu", level="warn",
                          detail="84%", metrics={"value": 84.2}))
        await s.commit()

    r = client.get("/api/checks", headers=auth_headers)
    [check] = r.json()
    assert check["level"] == "warn"
    assert check["last_value"] == 84.2
    assert check["last_run_ts"] == 100.0


async def test_checks_history_orders_chronologically(broker, client, auth_headers):
    async with broker.state.db_session_maker() as s:
        for ts in (10, 20, 30, 40):
            s.add(CheckResult(ts=ts, name="cpu", kind="cpu", level="ok",
                              metrics={"value": ts}))
        await s.commit()

    r = client.get("/api/checks/cpu/history?limit=10", headers=auth_headers)
    rows = r.json()
    assert [row["ts"] for row in rows] == [10, 20, 30, 40]


async def test_checks_history_window(broker, client, auth_headers):
    async with broker.state.db_session_maker() as s:
        for ts in (10, 20, 30, 40):
            s.add(CheckResult(ts=ts, name="cpu", kind="cpu", level="ok"))
        await s.commit()

    r = client.get("/api/checks/cpu/history?since=15&before=35", headers=auth_headers)
    rows = r.json()
    assert [row["ts"] for row in rows] == [20, 30]


def test_checks_run_unknown_404(client, auth_headers):
    r = client.post("/api/checks/ghost/run", headers=auth_headers)
    assert r.status_code == 404


def test_checks_run_known_returns_queued(client, auth_headers):
    r = client.post("/api/checks/cpu/run", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body == {"name": "cpu", "queued": True}


# ── /api/alerts ────────────────────────────────────────────────────────────

async def test_alerts_list_newest_first(broker, client, auth_headers):
    async with broker.state.db_session_maker() as s:
        s.add(AlertEvent(ts=10.0, name="cpu", level="warn"))
        s.add(AlertEvent(ts=20.0, name="cpu", level="crit"))
        s.add(AlertEvent(ts=30.0, name="memory", level="warn"))
        await s.commit()

    r = client.get("/api/alerts", headers=auth_headers)
    rows = r.json()
    assert [row["ts"] for row in rows] == [30, 20, 10]


async def test_alerts_filter_by_name_and_level(broker, client, auth_headers):
    async with broker.state.db_session_maker() as s:
        s.add(AlertEvent(ts=10.0, name="cpu", level="warn"))
        s.add(AlertEvent(ts=20.0, name="cpu", level="crit"))
        s.add(AlertEvent(ts=30.0, name="memory", level="warn"))
        await s.commit()

    r = client.get("/api/alerts?name=cpu&level=warn", headers=auth_headers)
    rows = r.json()
    assert [row["ts"] for row in rows] == [10]


async def test_alerts_cursor_pagination(broker, client, auth_headers):
    async with broker.state.db_session_maker() as s:
        for ts in (10, 20, 30, 40):
            s.add(AlertEvent(ts=float(ts), name="cpu", level="warn"))
        await s.commit()

    r = client.get("/api/alerts?before=30", headers=auth_headers)
    rows = r.json()
    assert [row["ts"] for row in rows] == [20, 10]


# ── /api/reports/preview ──────────────────────────────────────────────────

def test_reports_preview_400_when_no_sections(client, auth_headers, broker):
    broker.state.app_ctx.report_sections = []
    r = client.post("/api/reports/preview", headers=auth_headers)
    assert r.status_code == 400


def test_reports_preview_renders(client, auth_headers, broker):
    from core.report.sections.base import Section, SectionResult

    class StubSec(Section):
        async def render(self):
            return SectionResult(text="📊 host\nload 0.1", warnings=[])

    broker.state.app_ctx.report_sections = [StubSec()]
    broker.state.app_ctx.report_hostname = "vps01"
    broker.state.app_ctx.report_lang = "en"

    r = client.post("/api/reports/preview", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["hostname"] == "vps01"
    assert "load 0.1" in body["html"]


# ── /api/notifiers ─────────────────────────────────────────────────────────

def test_notifiers_list(client, auth_headers):
    r = client.get("/api/notifiers", headers=auth_headers)
    assert r.status_code == 200
    [n] = r.json()
    assert n["type"] == "telegram"


def test_notifier_test_unknown_type_404(client, auth_headers):
    r = client.post("/api/notifiers/slack/test",
                    json={"message": "x", "level": "warn"}, headers=auth_headers)
    assert r.status_code == 404


def test_notifier_test_dispatches_alert(client, auth_headers, app_ctx_seeded):
    _ctx, notifier, _ = app_ctx_seeded
    r = client.post("/api/notifiers/telegram/test",
                    json={"message": "ping", "level": "warn"}, headers=auth_headers)
    assert r.status_code == 200
    assert len(notifier.sent) == 1
    assert notifier.sent[0].detail == "ping"
    assert notifier.sent[0].level == "warn"


def test_notifier_test_rejects_bad_level(client, auth_headers):
    r = client.post("/api/notifiers/telegram/test",
                    json={"message": "x", "level": "bogus"}, headers=auth_headers)
    assert r.status_code == 400


# ── /api/logs ──────────────────────────────────────────────────────────────

def test_logs_recent_empty_when_no_file(client, auth_headers, app_ctx_seeded):
    r = client.get("/api/logs/recent", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_logs_recent_returns_tail(client, auth_headers, app_ctx_seeded):
    _, _, log_path = app_ctx_seeded
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w") as f:
        for i in range(5):
            f.write(f'{{"ts": {i}, "source": "svc", "sig": "s{i}", "first": false, "line": "l{i}"}}\n')

    r = client.get("/api/logs/recent?limit=3", headers=auth_headers)
    rows = r.json()
    assert len(rows) == 3
    assert [row["line"] for row in rows] == ["l4", "l3", "l2"]


def test_logs_recent_filter_by_source(client, auth_headers, app_ctx_seeded):
    _, _, log_path = app_ctx_seeded
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w") as f:
        f.write('{"ts": 1, "source": "a", "sig": "1", "first": false, "line": "x"}\n')
        f.write('{"ts": 2, "source": "b", "sig": "2", "first": false, "line": "y"}\n')

    r = client.get("/api/logs/recent?source=b", headers=auth_headers)
    [row] = r.json()
    assert row["source"] == "b"


async def test_logs_signatures_top_by_total(broker, client, auth_headers):
    async with broker.state.db_session_maker() as s:
        s.add(LogSignatureEntry(sig="a", source="svc", sample="x", first_seen=1.0, total=100))
        s.add(LogSignatureEntry(sig="b", source="svc", sample="y", first_seen=2.0, total=10))
        s.add(LogSignatureEntry(sig="c", source="svc", sample="z", first_seen=3.0, total=50))
        await s.commit()

    r = client.get("/api/logs/signatures?limit=2", headers=auth_headers)
    rows = r.json()
    assert [row["sig"] for row in rows] == ["a", "c"]


# ── /api/config ────────────────────────────────────────────────────────────

def test_config_view_masks_secrets(client, auth_headers, app_ctx_seeded):
    ctx, _, _ = app_ctx_seeded
    ctx.notifiers[0].type = "telegram"  # already
    ctx.config.notifiers[0].options.update({"bot_token": "REAL", "chat_id": "42"})

    r = client.get("/api/config", headers=auth_headers)
    body = r.json()
    n = body["notifiers"][0]
    assert n["bot_token"] == "***"
    assert n["chat_id"] == "***"
    # non-secret stuff should pass through:
    assert body["checks"][0]["name"] == "cpu"


# ── /api/status (public) ───────────────────────────────────────────────────

def test_status_public(client):
    r = client.get("/api/status")
    assert r.status_code == 200
    assert r.json()["service"] == "blackbox"
