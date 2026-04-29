import psutil

from .base import SectionResult

GB = 1024 ** 3


class MemorySection:
    def __init__(self, warn_pct: float = 85.0) -> None:
        self.warn_pct = float(warn_pct)

    async def render(self) -> SectionResult:
        m = psutil.virtual_memory()
        used_gb = (m.total - m.available) / GB
        total_gb = m.total / GB
        pct = m.percent
        icon = "🟢" if pct < self.warn_pct else "🟡"
        text = f"💾 Memory\n{icon} RAM: {used_gb:.1f} / {total_gb:.1f} GB ({pct:.0f}%)"
        warnings = [f"RAM {pct:.0f}% (>= {self.warn_pct:.0f}%)"] if pct >= self.warn_pct else []
        return SectionResult(text=text, warnings=warnings)
