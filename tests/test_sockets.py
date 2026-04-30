"""Socket.IO: auth on connect, emit helper, namespace mounting.

We avoid spinning up a real Socket.IO client (heavy + flaky on TestClient
with mounted ASGI sub-apps) and instead drive the namespace classes
directly. emit() is verified by stubbing broker.state.sio_server with a
recorder.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from web.application import get_app
from web.auth.tokens import encode_token
from web.sockets.namespaces.alerts import AlertsNamespace
from web.sockets.namespaces.base import AuthedNamespace
from web.sockets.namespaces.checks import ChecksNamespace
from web.sockets.namespaces.logs import LogsNamespace


# ── token extraction ──────────────────────────────────────────────────────

def test_extract_token_from_auth_dict():
    assert AuthedNamespace._extract_token({"token": "abc"}, {}) == "abc"


def test_extract_token_from_cookie():
    environ = {"HTTP_COOKIE": "other=1; bb_session=xyz; foo=bar"}
    assert AuthedNamespace._extract_token(None, environ) == "xyz"


def test_extract_token_none_when_missing():
    assert AuthedNamespace._extract_token(None, {}) is None
    assert AuthedNamespace._extract_token({}, {"HTTP_COOKIE": "other=1"}) is None


def test_extract_token_prefers_auth_over_cookie():
    out = AuthedNamespace._extract_token(
        {"token": "from-auth"},
        {"HTTP_COOKIE": "bb_session=from-cookie"},
    )
    assert out == "from-auth"


# ── on_connect ─────────────────────────────────────────────────────────────

class _StubSession:
    """Mimics what AsyncNamespace would normally proxy through the server."""
    def __init__(self):
        self.saved: dict | None = None

    async def save_session(self, sid, data):
        self.saved = data


@pytest.fixture
def alerts_ns():
    ns = AlertsNamespace("/alerts")
    # Patch save_session — base class normally delegates to the server it's
    # registered on, which we don't have in a unit test.
    saved = {}
    async def _save(sid, data):
        saved[sid] = data
    ns.save_session = _save
    ns.__saved__ = saved  # for assertions
    return ns


async def test_connect_rejects_when_secret_unset(alerts_ns, broker):
    broker.state.data.pop("web_jwt_secret", None)
    result = await alerts_ns.on_connect("sid", {}, {"token": "x"})
    assert result is False


async def test_connect_rejects_no_token(alerts_ns, broker):
    broker.state.web_jwt_secret = "test-secret-32-bytes-of-entropy.."
    result = await alerts_ns.on_connect("sid", {}, None)
    assert result is False


async def test_connect_rejects_invalid_token(alerts_ns, broker):
    broker.state.web_jwt_secret = "test-secret-32-bytes-of-entropy.."
    result = await alerts_ns.on_connect("sid", {}, {"token": "garbage"})
    assert result is False


async def test_connect_rejects_wrong_signature(alerts_ns, broker):
    broker.state.web_jwt_secret = "test-secret-32-bytes-of-entropy.."
    bad = encode_token({"sub": "admin"}, "different-secret-32-bytes-rrr.", 60)
    result = await alerts_ns.on_connect("sid", {}, {"token": bad})
    assert result is False


async def test_connect_accepts_valid_token(alerts_ns, broker):
    broker.state.web_jwt_secret = "test-secret-32-bytes-of-entropy.."
    good = encode_token({"sub": "admin"}, "test-secret-32-bytes-of-entropy..", 60)
    result = await alerts_ns.on_connect("sid-1", {}, {"token": good})
    assert result is None  # None = accept
    assert alerts_ns.__saved__["sid-1"] == {"username": "admin"}


async def test_connect_accepts_token_from_cookie(alerts_ns, broker):
    broker.state.web_jwt_secret = "test-secret-32-bytes-of-entropy.."
    good = encode_token({"sub": "admin"}, "test-secret-32-bytes-of-entropy..", 60)
    environ = {"HTTP_COOKIE": f"bb_session={good}"}
    result = await alerts_ns.on_connect("sid-2", environ, None)
    assert result is None
    assert alerts_ns.__saved__["sid-2"] == {"username": "admin"}


# ── checks/logs subscribe handlers ────────────────────────────────────────

@pytest.fixture
def checks_ns():
    ns = ChecksNamespace("/checks")
    rooms: dict[str, set[str]] = {}
    async def _enter(sid, room):
        rooms.setdefault(sid, set()).add(room)
    async def _leave(sid, room):
        rooms.get(sid, set()).discard(room)
    ns.enter_room = _enter
    ns.leave_room = _leave
    ns.__rooms__ = rooms
    return ns


async def test_checks_subscribe_joins_room(checks_ns):
    out = await checks_ns.on_subscribe("sid-1", {"name": "cpu"})
    assert out == {"ok": True, "room": "check:cpu"}
    assert "check:cpu" in checks_ns.__rooms__["sid-1"]


async def test_checks_subscribe_missing_name(checks_ns):
    out = await checks_ns.on_subscribe("sid-1", {})
    assert out == {"ok": False, "error": "missing name"}


async def test_checks_unsubscribe_leaves_room(checks_ns):
    await checks_ns.on_subscribe("sid-1", {"name": "cpu"})
    out = await checks_ns.on_unsubscribe("sid-1", {"name": "cpu"})
    assert out == {"ok": True}
    assert "check:cpu" not in checks_ns.__rooms__.get("sid-1", set())


async def test_logs_subscribe_uses_source_room():
    ns = LogsNamespace("/logs")
    seen: list[tuple[str, str]] = []
    async def _enter(sid, room):
        seen.append((sid, room))
    ns.enter_room = _enter
    out = await ns.on_subscribe("sid-1", {"source": "nginx-error"})
    assert out["room"] == "src:nginx-error"
    assert ("sid-1", "src:nginx-error") in seen


# ── emit helper ────────────────────────────────────────────────────────────

class _RecordingSio:
    def __init__(self):
        self.calls: list[dict] = []

    async def emit(self, event, data, namespace=None, room=None):
        self.calls.append({"event": event, "data": data,
                           "namespace": namespace, "room": room})


async def test_emit_noop_when_sio_unset(broker):
    """Worker-only mode (no --web) → emit must be a silent no-op."""
    broker.state.data.pop("sio_server", None)
    from web.sockets import emit
    await emit("/alerts", "alert:fired", {"x": 1})  # must not raise


async def test_emit_dispatches_to_namespace(broker):
    sio = _RecordingSio()
    broker.state.sio_server = sio
    from web.sockets import emit
    await emit("/alerts", "alert:fired", {"x": 1})
    assert sio.calls == [{"event": "alert:fired", "data": {"x": 1},
                          "namespace": "/alerts", "room": None}]


async def test_emit_dispatches_to_room(broker):
    sio = _RecordingSio()
    broker.state.sio_server = sio
    from web.sockets import emit
    await emit("/checks", "check:result", {"y": 2}, room="check:cpu")
    assert sio.calls == [{"event": "check:result", "data": {"y": 2},
                          "namespace": "/checks", "room": "check:cpu"}]


async def test_emit_swallows_exceptions(broker):
    """A failing emit should never bubble up and crash a task."""
    class _Boom:
        async def emit(self, *a, **k):
            raise RuntimeError("kaboom")
    broker.state.sio_server = _Boom()
    from web.sockets import emit
    await emit("/alerts", "alert:fired", {})  # must not raise


# ── application mounts socket.io under prefix ─────────────────────────────

def test_application_mounts_socketio_under_prefix(broker):
    """The factory should mount the ASGI Socket.IO app at <prefix>/ws."""
    app = get_app(prefix="/blackbox")
    routes = [getattr(r, "path", None) for r in app.routes]
    assert "/blackbox/ws" in routes


def test_application_mounts_socketio_with_empty_prefix(broker):
    app = get_app(prefix="")
    routes = [getattr(r, "path", None) for r in app.routes]
    assert "/ws" in routes
