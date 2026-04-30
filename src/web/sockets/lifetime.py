"""Socket.IO setup — register namespaces, mount the ASGI app on the
FastAPI instance under `<prefix>/ws`, attach the server to broker.state
so tasks can `emit()` without passing it around.

Path arithmetic:
    init_socketio(app, prefix="/blackbox") → /blackbox/ws/socket.io/...
    init_socketio(app, prefix="")          → /ws/socket.io/...

Note: Starlette's Mount sets `scope.root_path` but doesn't strip the
prefix from `scope.path` for sub-apps. python-socketio's ASGIApp matches
against the raw path, so we configure its `socketio_path` to include the
mount prefix; the Mount itself is what makes Starlette route requests to
us in the first place.
"""

import logging

from fastapi import FastAPI
from socketio import ASGIApp, AsyncServer

from services.taskiq.broker import broker
from web.sockets.namespaces import (
    AlertsNamespace,
    ChecksNamespace,
    LogsNamespace,
    SystemNamespace,
)

log = logging.getLogger(__name__)


def init_socketio(
    app: FastAPI,
    *,
    prefix: str = "",
    cors_origins: list[str] | None = None,
) -> AsyncServer:
    # Socket.IO does its own Origin check before the WebSocket upgrade and
    # uses an exact-match list — that means same-origin requests from the
    # served bundle (e.g. localhost:8765 hitting localhost:8765) get
    # rejected if the explicit list doesn't include them. We can't
    # enumerate every host the daemon might be reached on, so accept any
    # Origin here and lean on JWT auth in AuthedNamespace.on_connect for
    # actual access control.
    server = AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",
    )
    server.register_namespace(AlertsNamespace("/alerts"))
    server.register_namespace(ChecksNamespace("/checks"))
    server.register_namespace(LogsNamespace("/logs"))
    server.register_namespace(SystemNamespace("/system"))

    mount_path = f"{prefix}/ws" if prefix else "/ws"
    # ASGIApp checks `scope.path.startswith(f"/{socketio_path}/")` — so we
    # bake the full URL prefix in here.
    sio_path = f"{mount_path.lstrip('/')}/socket.io"
    sio_app = ASGIApp(server, socketio_path=sio_path)
    app.mount(mount_path, sio_app)

    broker.state.sio_server = server
    log.info(
        "socket.io mounted at /%s — namespaces: /alerts /checks /logs /system",
        sio_path,
    )
    return server


async def shutdown_socketio() -> None:
    """AsyncServer doesn't need explicit shutdown; the helper is here for
    symmetry with init_*. Drop sio_server from state so a stale handle
    doesn't end up serving emits after shutdown."""
    broker.state.data.pop("sio_server", None)
