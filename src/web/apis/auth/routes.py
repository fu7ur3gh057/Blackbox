"""Auth endpoints — login (issue JWT + cookie), logout (clear cookie),
me (introspect current session). User accounts live in the `users` table."""

import time

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import select

from db.models import User
from services.taskiq.broker import broker
from web.apis.auth.schemas import LoginRequest, MeResponse, TokenResponse
from web.apis.deps import require_auth
from web.auth.passwords import verify_password
from web.auth.tokens import encode_token

router = APIRouter(tags=["auth"])

_COOKIE_NAME = "bb_session"


@router.post("/login", response_model=TokenResponse)
async def login(creds: LoginRequest, response: Response) -> TokenResponse:
    secret = broker.state.data.get("web_jwt_secret")
    expiry = broker.state.data.get("web_jwt_expiry", 0)
    sm = broker.state.data.get("db_session_maker")

    if not secret or sm is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="auth not configured")

    async with sm() as session:
        row = (await session.exec(
            select(User).where(User.username == creds.username),
        )).first()

        # One generic 401 for missing user / inactive user / bad
        # password — don't leak which condition failed.
        if (
            row is None
            or not row.is_active
            or not verify_password(creds.password, row.password_hash)
        ):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")

        # Stamp the login so admins can see who's actually using the UI.
        row.last_login_ts = time.time()
        session.add(row)
        await session.commit()

    token = encode_token(
        {"sub": creds.username, "role": row.role},
        secret,
        expiry,
    )
    response.set_cookie(
        _COOKIE_NAME, token,
        httponly=True, samesite="lax", max_age=expiry,
        # secure left off so it works over plain http-on-port; flip on once
        # behind TLS-terminating proxy.
    )
    return TokenResponse(
        access_token=token,
        expires_in=expiry,
        username=creds.username,
    )


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(_COOKIE_NAME)
    return {"ok": True}


@router.get("/me", response_model=MeResponse)
async def me(claims: dict = Depends(require_auth)) -> MeResponse:
    return MeResponse(
        username=claims.get("sub", ""),
        role=claims.get("role", "admin"),
        expires_at=int(claims.get("exp", 0)),
    )
