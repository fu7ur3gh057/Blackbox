"""Alert dispatch task — broadcasts an Alert to every configured notifier
and persists it to `alerts` for the timeline view."""

import logging
import time

from sqlmodel.ext.asyncio.session import AsyncSession
from taskiq import TaskiqDepends

from core.notifiers import Alert
from services.db.deps import get_session
from services.db.models import AlertEvent
from services.taskiq.broker import broker
from services.taskiq.context import AppContext
from services.taskiq.deps import get_app_context

log = logging.getLogger(__name__)


@broker.task
async def send_alert(
    alert: Alert,
    ctx: AppContext = TaskiqDepends(get_app_context),
    session: AsyncSession = TaskiqDepends(get_session),
) -> None:
    session.add(AlertEvent(
        ts=time.time(),
        name=alert.check,
        level=alert.level,
        kind=alert.kind or None,
        detail=alert.detail,
        metrics=alert.metrics or None,
    ))
    await session.commit()

    for n in ctx.notifiers:
        try:
            await n.send(alert)
        except Exception:
            log.exception("notifier %s failed", type(n).__name__)
