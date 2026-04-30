"""FastAPI factory for the BlackBox web client."""

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from web.lifetime import lifespan
from web.apis import api_router


# Default to Next.js dev server. In prod (behind SSH tunnel) CORS is moot —
# the request lands on localhost from the user's own browser.
_DEFAULT_CORS = ["http://localhost:3000", "http://127.0.0.1:3000"]


def get_app() -> FastAPI:
    application = FastAPI(
        title="BlackBox",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=_DEFAULT_CORS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix="/api")

    @application.get("/health", include_in_schema=False)
    async def _health() -> dict[str, str]:
        return {"status": "ok"}

    return application
