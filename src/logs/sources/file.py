import asyncio
import re
from pathlib import Path
from typing import AsyncIterator


class FileLogSource:
    """Tail -f style. Handles rotation/truncation by detecting size shrinks."""

    def __init__(self, name: str, path: str, pattern: str = ".+") -> None:
        self.name = name
        self.path = Path(path)
        self.pattern = re.compile(pattern)

    async def stream(self) -> AsyncIterator[str]:
        try:
            pos = self.path.stat().st_size
        except FileNotFoundError:
            pos = 0

        while True:
            try:
                size = self.path.stat().st_size
            except FileNotFoundError:
                await asyncio.sleep(2)
                pos = 0
                continue

            if size < pos:
                pos = 0  # truncated or rotated
            if size > pos:
                with self.path.open("rb") as f:
                    f.seek(pos)
                    chunk = f.read(size - pos).decode("utf-8", "replace")
                    pos = size
                for line in chunk.splitlines():
                    line = line.rstrip()
                    if line and self.pattern.search(line):
                        yield line
            await asyncio.sleep(1)
