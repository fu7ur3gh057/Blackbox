"""FastAPI app: factory, prefix, endpoints, CORS."""

from fastapi.testclient import TestClient

from web.application import DEFAULT_PREFIX, get_app


# ── default prefix (/blackbox) ─────────────────────────────────────────────

def test_default_prefix_is_blackbox():
    """Without args, the factory uses DEFAULT_PREFIX so a fresh deploy
    gets `/blackbox/...` URLs out of the box."""
    app = get_app()
    with TestClient(app) as client:
        r = client.get(f"{DEFAULT_PREFIX}/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_root_health_404_when_prefix_set():
    """/health without the prefix shouldn't resolve when a prefix is in play
    — guards against accidentally double-mounting."""
    app = get_app()
    with TestClient(app) as client:
        r = client.get("/health")
    assert r.status_code == 404


# ── empty-prefix mode (legacy / behind path-stripping proxy) ───────────────

def test_empty_prefix_mode():
    app = get_app(prefix="")
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/status").status_code == 200


# ── routes & openapi ───────────────────────────────────────────────────────

def test_status_endpoint():
    app = get_app(prefix="")
    with TestClient(app) as client:
        r = client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "blackbox"
    assert "version" in body


def test_openapi_schema_lists_prefixed_paths():
    app = get_app(prefix="/blackbox")
    with TestClient(app) as client:
        r = client.get("/blackbox/api/openapi.json")
    assert r.status_code == 200
    schema = r.json()
    assert "/blackbox/api/status" in schema["paths"]


def test_swagger_html_served_at_prefix():
    app = get_app(prefix="/blackbox")
    with TestClient(app) as client:
        r = client.get("/blackbox/api/docs")
    assert r.status_code == 200
    assert "swagger" in r.text.lower()


def test_env_var_drives_prefix_when_arg_omitted(monkeypatch):
    monkeypatch.setenv("BLACKBOX_WEB_PREFIX", "/custom")
    app = get_app()
    with TestClient(app) as client:
        assert client.get("/custom/health").status_code == 200
        assert client.get("/blackbox/health").status_code == 404


def test_explicit_prefix_overrides_env(monkeypatch):
    monkeypatch.setenv("BLACKBOX_WEB_PREFIX", "/custom")
    app = get_app(prefix="/blackbox")
    with TestClient(app) as client:
        assert client.get("/blackbox/health").status_code == 200


# ── CORS ──────────────────────────────────────────────────────────────────

def test_cors_allows_nextjs_dev_origin():
    app = get_app(prefix="")
    with TestClient(app) as client:
        r = client.options(
            "/api/status",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_rejects_unknown_origin():
    app = get_app(prefix="")
    with TestClient(app) as client:
        r = client.options(
            "/api/status",
            headers={
                "Origin": "http://evil.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert "access-control-allow-origin" not in r.headers
