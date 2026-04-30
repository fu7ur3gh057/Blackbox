import json
import time
from pathlib import Path

from .base import SectionResult

_LABELS = {
    "en": {"title": "🔄 Recent errors", "empty": "no recent errors"},
    "ru": {"title": "🔄 Последние ошибки", "empty": "ошибок не было"},
}


class RecentErrorsSection:
    def __init__(self, storage_path: str, limit: int = 5, lang: str = "en") -> None:
        self.storage_path = Path(storage_path)
        self.limit = limit
        self.lang = lang

    async def render(self) -> SectionResult:
        L = _LABELS.get(self.lang, _LABELS["en"])

        events = self._tail()
        if not events:
            return SectionResult(text=f"{L['title']}\n— {L['empty']}")

        lines = [L["title"]]
        for ev in events:
            ts = time.strftime("%H:%M", time.localtime(ev.get("ts", 0)))
            src = ev.get("source", "?")
            sample = ev.get("line", "").splitlines()[0] if ev.get("line") else ""
            sample = sample[:120]
            lines.append(f"• {ts} {src}: {sample}")
        return SectionResult(text="\n".join(lines))

    def _tail(self) -> list[dict]:
        try:
            size = self.storage_path.stat().st_size
        except OSError:
            return []
        offset = max(0, size - 64 * 1024)
        try:
            with self.storage_path.open("rb") as f:
                f.seek(offset)
                chunk = f.read().decode("utf-8", "replace")
        except OSError:
            return []

        events: list[dict] = []
        for line in chunk.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue

        # last N unique signatures (most recent first), then chronological
        seen: set[str] = set()
        unique: list[dict] = []
        for ev in reversed(events):
            sig = ev.get("sig")
            if sig and sig not in seen:
                seen.add(sig)
                unique.append(ev)
                if len(unique) >= self.limit:
                    break
        return list(reversed(unique))
