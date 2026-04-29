import shutil

from .base import SectionResult

GB = 1024 ** 3


class DiskSection:
    def __init__(self, paths: list[str], warn_pct: float = 85.0) -> None:
        self.paths = list(paths)
        self.warn_pct = float(warn_pct)

    async def render(self) -> SectionResult:
        lines = ["💿 Disk"]
        warnings: list[str] = []
        for path in self.paths:
            try:
                u = shutil.disk_usage(path)
            except FileNotFoundError:
                lines.append(f"❓ {path}: not found")
                continue
            pct_used = u.used / u.total * 100
            free_gb = u.free / GB
            total_gb = u.total / GB
            icon = "🟢" if pct_used < self.warn_pct else "🟡"
            lines.append(
                f"{icon} {path}: {free_gb:.1f} GB free "
                f"({100 - pct_used:.0f}% of {total_gb:.0f}GB)"
            )
            if pct_used >= self.warn_pct:
                warnings.append(f"disk {path} {pct_used:.0f}% used")
        return SectionResult(text="\n".join(lines), warnings=warnings)
