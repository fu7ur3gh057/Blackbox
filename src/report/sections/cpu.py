import os

import psutil

from .base import SectionResult


class CpuSection:
    def __init__(self, warn_per_core: float = 1.0) -> None:
        self.warn_per_core = float(warn_per_core)

    async def render(self) -> SectionResult:
        load1, load5, load15 = os.getloadavg()
        cores = psutil.cpu_count() or 1
        per_core = load1 / cores
        icon = "🟢" if per_core < self.warn_per_core else "🟡"
        text = (
            f"⚙️ CPU\n"
            f"{icon} load: {load1:.2f} / {load5:.2f} / {load15:.2f} "
            f"({cores} cores, {per_core:.2f}/core)"
        )
        warnings = (
            [f"load/core {per_core:.2f} (>= {self.warn_per_core:.2f})"]
            if per_core >= self.warn_per_core else []
        )
        return SectionResult(text=text, warnings=warnings)
