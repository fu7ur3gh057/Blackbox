"""Log notification tasks — dispatch first-seen and digest events through
the configured notifiers. Source filtering (which notifier to target) is
read from `config.logs.notifier` via AppContext."""

import logging

from services.taskiq.broker import broker
from services.taskiq.context import AppContext
from services.taskiq.deps import get_app_context
from taskiq import TaskiqDepends

log = logging.getLogger(__name__)


def _resolve_targets(ctx: AppContext) -> list:
    """Pick the notifier(s) the logs section should hit."""
    sel = (ctx.config.logs or {}).get("notifier") if ctx.config.logs else None
    if sel and sel in ctx.notifiers_by_type:
        return [ctx.notifiers_by_type[sel]]
    return ctx.notifiers


@broker.task
async def notify_log_first(
    source: str,
    sample: str,
    ctx: AppContext = TaskiqDepends(get_app_context),
) -> None:
    for n in _resolve_targets(ctx):
        try:
            await n.send_log_first(source, sample)
        except Exception:
            log.exception("notify_log_first: %s failed", type(n).__name__)


@broker.task
async def notify_log_digest(
    items: list[dict],
    period_label: str = "",
    ctx: AppContext = TaskiqDepends(get_app_context),
) -> None:
    for n in _resolve_targets(ctx):
        try:
            await n.send_log_digest(items, period_label=period_label)
        except Exception:
            log.exception("notify_log_digest: %s failed", type(n).__name__)
