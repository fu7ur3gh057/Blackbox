"""Socket.IO-сервер: инициализация и остановка.

Пока не подмонтирован к основному приложению — заготовка под realtime-канал
(пуши алертов в UI, прогресс задач). Когда понадобится: вызвать `init_socketio`
из web.lifetime.lifespan, и клиент будет коннектиться на /ws.
"""

import socketio
from fastapi import FastAPI


async def init_socketio(
    app: FastAPI,
    *,
    cors_origins: list[str] | None = None,
    ws_path: str = "socket.io",
) -> None:
    """Создать AsyncServer и примонтировать ASGI-приложение к /ws."""
    server = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins=cors_origins or [],
    )
    sio_app = socketio.ASGIApp(
        socketio_server=server,
        socketio_path=ws_path,
    )

    @server.event
    async def connect(sid: str, environ: dict) -> None:
        # Глобальное подключение — аутентификация будет в namespace'ах.
        pass

    @server.event
    async def disconnect(sid: str) -> None:
        pass

    # Namespace'ы регистрировать здесь, когда появятся.

    app.state.sio_server = server
    app.state.sio_app = sio_app
    app.mount("/ws", app=sio_app)


async def shutdown_socketio(app: FastAPI) -> None:
    """Socket.IO AsyncServer не требует явного закрытия, оставлено под будущее."""
    return None
