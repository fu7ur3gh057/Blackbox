"""Async SQLite engine + session factory, attached to broker.state.

Both TaskIQ tasks and FastAPI handlers reach the DB through the same
session_maker, kept on the module-level broker singleton — no second
source of truth across worker/web."""

import logging
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from services.db import models  # noqa: F401  — registers tables in metadata
from services.taskiq.broker import broker

log = logging.getLogger(__name__)


async def init_db(db_path: str | Path) -> AsyncEngine:
    """Create the engine + tables, attach to broker.state. Idempotent."""
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    url = f"sqlite+aiosqlite:///{db_path}"
    engine = create_async_engine(url, echo=False, future=True)

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    broker.state.db_engine = engine
    broker.state.db_session_maker = session_maker
    log.info("db ready at %s", db_path)
    return engine


async def shutdown_db() -> None:
    engine: AsyncEngine | None = broker.state.data.get("db_engine")
    if engine is None:
        return
    await engine.dispose()
