"""Terminal lock — separate username/password gate before opening a shell.

The flow is two-step on purpose:

  1. Browser is logged in (bb_session JWT cookie). Required for /api/* and
     every WS namespace.
  2. To OPEN the in-browser shell, the user has to enter a SECOND set of
     credentials (web.terminal.user.{username, password_hash}). On match
     the server hands back a short-lived token (default TTL 30min). The
     `/terminal` WS namespace requires both: bb_session cookie + this
     terminal token in the auth payload.

That way a stolen bb_session cookie still can't get a root shell — the
attacker would also need the terminal password, which has its own
bcrypt hash and isn't reused from anywhere else in the app.

Failed attempts are written to `terminal_audit` with kind=`auth_failed`
so they show up in the audit table next to successful sessions.
"""

import time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from services.taskiq.broker import broker
from web.apis.deps import require_auth
from web.auth.passwords import verify_password
from web.auth.tokens import encode_token

router = APIRouter(tags=["terminal"])


class UnlockRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class UnlockResponse(BaseModel):
    token: str
    expires_in: int
    username: str


@router.get("/status")
async def terminal_status(claims: dict = Depends(require_auth)) -> dict:
    """Whether the in-browser terminal is configured + enabled. Public to
    any logged-in user so the UI knows whether to show the lock screen
    or a 'disabled' placeholder. Doesn't leak the username."""
    user = broker.state.data.get("terminal_user")
    return {
        "enabled": user is not None,
        "ttl_seconds": int(broker.state.data.get("terminal_token_ttl") or 1800),
    }


@router.post("/unlock", response_model=UnlockResponse)
async def unlock(req: UnlockRequest, claims: dict = Depends(require_auth)) -> UnlockResponse:
    """Step-2 password check. On success returns a short-lived token whose
    only valid use is connecting to the `/terminal` WS namespace."""
    user = broker.state.data.get("terminal_user")
    secret = broker.state.data.get("web_jwt_secret")
    ttl = int(broker.state.data.get("terminal_token_ttl") or 1800)
    web_user = (claims or {}).get("sub", "")

    if not user or not secret:
        await _audit_failed(web_user, "terminal not configured")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="terminal is not enabled in config.web.terminal")

    if req.username != user["username"] or not verify_password(req.password, user["password_hash"]):
        await _audit_failed(web_user, f"bad credentials for username={req.username!r}")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")

    # Distinct claim shape from the web JWT — `aud=terminal` so we can
    # verify the token wasn't crafted from a regular session.
    token = encode_token(
        {"sub": req.username, "aud": "terminal", "via": web_user},
        secret,
        ttl,
    )
    await _audit_ok(web_user, req.username)
    return UnlockResponse(token=token, expires_in=ttl, username=req.username)


# ── audit helpers ────────────────────────────────────────────────────


async def _audit_failed(via_user: str, detail: str) -> None:
    from db.models import TerminalAuditEntry
    sm = broker.state.data.get("db_session_maker")
    if sm is None:
        return
    try:
        async with sm() as session:
            session.add(TerminalAuditEntry(
                ts=time.time(), sid="-", username=via_user,
                kind="auth_failed", data=detail,
            ))
            await session.commit()
    except Exception:
        pass


async def _audit_ok(via_user: str, term_user: str) -> None:
    from db.models import TerminalAuditEntry
    sm = broker.state.data.get("db_session_maker")
    if sm is None:
        return
    try:
        async with sm() as session:
            session.add(TerminalAuditEntry(
                ts=time.time(), sid="-", username=via_user,
                kind="auth_ok", data=f"unlocked terminal user {term_user!r}",
            ))
            await session.commit()
    except Exception:
        pass
