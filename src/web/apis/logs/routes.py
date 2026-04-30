"""Logs — recent matched lines (tail of JSONL) + signature aggregates."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlmodel import desc, select
from sqlmodel.ext.asyncio.session import AsyncSession

from services.db.deps import get_session
from services.db.models import LogSignatureEntry
from services.taskiq.broker import broker
from services.taskiq.context import AppContext

router = APIRouter(tags=["logs"])


@router.get("/recent")
async def recent(
    source: str | None = Query(default=None, description="filter by source name"),
    limit: int = Query(default=100, ge=1, le=1000),
) -> list[dict]:
    """Tail the JSONL storage for the last `limit` matching lines.

    Reads ~256 KB from the end of the live file, parses, applies optional
    `source` filter, returns newest-first."""
    ctx: AppContext = broker.state.app_ctx
    path_str = ctx.log_storage_path
    if not path_str:
        return []
    path = Path(path_str)
    if not path.exists():
        return []

    size = path.stat().st_size
    chunk_size = min(size, 256 * 1024)
    with path.open("rb") as f:
        f.seek(size - chunk_size)
        chunk = f.read().decode("utf-8", "replace")

    out: list[dict] = []
    for line in chunk.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if source and ev.get("source") != source:
            continue
        out.append(ev)
    out.reverse()
    return out[:limit]


@router.get("/signatures", response_model=list[LogSignatureEntry])
async def signatures(
    limit: int = Query(default=50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[LogSignatureEntry]:
    q = select(LogSignatureEntry).order_by(desc(LogSignatureEntry.total)).limit(limit)
    return list((await session.exec(q)).all())
