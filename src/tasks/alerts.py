"""Alert dispatch task — broadcasts an Alert to every configured notifier."""

import logging

from monitoring.notifiers import Alert
from services.taskiq.broker import broker
from services.taskiq.context import AppContext
from services.taskiq.deps import get_app_context
from taskiq import TaskiqDepends

log = logging.getLogger(__name__)


@broker.task
async def send_alert(
    alert: Alert,
    ctx: AppContext = TaskiqDepends(get_app_context),
) -> None:
    for n in ctx.notifiers:
        try:
            await n.send(alert)
        except Exception:
            log.exception("notifier %s failed", type(n).__name__)
