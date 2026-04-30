"""JWT encode/decode helpers. HS256 with the secret from config.web.jwt.secret."""

from datetime import datetime, timedelta, timezone

import jwt


def encode_token(claims: dict, secret: str, expiry_seconds: int) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        **claims,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expiry_seconds)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(token: str, secret: str) -> dict:
    """Returns the claims dict. Raises jwt.InvalidTokenError (or a subclass —
    ExpiredSignatureError, etc) on bad/expired tokens — let the caller turn
    that into a 401 with the appropriate detail."""
    return jwt.decode(token, secret, algorithms=["HS256"])
