"""FastAPI lifespan: place to attach process-wide resources.

For now it's a no-op — the API is read-only and gets its data per request
straight from the YAML config and live system state. Slot in clients,
caches or background tasks here once we need them.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
