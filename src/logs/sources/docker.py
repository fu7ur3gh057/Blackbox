import asyncio
import logging
import re
from typing import AsyncIterator

log = logging.getLogger(__name__)


class DockerLogSource:
    """Stream `docker compose -f <compose> logs -f --tail 0 <service>`."""

    def __init__(self, name: str, compose: str, service: str, pattern: str = ".+") -> None:
        self.name = name
        self.compose = compose
        self.service = service
        self.pattern = re.compile(pattern)

    async def stream(self) -> AsyncIterator[str]:
        backoff = 2.0
        while True:
            proc = None
            try:
                proc = await asyncio.create_subprocess_exec(
                    "docker", "compose", "-f", self.compose,
                    "logs", "-f", "--tail", "0", "--no-color", self.service,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                )
            except FileNotFoundError:
                log.error("docker not found, log source %s disabled", self.name)
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
