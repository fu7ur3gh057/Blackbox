"""Periodic check execution as TaskIQ tasks.

The scheduler kicks `run_check.kiq(name)` every check.interval seconds. The
task pulls the check handler from app context, runs it, observes severity
through StateTracker, and — if the level changed — fires `send_alert.kiq`
to dispatch through every configured notifier.
"""

import logging

from core.checks import Result
from core.notifiers import Alert
from services.taskiq.broker import broker
from services.taskiq.context import AppContext
from services.taskiq.deps import get_app_context
from taskiq import TaskiqDepends

from tasks.alerts import send_alert

log = logging.getLogger(__name__)


@broker.task
async def run_check(
    name: str,
    ctx: AppContext = TaskiqDepends(get_app_context),
) -> None:
    handler = ctx.checks_by_name.get(name)
    if handler is None:
        log.warning("run_check: unknown check %r", name)
        return

    try:
        result = await handler.run()
    except Exception as e:
        log.exception("check %s crashed", name)
        result = Result(level="crit", detail=f"crashed: {e}")

    new_level = ctx.tracker.observe(name, result.level)
    if new_level is None:
        return

    alert = Alert(
        check=name,
        level=new_level,
        detail=result.detail,
        kind=result.kind,
        metrics=result.metrics,
    )
    await send_alert.kiq(alert)
