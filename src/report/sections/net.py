import time

import psutil

from .base import SectionResult


def _fmt(bps: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if bps < 1024:
            return f"{bps:.1f} {unit}"
        bps /= 1024
    return f"{bps:.1f} TB"


class NetSection:
    def __init__(self, interfaces: list[str] | None = None) -> None:
        self.interfaces = interfaces
        self._prev: tuple[float, int, int] | None = None

    def _counters(self) -> tuple[int, int]:
        if not self.interfaces:
            c = psutil.net_io_counters()
            return c.bytes_sent, c.bytes_recv
        per = psutil.net_io_counters(pernic=True)
        tx = sum(per[i].bytes_sent for i in self.interfaces if i in per)
        rx = sum(per[i].bytes_recv for i in self.interfaces if i in per)
        return tx, rx

    async def render(self) -> SectionResult:
        sent, recv = self._counters()
        now = time.monotonic()
        if self._prev is None:
            self._prev = (now, sent, recv)
            label = ", ".join(self.interfaces) if self.interfaces else "all"
            return SectionResult(text=f"🌐 Net ({label}): warming up")
        dt = now - self._prev[0]
        tx = (sent - self._prev[1]) / dt if dt > 0 else 0
        rx = (recv - self._prev[2]) / dt if dt > 0 else 0
        self._prev = (now, sent, recv)
        label = " · ".join(self.interfaces) if self.interfaces else ""
        head = f"🌐 Net{' (' + label + ')' if label else ''}"
        return SectionResult(text=f"{head}\n↑ {_fmt(tx)}/s   ↓ {_fmt(rx)}/s")
