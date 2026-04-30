"""BlackBox entrypoint.

Single process. Always runs the TaskIQ broker + scheduler that drive
periodic checks, alerts and the digest report. Optionally also runs the
FastAPI web client in the same event loop when invoked with `--web` (or
when `web.enabled: true` is set in config.yaml).

Run modes:
    python -m main config.yaml             # worker only
    python -m main config.yaml --web       # worker + web on 127.0.0.1:8765
"""

import argparse
import asyncio
import logging
import signal
import sys
from pathlib import Path

from config import Config, load_config
from core.logs import build_log_processor
from services.taskiq.broker import broker
from services.taskiq.lifetime import init_broker, shutdown_broker
from services.taskiq.scheduler import run_scheduler

# Eager import so @broker.task definitions register before broker.startup().
import tasks  # noqa: F401


def _parse_args(argv: list[str]) -> tuple[Path, bool]:
    p = argparse.ArgumentParser(prog="blackbox", description="server monitoring → telegram")
    p.add_argument("config", nargs="?", default="config.yaml", help="path to config.yaml")
    p.add_argument("--web", action="store_true", help="also start the FastAPI web client")
    args = p.parse_args(argv)
    return Path(args.config), args.web


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    config_path, web_flag = _parse_args(sys.argv[1:])
    config = load_config(config_path)
    web_enabled = web_flag or bool((getattr(config, "web", None) or {}).get("enabled"))
    broker.state.config_path = str(Path(config_path).resolve())
    asyncio.run(_run(config, web_enabled=web_enabled))


async def _run(config: Config, *, web_enabled: bool) -> None:
    log = logging.getLogger(__name__)

    ctx = await init_broker(config)

    if web_enabled:
        from web.auth.lifetime import init_auth
        init_auth(config)

    for n in ctx.notifiers:
        try:
            await n.send_startup()
        except Exception:
            log.exception("startup notification failed for %s", type(n).__name__)

    coros = []

    if ctx.checks_by_name or ctx.report_targets or ctx.logs_enabled:
        coros.append(run_scheduler(ctx))

    if config.logs:
        log_processor = build_log_processor(
            config.logs,
            ctx.notifiers_by_type,
            store=broker.state.data.get("log_store"),
        )
        if log_processor is not None:
            # Pin to broker.state so /api/docker/monitor (and any other
            # endpoint that wants to hot-plug a source) can reach it
            # without a global import cycle.
            broker.state.log_processor = log_processor
            coros.append(log_processor.run())

    if web_enabled:
        coros.append(_run_web(config))

    if not coros:
        log.warning("nothing to run, exiting")
        await shutdown_broker()
        return

    tasks_ = [asyncio.create_task(c) for c in coros]

    loop = asyncio.get_running_loop()
    stop = loop.create_future()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _set_if_pending, stop, sig.name)
        except (NotImplementedError, RuntimeError):
            pass

    try:
        await asyncio.wait(
            [stop, *tasks_], return_when=asyncio.FIRST_COMPLETED,
        )
        if stop.done():
            log.info("received %s, shutting down", stop.result())
    finally:
        for t in tasks_:
            t.cancel()
        await asyncio.gather(*tasks_, return_exceptions=True)

        for n in ctx.notifiers:
            try:
                await asyncio.wait_for(n.send_shutdown(), timeout=5)
            except Exception:
                log.exception("shutdown notification failed for %s", type(n).__name__)

        await shutdown_broker()


async def _run_web(config: Config) -> None:
    """Embed uvicorn in the current event loop so the broker (and AppContext)
    is shared between scheduler tasks and HTTP handlers.

    Bind/port/prefix come from `web:` in config.yaml, with env overrides
    BLACKBOX_WEB_{HOST,PORT,PREFIX}. Defaults: 0.0.0.0:8765/blackbox so the
    user can hit `http://<vps-ip>:8765/blackbox/api/docs` immediately."""
    import os

    import uvicorn

    web_cfg = config.web or {}
    host = os.environ.get("BLACKBOX_WEB_HOST") or web_cfg.get("host", "0.0.0.0")
    port = int(os.environ.get("BLACKBOX_WEB_PORT") or web_cfg.get("port", 8765))
    prefix = (os.environ.get("BLACKBOX_WEB_PREFIX")
              or web_cfg.get("prefix", "/blackbox")).rstrip("/")

    # The factory reads BLACKBOX_WEB_PREFIX at call time; set it explicitly
    # so a value coming from config.yaml propagates.
    os.environ["BLACKBOX_WEB_PREFIX"] = prefix

    log = logging.getLogger(__name__)
    public_ip = await _detect_public_ip()
    visible_host = public_ip or (host if host != "0.0.0.0" else "<vps-ip>")
    log.info("web: http://%s:%d%s/api/docs (Swagger)", visible_host, port, prefix or "")
    log.info("web: http://%s:%d%s/api/redoc", visible_host, port, prefix or "")
    log.info("web: http://%s:%d%s/health (healthcheck)", visible_host, port, prefix or "")

    cfg = uvicorn.Config(
        "web.application:get_app",
        factory=True,
        host=host,
        port=port,
        log_level="info",
        lifespan="on",
    )
    server = uvicorn.Server(cfg)
    # Suppress uvicorn's own signal handlers — main owns SIGINT/SIGTERM.
    server.install_signal_handlers = lambda: None  # type: ignore[method-assign]
    await server.serve()


async def _detect_public_ip() -> str | None:
    """Best-effort: ipify gives the egress IP, then a UDP-trick local IP."""
    import socket

    import httpx

    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get("https://api.ipify.org")
        if r.status_code == 200 and r.text.strip():
            return r.text.strip()
    except Exception:
        pass

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def _set_if_pending(fut: asyncio.Future, value: str) -> None:
    if not fut.done():
        fut.set_result(value)


if __name__ == "__main__":
    main()
