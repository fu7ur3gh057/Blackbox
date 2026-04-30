"""Log stream consumer.

Streams from configured sources (file/journal/docker poll), dedups by
signature, persists every line to JsonlStorage, and routes notifications
through the TaskIQ broker (`tasks.logs.notify_log_first`,
`tasks.logs.notify_log_digest`) — the actual `send_log_first`/`send_log_digest`
notifier calls happen in those tasks. The processor itself is a long-lived
coroutine because most sources are async iterators and per-line task wrap
would be too granular.
"""

import asyncio
import hashlib
import logging
import re
import time

from .base import LogSource
from .storage import JsonlStorage

log = logging.getLogger(__name__)

_NUM_RE = re.compile(r"\b\d+\b")
_HEX_RE = re.compile(r"\b[0-9a-fA-F]{8,}\b")
_QUOTED_RE = re.compile(r"['\"][^'\"]{0,80}['\"]")


def _signature(line: str) -> str:
    """Stable hash of the normalized first line — collapses similar errors."""
    head = line.splitlines()[0] if line else ""
    norm = _HEX_RE.sub("X", head)
    norm = _NUM_RE.sub("N", norm)
    norm = _QUOTED_RE.sub("'…'", norm)
    return hashlib.sha1(norm.encode("utf-8", "replace")).hexdigest()[:12]


class LogProcessor:
    def __init__(
        self,
        sources: list[LogSource],
        storage: JsonlStorage,
        digest_interval: float = 3600.0,
        max_signatures: int = 5000,
        lang: str = "en",
    ) -> None:
        self.sources = sources
        self.storage = storage
        self.digest_interval = digest_interval
        self.max_signatures = max_signatures
        self.lang = lang
        self._sigs: dict[str, dict] = {}

    async def run(self) -> None:
        if not self.sources:
            log.warning("logs: no sources configured")
            return
        log.info(
            "logs: %d sources, digest every %.0fs, storage at %s",
            len(self.sources), self.digest_interval, self.storage.path,
        )
        tasks = [self._consume(s) for s in self.sources]
        tasks.append(self._digest_loop())
        await asyncio.gather(*tasks)

    async def _consume(self, source: LogSource) -> None:
        try:
            async for line in source.stream():
                if not line:
                    continue
                self._record(source.name, line)
        except Exception:
            log.exception("logs: source %s crashed", source.name)

    def _record(self, source_name: str, line: str) -> None:
        sig = _signature(line)
        now = time.time()
        first = sig not in self._sigs

        if first:
            self._evict_if_needed()
            self._sigs[sig] = {
                "source": source_name,
                "sample": line,
                "first_seen": now,
                "since_digest": 1,
                "total": 1,
            }
        else:
            info = self._sigs[sig]
            info["since_digest"] += 1
            info["total"] += 1

        try:
            self.storage.append({
                "ts": now, "source": source_name, "sig": sig,
                "first": first, "line": line[:2000],
            })
        except Exception:
            log.exception("logs: storage append failed")

        if first:
            asyncio.create_task(self._kick_first(source_name, line))

    def _evict_if_needed(self) -> None:
        if len(self._sigs) < self.max_signatures:
            return
        oldest = sorted(self._sigs.items(), key=lambda kv: kv[1]["first_seen"])
        for sig, _ in oldest[: self.max_signatures // 5]:
            self._sigs.pop(sig, None)

    async def _kick_first(self, source: str, line: str) -> None:
        # Imported lazily — tasks/logs.py imports the broker, which expects
        # broker.startup() to have already happened by the time we kick.
        from tasks.logs import notify_log_first
        try:
            await notify_log_first.kiq(source, line)
        except Exception:
            log.exception("logs: failed to kick notify_log_first")

    async def _digest_loop(self) -> None:
        while True:
            await asyncio.sleep(self.digest_interval)
            await self._send_digest()

    async def _send_digest(self) -> None:
        repeats = [
            {"source": info["source"], "sample": info["sample"], "count": info["since_digest"]}
            for info in self._sigs.values()
            if info["since_digest"] > 1
        ]
        if not repeats:
            return
        repeats.sort(key=lambda x: x["count"], reverse=True)
        repeats = repeats[:10]

        period = self._period_label()
        from tasks.logs import notify_log_digest
        try:
            await notify_log_digest.kiq(repeats, period)
        except Exception:
            log.exception("logs: failed to kick notify_log_digest")

        for info in self._sigs.values():
            info["since_digest"] = 0

    def _period_label(self) -> str:
        secs = int(self.digest_interval)
        if self.lang == "ru":
            if secs >= 3600 and secs % 3600 == 0:
                hrs = secs // 3600
                return f"за последний час" if hrs == 1 else f"за последние {hrs} ч"
            mins = max(1, secs // 60)
            return f"за последние {mins} мин"
        if secs >= 3600 and secs % 3600 == 0:
            hrs = secs // 3600
            return "last hour" if hrs == 1 else f"last {hrs} hours"
        mins = max(1, secs // 60)
        return f"last {mins} min"
