"""Logs — recent matched lines (queried from the store) + signature aggregates."""

from fastapi import APIRouter, Depends, Query
from sqlmodel import desc, select
from sqlmodel.ext.asyncio.session import AsyncSession

from db.deps import get_session
from db.models import LogSignatureEntry
from services.taskiq.broker import broker

router = APIRouter(tags=["logs"])


@router.get("/recent")
async def recent(
    source: str | None = Query(default=None, description="filter by source name"),
    before: float | None = Query(
        default=None,
        description="cursor: only return events with ts < before (epoch seconds)",
    ),
    limit: int = Query(default=200, ge=1, le=1000),
) -> list[dict]:
    """Return up to `limit` recent log events, newest-first. Backed by
    `LogEventStore` — replaces the previous JSONL tail."""
    store = broker.state.data.get("log_store")
    if store is None:
        return []
    return await store.tail(source=source, before=before, limit=limit)


@router.get("/signatures", response_model=list[LogSignatureEntry])
async def signatures(
    limit: int = Query(default=50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[LogSignatureEntry]:
    q = select(LogSignatureEntry).order_by(desc(LogSignatureEntry.total)).limit(limit)
    return list((await session.exec(q)).all())
