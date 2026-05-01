"""Common API dependencies — JWT auth.

`require_auth` is the gate for every protected route. It accepts either:
  - `Authorization: Bearer <jwt>` (typical from API clients)
  - `bb_session=<jwt>` httpOnly cookie (set by /api/auth/login)

Returns the JWT claims dict (e.g. `{"sub": "admin", ...}`) so handlers
that care about the caller can pull `claims["sub"]`.
"""

from fastapi import Cookie, Depends, Header, HTTPException, status
from jwt import ExpiredSignatureError, InvalidTokenError

from services.taskiq.broker import broker
from web.auth.tokens import decode_token


async def require_auth(
    authorization: str | None = Header(default=None),
    bb_session: str | None = Cookie(default=None),
) -> dict:
    secret: str | None = broker.state.data.get("web_jwt_secret")
    if not secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth not configured",
        )

    raw: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        raw = authorization.split(" ", 1)[1].strip()
    elif bb_session:
        raw = bb_session

    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="missing token")

    try:
        return decode_token(raw, secret)
    except ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="token expired")
    except InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid token")


async def require_admin(claims: dict = Depends(require_auth)) -> dict:
    """Stricter gate — only `role: admin` claims pass. Staff / viewer
    JWTs are rejected with 403. Use this on routers that touch
    privileged surface area (terminal shell, docker actions, user
    management, runtime settings)."""
    if claims.get("role") != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="admin role required",
        )
    return claims
