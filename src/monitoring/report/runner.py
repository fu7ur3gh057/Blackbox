import asyncio
import logging

from ..notifiers.base import Notifier
from .builder import assemble
from .sections.base import Section, SectionResult

log = logging.getLogger(__name__)


class ReportRunner:
    def __init__(
        self,
        interval: float,
        hostname: str,
        sections: list[Section],
        notifiers: list[Notifier],
        lang: str = "en",
    ) -> None:
        self.interval = interval
        self.hostname = hostname
        self.sections = sections
        self.notifiers = notifiers
        self.lang = lang

    async def run(self) -> None:
        log.info(
            "report: every %.0fs, %d sections, %d notifiers",
            self.interval, len(self.sections), len(self.notifiers),
        )
        while True:
            await self._tick()
            await asyncio.sleep(self.interval)

    async def _tick(self) -> None:
        results = await asyncio.gather(*(self._render(s) for s in self.sections))
        message = assemble(self.hostname, list(results), lang=self.lang)
        for n in self.notifiers:
            try:
                await n.send_text(message)
            except Exception:
                log.exception("notifier %s failed for report", type(n).__name__)

    async def _render(self, section: Section) -> SectionResult:
        try:
            return await section.render()
        except Exception as e:
            log.exception("section %s crashed", type(section).__name__)
            name = type(section).__name__
            return SectionResult(text=f"⚠️ {name}: {e}", warnings=[f"{name}: {e}"])
