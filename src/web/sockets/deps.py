"""Dependencies для Socket.IO."""

from socketio import ASGIApp, AsyncServer
from starlette.requests import Request


async def get_sio_app(request: Request) -> ASGIApp:
    """ASGI-приложение Socket.IO."""
    return request.app.state.sio_app


async def get_sio_server(request: Request) -> AsyncServer:
    """AsyncServer — для emit'а событий из FastAPI-эндпоинтов."""
    return request.app.state.sio_server
