import gzip
import json
import shutil
import time
from pathlib import Path


class JsonlStorage:
    """Append-only jsonl with size-based rotation. Keeps last N archives."""

    def __init__(self, path: Path, max_size_mb: int = 10, keep_archives: int = 7) -> None:
        self.path = Path(path)
        self.max_bytes = max_size_mb * 1024 * 1024
        self.keep_archives = keep_archives
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, event: dict) -> None:
        line = json.dumps(event, ensure_ascii=False) + "\n"
        encoded = line.encode("utf-8")
        if self.path.exists() and self.path.stat().st_size + len(encoded) > self.max_bytes:
            self._rotate()
        with self.path.open("ab") as f:
            f.write(encoded)

    def _rotate(self) -> None:
        ts = time.strftime("%Y%m%d-%H%M%S")
        archive = self.path.parent / f"{self.path.stem}.{ts}.jsonl.gz"
        with self.path.open("rb") as src, gzip.open(archive, "wb") as dst:
            shutil.copyfileobj(src, dst)
        self.path.unlink()
        archives = sorted(self.path.parent.glob(f"{self.path.stem}.*.jsonl.gz"))
        for old in archives[: -self.keep_archives]:
            try:
                old.unlink()
            except OSError:
                pass
