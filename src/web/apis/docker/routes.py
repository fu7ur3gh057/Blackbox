"""Docker compose — live `ps` per configured project, no DB.

Same shape the report's docker section uses, but JSON instead of pre-rendered
text so the frontend can lay it out itself.
"""

import asyncio
import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends

from services.taskiq.broker import broker
from services.taskiq.context import AppContext

log = logging.getLogger(__name__)

router = APIRouter(tags=["docker"])


@router.get("")
async def list_compose() -> list[dict]:
    ctx: AppContext = broker.state.app_ctx
    projects = ((ctx.config.report or {}).get("docker") or [])
    out: list[dict] = []
    for proj in projects:
        compose = proj.get("compose")
        if not compose:
            continue
        try:
            containers = await _ps(compose)
            err: str | None = None
        except Exception as e:
            containers = []
            err = str(e).splitlines()[0]
        out.append({
            "compose": compose,
            "project": Path(compose).parent.name or "project",
            "wanted": proj.get("containers") or [],
            "starred": proj.get("starred") or [],
            "containers": containers,
            "error": err,
        })
    return out


async def _ps(compose_path: str) -> list[dict]:
    proc = await asyncio.create_subprocess_exec(
        "docker", "compose", "-f", compose_path, "ps",
        "--format", "json", "--all",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
    if proc.returncode != 0:
        raise RuntimeError(stderr.decode().strip() or "docker compose failed")
    txt = stdout.decode().strip()
    if not txt:
        return []
    if txt.startswith("["):
        return json.loads(txt)
    return [json.loads(ln) for ln in txt.splitlines() if ln.strip()]
