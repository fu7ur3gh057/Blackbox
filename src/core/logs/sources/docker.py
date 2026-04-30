import asyncio
import logging
import re
import time
from typing import AsyncIterator

log = logging.getLogger(__name__)


class DockerLogSource:
    """Poll `docker compose logs --since <last_poll>` every `poll_interval` seconds.

    Polling instead of `-f` streaming: each `docker compose logs -f` keeps a
    long-running CLI subprocess (~30-60 MB RSS each) plus an open daemon
    connection. With several services that adds up fast on small VPS. Polling
    spawns a short-lived subprocess on each tick and exits — RAM is reclaimed
    between ticks, at the cost of a brief CPU spike per poll.
    """

    def __init__(
        self,
        name: str,
        compose: str,
        service: str,
        pattern: str = ".+",
        poll_interval: float = 60.0,
    ) -> None:
        self.name = name
        self.compose = compose
        self.service = service
        self.pattern = re.compile(pattern)
        self.poll_interval = max(5.0, float(poll_interval))

    async def stream(self) -> AsyncIterator[str]:
        # Start from "now" so we don't dump existing container history on first run.
        since = int(time.time())

        while True:
            await asyncio.sleep(self.poll_interval)
            next_since = int(time.time())

            try:
                proc = await asyncio.create_subprocess_exec(
                    "docker", "compose", "-f", self.compose,
                    "logs", "--since", str(since), "--no-color", self.service,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                )
            except FileNotFoundError:
                log.error("docker not found, log source %s disabled", self.name)
                return

            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
            except asyncio.TimeoutError:
                log.warning("logs: %s docker compose logs timed out", self.name)
                if proc.returncode is None:
                    try:
                        proc.kill()
                        await proc.wait()
                    except ProcessLookupError:
                        pass
                since = next_since
                continue

            if proc.returncode != 0:
                log.warning("logs: %s docker compose logs failed (rc=%s)",
                            self.name, proc.returncode)
                since = next_since
                continue

            for raw in stdout.decode("utf-8", "replace").splitlines():
                line = raw.rstrip()
                if line and self.pattern.search(line):
                    yield line

            since = next_since
