import psutil

from .base import SectionResult

GB = 1024 ** 3


class SwapSection:
    def __init__(self, warn_pct: float = 80.0) -> None:
        self.warn_pct = float(warn_pct)

    async def render(self) -> SectionResult:
        s = psutil.swap_memory()
        if s.total == 0:
            return SectionResult(text="💱 Swap: disabled")
        used_gb = s.used / GB
        total_gb = s.total / GB
        pct = s.percent
        icon = "🟢" if pct < self.warn_pct else "🟡"
        text = f"💱 Swap\n{icon} {used_gb:.1f} / {total_gb:.1f} GB ({pct:.0f}%)"
        warnings = [f"swap {pct:.0f}% (>= {self.warn_pct:.0f}%)"] if pct >= self.warn_pct else []
        return SectionResult(text=text, warnings=warnings)
