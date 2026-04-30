"""Authenticated namespace base class.

All blackbox Socket.IO namespaces inherit from `AuthedNamespace`. The
`on_connect` hook validates a JWT before accepting the connection — same
secret as the REST API. The token is taken from the Socket.IO standard
`auth.token` payload first, then from the `bb_session` cookie sent
during the HTTP handshake (so a browser tab that already logged in via
/api/auth/login can connect with no extra wiring).
"""

import logging

from jwt import InvalidTokenError
from socketio import AsyncNamespace

from services.taskiq.broker import broker
from web.auth.tokens import decode_token

log = logging.getLogger(__name__)


class AuthedNamespace(AsyncNamespace):
    async def on_connect(
        self,
        sid: str,
        environ: dict,
        auth: dict | None = None,
    ) -> bool | None:
        secret = broker.state.data.get("web_jwt_secret")
        if not secret:
            log.warning("sio: refusing %s — auth not configured", self.namespace)
            return False

        token = self._extract_token(auth, environ)
        if not token:
            log.info("sio: refusing %s — no token presented (sid=%s)", self.namespace, sid)
            return False

        try:
            claims = decode_token(token, secret)
        except InvalidTokenError as e:
            log.info("sio: refusing %s — bad token (sid=%s): %s", self.namespace, sid, e)
            return False

        await self.save_session(sid, {"username": claims.get("sub", "")})
        log.info("sio: %s connected to %s as %s",
                 sid, self.namespace, claims.get("sub", "?"))
        return None  # accept

    async def on_disconnect(self, sid: str) -> None:
        log.info("sio: %s disconnected from %s", sid, self.namespace)

    @staticmethod
    def _extract_token(auth: dict | None, environ: dict) -> str | None:
        if isinstance(auth, dict) and auth.get("token"):
            return str(auth["token"])
        cookies = environ.get("HTTP_COOKIE", "")
        for piece in cookies.split(";"):
            piece = piece.strip()
            if piece.startswith("bb_session="):
                return piece[len("bb_session="):]
        return None
