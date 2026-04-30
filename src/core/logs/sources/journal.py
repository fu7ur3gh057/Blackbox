import asyncio
import logging
import re
from typing import AsyncIterator

log = logging.getLogger(__name__)


class JournalLogSource:
    """Stream `journalctl -u <unit> -f -n 0 -o cat`."""

    def __init__(self, name: str, unit: str, pattern: str = ".+") -> None:
        self.name = name
        self.unit = unit
        self.pattern = re.compile(pattern)

    async def stream(self) -> AsyncIterator[str]:
        backoff = 2.0
        while True:
            proc = None
            try:
                proc = await asyncio.create_subprocess_exec(
                    "journalctl", "-u", self.unit, "-f", "-n", "0", "-o", "cat",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                )
            except FileNotFoundError:
                log.error("journalctl not found, log source %s disabled", self.name)
                return

            try:
                while True:
                    raw = await proc.stdout.readline()
                    if not raw:
                        break
                    line = raw.decode("utf-8", "replace").rstrip()
                    if line and self.pattern.search(line):
                        yield line
            finally:
                if proc and proc.returncode is None:
                    try:
                        proc.terminate()
                        await asyncio.wait_for(proc.wait(), timeout=5)
                    except (ProcessLookupError, asyncio.TimeoutError):
                        pass

            await asyncio.sleep(backoff)
