import gzip
import json
import shutil
from datetime import date, datetime
from pathlib import Path


class JsonlStorage:
    """Append-only jsonl with daily + size-based rotation.

    Rotates the live file when:
      - the day boundary is crossed (next append after midnight, or after a
        process restart on a new day);
      - the next append would push the file past `max_size_mb`.
    Each rotation gzips the previous file into
    `<stem>.YYYY-MM-DD-HHMMSS.jsonl.gz` (timestamp = file's mtime, so the
    archive name reflects when its data was actually written). Keeps the
    last `keep_archives` archives, oldest get deleted.
    """

    def __init__(self, path: Path, max_size_mb: int = 10, keep_archives: int = 30) -> None:
        self.path = Path(path)
        self.max_bytes = max_size_mb * 1024 * 1024
        self.keep_archives = keep_archives
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, event: dict) -> None:
        line = json.dumps(event, ensure_ascii=False) + "\n"
        encoded = line.encode("utf-8")

        if self.path.exists():
            st = self.path.stat()
            file_day = date.fromtimestamp(st.st_mtime)
            if file_day < date.today():
                self._rotate()
            elif st.st_size + len(encoded) > self.max_bytes:
                self._rotate()

        with self.path.open("ab") as f:
            f.write(encoded)

    def _rotate(self) -> None:
        if not self.path.exists():
            return
        file_dt = datetime.fromtimestamp(self.path.stat().st_mtime)
        stamp = file_dt.strftime("%Y-%m-%d-%H%M%S")
        archive = self.path.parent / f"{self.path.stem}.{stamp}.jsonl.gz"
        # collision (rare: two rotations within the same second) → suffix microseconds
        if archive.exists():
            archive = self.path.parent / f"{self.path.stem}.{stamp}-{file_dt.microsecond}.jsonl.gz"
        with self.path.open("rb") as src, gzip.open(archive, "wb") as dst:
            shutil.copyfileobj(src, dst)
        self.path.unlink()
        archives = sorted(self.path.parent.glob(f"{self.path.stem}.*.jsonl.gz"))
        for old in archives[: -self.keep_archives]:
            try:
                old.unlink()
            except OSError:
                pass
