"""Broker startup/shutdown wiring.

`init_broker` builds the AppContext from a loaded Config, attaches it to
broker.state, and starts the broker. `shutdown_broker` is the symmetric
cleanup. Both are idempotent enough that calling shutdown without a prior
startup is harmless.
"""

import logging

from core.checks import build_check
from core.config import Config
from core.notifiers import build_notifier
from core.report import build_report_context
from services.taskiq.broker import broker
from services.taskiq.context import AppContext

log = logging.getLogger(__name__)


async def init_broker(config: Config) -> AppContext:
    notifiers_by_type = {n.type: build_notifier(n) for n in config.notifiers}
    notifiers = list(notifiers_by_type.values())

    ctx = AppContext(
        config=config,
        checks_by_name={c.name: build_check(c) for c in config.checks},
        notifiers_by_type=notifiers_by_type,
        notifiers=notifiers,
    )

    if config.report:
        report_ctx = build_report_context(
            config.report,
            notifiers_by_type,
            logs_storage_path=((config.logs or {}).get("storage") or {}).get("path"),
        )
        if report_ctx is not None:
            ctx.report_hostname = report_ctx["hostname"]
            ctx.report_lang = report_ctx["lang"]
            ctx.report_sections = report_ctx["sections"]
            ctx.report_targets = report_ctx["targets"]

    if config.logs:
        ctx.log_storage_path = ((config.logs or {}).get("storage") or {}).get("path")

    broker.state.app_ctx = ctx
    await broker.startup()
    log.info(
        "broker ready: %d checks, %d notifiers, broker=%s",
        len(ctx.checks_by_name), len(ctx.notifiers), type(broker).__name__,
    )
    return ctx


async def shutdown_broker() -> None:
    try:
        await broker.shutdown()
    except Exception:
        log.exception("broker shutdown failed")
