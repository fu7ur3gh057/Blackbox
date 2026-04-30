"""Auth: login issues a JWT, protected routes reject without it, accept
with bearer header or bb_session cookie, reject expired/wrong tokens."""

import time
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from web.application import get_app
from web.auth.passwords import hash_password
from web.auth.tokens import encode_token


@pytest.fixture
def client(broker) -> Iterator[TestClient]:
    broker.state.web_user = {
        "username": "admin",
        "password_hash": hash_password("hunter2pass"),
    }
    broker.state.web_jwt_secret = "test-secret-32-bytes-of-entropy.."
    broker.state.web_jwt_expiry = 3600
    with TestClient(get_app(prefix="")) as c:
        yield c


# ── login ──────────────────────────────────────────────────────────────────

def test_login_returns_jwt_and_sets_cookie(client: TestClient):
    r = client.post("/api/auth/login",
                    json={"username": "admin", "password": "hunter2pass"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["username"] == "admin"
    assert body["access_token"]
    assert "bb_session" in r.cookies


def test_login_wrong_password(client: TestClient):
    r = client.post("/api/auth/login",
                    json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_login_unknown_user(client: TestClient):
    r = client.post("/api/auth/login",
                    json={"username": "ghost", "password": "hunter2pass"})
    assert r.status_code == 401


# ── require_auth ───────────────────────────────────────────────────────────

def test_protected_route_requires_token(client: TestClient):
    r = client.get("/api/system")
    assert r.status_code == 401


def test_protected_route_accepts_bearer(client: TestClient, broker):
    token = encode_token({"sub": "admin"}, broker.state.web_jwt_secret, 60)
    r = client.get("/api/system", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


def test_protected_route_accepts_cookie(client: TestClient):
    login = client.post("/api/auth/login",
                        json={"username": "admin", "password": "hunter2pass"})
    assert login.status_code == 200
    # TestClient persists cookies across requests on the same client
    r = client.get("/api/system")
    assert r.status_code == 200


def test_protected_route_rejects_expired_token(client: TestClient, broker):
    # Encode with negative expiry so it's already past
    token = encode_token({"sub": "admin"}, broker.state.web_jwt_secret, -10)
    r = client.get("/api/system", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower()


def test_protected_route_rejects_wrong_signature(client: TestClient):
    token = encode_token({"sub": "admin"}, "different-secret-32-bytes-of-..", 60)
    r = client.get("/api/system", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


# ── /me ────────────────────────────────────────────────────────────────────

def test_me_returns_current_username(client: TestClient, broker):
    token = encode_token({"sub": "admin"}, broker.state.web_jwt_secret, 60)
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["username"] == "admin"


def test_me_unauthorized_without_token(client: TestClient):
    assert client.get("/api/auth/me").status_code == 401


# ── service unavailable when user not configured ──────────────────────────

def test_login_503_when_user_not_configured(broker):
    broker.state.data.pop("web_user", None)
    with TestClient(get_app(prefix="")) as c:
        r = c.post("/api/auth/login",
                   json={"username": "admin", "password": "x"})
    assert r.status_code == 503


def test_logout_clears_cookie(client: TestClient):
    client.post("/api/auth/login",
                json={"username": "admin", "password": "hunter2pass"})
    r = client.post("/api/auth/logout")
    assert r.status_code == 200
    # cookie should be cleared (set with empty/expired value)
    set_cookie = r.headers.get("set-cookie", "")
    assert "bb_session" in set_cookie
