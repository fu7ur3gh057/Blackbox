"""FastAPI app: factory, health and status endpoints, CORS."""

from fastapi.testclient import TestClient

from web.application import get_app


def test_health_endpoint():
    app = get_app()
    with TestClient(app) as client:
        r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_status_endpoint():
    app = get_app()
    with TestClient(app) as client:
        r = client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "blackbox"
    assert "version" in body


def test_openapi_schema_available():
    app = get_app()
    with TestClient(app) as client:
        r = client.get("/api/openapi.json")
    assert r.status_code == 200
    schema = r.json()
    assert "/api/status" in schema["paths"]


def test_cors_allows_nextjs_dev_origin():
    app = get_app()
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
    app = get_app()
    with TestClient(app) as client:
        r = client.options(
            "/api/status",
            headers={
                "Origin": "http://evil.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert "access-control-allow-origin" not in r.headers
