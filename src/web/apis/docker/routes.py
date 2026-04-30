"""Docker compose — live `ps` per configured project, no DB.

The same shape is used by the REST endpoint, the dashboard ticker and the
report's docker section, so the collection logic lives in
`collect_docker_snapshot()` and gets imported from both places.
"""

import asyncio
import json
import logging
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from db.models import AlertEvent
from services.taskiq.broker import broker
from services.taskiq.context import AppContext

log = logging.getLogger(__name__)

router = APIRouter(tags=["docker"])


# ── shared collector ──────────────────────────────────────────────────


async def _ps(compose_path: str) -> list[dict]:
    """`docker compose ps --format json --all` for one compose file.

    Returns the raw container list. Raises on subprocess failure so the
    caller can attach the error to the project entry. Always terminates
    the subprocess on timeout — without that, abandoned `docker compose`
    children pile up and slowly leak file descriptors / RAM."""
    proc = await asyncio.create_subprocess_exec(
        "docker", "compose", "-f", compose_path, "ps",
        "--format", "json", "--all",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
    except asyncio.TimeoutError:
        if proc.returncode is None:
            proc.kill()
            try:
                await asyncio.wait_for(proc.wait(), timeout=2)
            except (asyncio.TimeoutError, ProcessLookupError):
                pass
        raise RuntimeError(f"docker compose ps timed out after 10s ({compose_path})")

    if proc.returncode != 0:
        raise RuntimeError(stderr.decode().strip() or "docker compose failed")
    txt = stdout.decode().strip()
    if not txt:
        return []
    if txt.startswith("["):
        return json.loads(txt)
    return [json.loads(ln) for ln in txt.splitlines() if ln.strip()]


async def _safe_ps(compose: str) -> tuple[list[dict], str | None]:
    """Wrapper around `_ps` that returns (containers, error) instead of
    raising — lets us run a batch in parallel via asyncio.gather without
    one bad project killing the rest."""
    try:
        return await _ps(compose), None
    except Exception as e:
        return [], str(e).splitlines()[0]


async def collect_docker_snapshot() -> dict:
    """Snapshot of every project listed in `config.report.docker`.

    All `docker compose ps` calls fan out in parallel — without this, a
    host with several projects spends N×200ms per tick, which becomes the
    actual bottleneck for the 10s ticker cadence.
    """
    ctx: AppContext | None = broker.state.data.get("app_ctx")
    if ctx is None:
        return {"projects": []}

    raw = [p for p in ((ctx.config.report or {}).get("docker") or []) if p.get("compose")]
    if not raw:
        return {"projects": []}

    results = await asyncio.gather(*[_safe_ps(p["compose"]) for p in raw])
    projects: list[dict] = []
    for proj, (containers, err) in zip(raw, results):
        compose = proj["compose"]
        projects.append({
            "compose": compose,
            "project": Path(compose).parent.name or "project",
            "wanted": proj.get("containers") or [],
            "starred": proj.get("starred") or [],
            "containers": containers,
            "error": err,
        })
    return {"projects": projects}


# ── routes ────────────────────────────────────────────────────────────


@router.get("")
async def list_compose() -> list[dict]:
    """Backwards-compatible flat list. Same data the WS ticker pushes,
    just without the `{projects: ...}` envelope."""
    snap = await collect_docker_snapshot()
    return snap["projects"]


# ── discovery ─────────────────────────────────────────────────────────


async def _compose_ls() -> list[dict]:
    """`docker compose ls --format json` — every running compose project
    on this host."""
    proc = await asyncio.create_subprocess_exec(
        "docker", "compose", "ls", "--format", "json",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
    except asyncio.TimeoutError:
        if proc.returncode is None:
            proc.kill()
            try:
                await asyncio.wait_for(proc.wait(), timeout=2)
            except (asyncio.TimeoutError, ProcessLookupError):
                pass
        raise RuntimeError("docker compose ls timed out")

    if proc.returncode != 0:
        raise RuntimeError(stderr.decode().strip() or "docker compose ls failed")
    txt = stdout.decode().strip()
    if not txt:
        return []
    if txt.startswith("["):
        return json.loads(txt)
    return [json.loads(ln) for ln in txt.splitlines() if ln.strip()]


@router.get("/discovered")
async def discovered() -> dict:
    """Compose projects on the host that aren't yet under monitoring.

    Returned shape — `{discovered: [{name, status, compose, services[]}], error}`.
    `services` is a one-shot `ps` so the user can preview what they'd be
    adding before they commit a config edit.
    """
    ctx: AppContext | None = broker.state.data.get("app_ctx")
    monitored: set[str] = set()
    if ctx is not None:
        for p in ((ctx.config.report or {}).get("docker") or []):
            cp = p.get("compose")
            if cp:
                monitored.add(str(cp))

    try:
        all_projects = await _compose_ls()
    except Exception as e:
        return {"discovered": [], "error": str(e).splitlines()[0]}

    out: list[dict] = []
    # Probe everything in parallel — discovery is read-only but with many
    # projects sequential `_ps` adds up.
    candidates = []
    for p in all_projects:
        cf = (p.get("ConfigFiles") or "").split(",")[0].strip()
        if not cf or cf in monitored:
            continue
        candidates.append((p, cf))
    if not candidates:
        return {"discovered": [], "error": None}

    probe_results = await asyncio.gather(*[_safe_ps(cf) for _, cf in candidates])
    for (p, cf), (containers, _err) in zip(candidates, probe_results):
        services = sorted({c.get("Service") for c in containers if c.get("Service")})
        ports = sorted({
            int(pub.get("PublishedPort"))
            for c in containers
            for pub in (c.get("Publishers") or [])
            if pub.get("PublishedPort") and int(pub.get("PublishedPort", 0)) > 0
        })
        out.append({
            "name": p.get("Name", Path(cf).parent.name or "?"),
            "status": p.get("Status", ""),
            "compose": cf,
            "services": services,
            "ports": ports,
        })
    return {"discovered": out, "error": None}


# ── actions ───────────────────────────────────────────────────────────


_PROJECT_ACTIONS = {
    "up":      ["up", "-d", "--remove-orphans"],
    "down":    ["down"],
    "restart": ["restart"],
    "pull":    ["pull"],
}

_SERVICE_ACTIONS = {
    "start":   ["start"],
    "stop":    ["stop"],
    "restart": ["restart"],
}


def _resolve_compose(project: str) -> str:
    """Map URL-friendly project name → compose file path. Looks up
    `config.report.docker[].compose` whose parent dir matches `project`."""
    ctx: AppContext | None = broker.state.data.get("app_ctx")
    if ctx is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "app context not ready")
    for p in ((ctx.config.report or {}).get("docker") or []):
        compose = p.get("compose")
        if not compose:
            continue
        name = Path(compose).parent.name or "project"
        if name == project:
            return compose
    raise HTTPException(status.HTTP_404_NOT_FOUND, f"unknown project {project!r}")


async def _run_compose(compose: str, args: list[str], timeout: float = 90) -> dict:
    """Run `docker compose -f <compose> <args>`. Returns
    `{ok, code, stdout, stderr}`."""
    proc = await asyncio.create_subprocess_exec(
        "docker", "compose", "-f", compose, *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT, "docker compose action timed out")
    return {
        "ok": proc.returncode == 0,
        "code": proc.returncode,
        "stdout": stdout.decode("utf-8", "replace").strip(),
        "stderr": stderr.decode("utf-8", "replace").strip(),
    }


async def _record_action(project: str, service: str | None, action: str, ok: bool, detail: str) -> None:
    """Drop a row into the alerts table so docker actions surface in the
    activity feed alongside check alerts."""
    sm = broker.state.data.get("db_session_maker")
    if sm is None:
        return
    try:
        async with sm() as session:  # type: AsyncSession
            tag = f"docker:{project}" + (f"/{service}" if service else "")
            session.add(AlertEvent(
                ts=time.time(),
                name=tag,
                level="ok" if ok else "warn",
                kind="docker_action",
                detail=f"{action}: {detail[:200]}" if detail else action,
                metrics=None,
            ))
            await session.commit()
    except Exception:
        log.exception("docker: failed to record action %s on %s", action, project)


# ── monitor (add to config) ───────────────────────────────────────────


def _has_comments(text: str) -> bool:
    """Cheap heuristic: any non-trailing `#` likely indicates a user
    comment we'd lose with yaml.safe_dump."""
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("#"):
            return True
    return False


@router.post("/monitor")
async def monitor(payload: dict) -> dict:
    """Adopt a discovered compose project under monitoring.

    - Mutates `config.report.docker` in-memory so /api/docker reflects it
      on the very next snapshot (no restart needed for the running
      session).
    - Persists the change to config.yaml so it survives reboots. Uses
      yaml.safe_dump — works for wizard-generated configs but loses
      hand-written comments. The response includes a warning if any
      comments were detected so the user can choose to revert.
    """
    compose = (payload or {}).get("compose")
    if not compose:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "missing 'compose'")
    services = (payload or {}).get("services") or []

    ctx: AppContext | None = broker.state.data.get("app_ctx")
    if ctx is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "app context not ready")

    # Ensure report.docker exists, then append (idempotent: skip if present).
    report = ctx.config.report
    if report is None:
        ctx.config.report = report = {}
    docker_list = report.setdefault("docker", [])
    already = any((p.get("compose") == compose) for p in docker_list)
    entry = {"compose": compose}
    if services:
        entry["containers"] = list(services)
    if not already:
        docker_list.append(entry)

    # Persist to config.yaml.
    config_path = broker.state.data.get("config_path")
    warning: str | None = None
    if config_path:
        try:
            import yaml as _yaml
            from pathlib import Path as _Path

            cfg_path = _Path(config_path)
            existing_text = cfg_path.read_text() if cfg_path.exists() else ""
            raw = _yaml.safe_load(existing_text) or {}
            raw.setdefault("report", {}).setdefault("docker", [])
            if not any((p.get("compose") == compose) for p in raw["report"]["docker"]):
                raw["report"]["docker"].append(entry)
            new_text = _yaml.safe_dump(raw, sort_keys=False, allow_unicode=True)
            if _has_comments(existing_text):
                warning = "config.yaml had comments — they are NOT preserved by this write."
            cfg_path.write_text(new_text)
        except Exception:
            log.exception("docker.monitor: failed to persist config.yaml")
            warning = "in-memory only — failed to write config.yaml (see server logs)"

    # Push a fresh snapshot so the project card moves from Discovery to
    # the regular list immediately.
    from web.sockets import emit
    snap = await collect_docker_snapshot()
    await emit("/docker", "docker:tick", snap)

    return {
        "ok": True,
        "compose": compose,
        "already_monitored": already,
        "warning": warning,
    }


@router.post("/{project}/{action}")
async def project_action(project: str, action: str) -> dict:
    """Run a project-level docker compose action.

    Allowed actions: up, down, restart, pull. Each runs with a 90s
    timeout; result is logged to the alerts table so it shows up in the
    UI's recent-activity feed."""
    if action not in _PROJECT_ACTIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unknown action {action!r}")
    compose = _resolve_compose(project)
    log.info("docker action: project=%s action=%s", project, action)
    res = await _run_compose(compose, _PROJECT_ACTIONS[action])
    detail = res["stderr"] or res["stdout"]
    await _record_action(project, None, action, res["ok"], detail)

    # Push a fresh snapshot so the dashboard reflects the new state without
    # waiting for the next 15s tick.
    from web.sockets import emit
    snap = await collect_docker_snapshot()
    await emit("/docker", "docker:tick", snap)

    return res


@router.post("/{project}/{service}/{action}")
async def service_action(project: str, service: str, action: str) -> dict:
    """Run a per-service action: start, stop, restart."""
    if action not in _SERVICE_ACTIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unknown action {action!r}")
    compose = _resolve_compose(project)
    log.info("docker action: project=%s service=%s action=%s", project, service, action)
    res = await _run_compose(compose, [*_SERVICE_ACTIONS[action], service])
    detail = res["stderr"] or res["stdout"]
    await _record_action(project, service, action, res["ok"], detail)

    from web.sockets import emit
    snap = await collect_docker_snapshot()
    await emit("/docker", "docker:tick", snap)

    return res
