"""Auth endpoints — login (issue JWT + cookie), logout (clear cookie),
me (introspect current session)."""

from fastapi import APIRouter, Depends, HTTPException, Response, status

from services.taskiq.broker import broker
from web.apis.auth.schemas import LoginRequest, MeResponse, TokenResponse
from web.apis.deps import require_auth
from web.auth.passwords import verify_password
from web.auth.tokens import encode_token

router = APIRouter(tags=["auth"])

_COOKIE_NAME = "bb_session"


@router.post("/login", response_model=TokenResponse)
async def login(creds: LoginRequest, response: Response) -> TokenResponse:
    user = broker.state.data.get("web_user")
    secret = broker.state.data.get("web_jwt_secret")
    expiry = broker.state.data.get("web_jwt_expiry", 0)

    if not user or not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="auth not configured")

    if creds.username != user["username"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
    if not verify_password(creds.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")

    token = encode_token({"sub": creds.username}, secret, expiry)
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
    return MeResponse(username=claims.get("sub", ""), expires_at=int(claims.get("exp", 0)))
