import asyncio
import logging

from .checks import Result, build_check
from .config import Config
from .notifiers import Alert
from .notifiers.base import Notifier
from .state import StateTracker

log = logging.getLogger(__name__)


class Runner:
    def __init__(self, config: Config, notifiers: list[Notifier]) -> None:
        self.checks = [build_check(c) for c in config.checks]
        self.notifiers = notifiers
        self.state = StateTracker()

    async def run(self) -> None:
        if not self.checks:
            log.warning("no checks configured, exiting")
            return
        log.info("starting %d checks, %d notifiers", len(self.checks), len(self.notifiers))
        await asyncio.gather(*(self._loop(c) for c in self.checks))

    async def _loop(self, check) -> None:
        while True:
            try:
                result = await check.run()
            except Exception as e:
                log.exception("check %s crashed", check.name)
                result = Result(level="crit", detail=f"crashed: {e}")

            new_level = self.state.observe(check.name, result.level)
            if new_level is not None:
                alert = Alert(
                    check=check.name,
                    level=new_level,
                    detail=result.detail,
                    kind=result.kind,
                    metrics=result.metrics,
                )
                await self._dispatch(alert)

            await asyncio.sleep(check.interval)

    async def _dispatch(self, alert: Alert) -> None:
        for n in self.notifiers:
            try:
                await n.send(alert)
            except Exception:
                log.exception("notifier %s failed", type(n).__name__)
