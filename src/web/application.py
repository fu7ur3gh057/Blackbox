"""FastAPI factory for the BlackBox web client.

The path prefix (default `/blackbox`) makes the API self-contained behind
any reverse proxy or direct port access — same URL shape works in both
cases. Override via env BLACKBOX_WEB_PREFIX before instantiating.
"""

import os

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from web.apis import api_router
from web.lifetime import lifespan

# Default to Next.js dev server. In prod (behind SSH tunnel or direct port)
# CORS is moot — the browser hits the same origin once it's reachable.
_DEFAULT_CORS = ["http://localhost:3000", "http://127.0.0.1:3000"]

DEFAULT_PREFIX = "/blackbox"


def get_app(prefix: str | None = None) -> FastAPI:
    if prefix is None:
        prefix = os.environ.get("BLACKBOX_WEB_PREFIX", DEFAULT_PREFIX)
    prefix = prefix.rstrip("/")  # "/blackbox" or "" for no-prefix

    application = FastAPI(
        title="BlackBox",
        version="0.1.0",
        docs_url=f"{prefix}/api/docs",
        redoc_url=f"{prefix}/api/redoc",
        openapi_url=f"{prefix}/api/openapi.json",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=_DEFAULT_CORS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix=f"{prefix}/api")

    @application.get(f"{prefix}/health", include_in_schema=False)
    async def _health() -> dict[str, str]:
        return {"status": "ok"}

    # Socket.IO — mounted under <prefix>/ws/socket.io. Same JWT secret as
    # the REST API guards every namespace via AuthedNamespace.on_connect.
    from web.sockets.lifetime import init_socketio
    init_socketio(application, prefix=prefix, cors_origins=_DEFAULT_CORS)

    return application
