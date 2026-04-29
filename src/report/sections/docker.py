import asyncio
import json
import re

from .base import SectionResult

_HEALTH_RE = re.compile(r"\s*\((un)?healthy\)|\s*\(health: starting\)|\s*\(starting\)")


class DockerComposeSection:
    """Render containers from one or more docker compose files in a single block."""

    def __init__(self, projects: list[dict]) -> None:
        self.projects = projects

    async def render(self) -> SectionResult:
        warnings: list[str] = []
        rows: list[tuple[dict, set[str]]] = []
        missing: list[tuple[str, set[str]]] = []

        for proj in self.projects:
            compose_path = proj["compose"]
            wanted = list(proj.get("containers") or [])
            starred = set(proj.get("starred") or [])
            try:
                containers = await _ps(compose_path)
            except Exception as e:
                warnings.append(f"docker {compose_path}: {e}")
                continue

            seen: set[str] = set()
            for c in containers:
                service = c.get("Service") or c.get("Name", "?")
                if wanted and service not in wanted:
                    continue
                rows.append((c, starred))
                seen.add(service)

            for w in wanted:
                if w not in seen:
                    missing.append((w, starred))

        if not rows and not missing:
            return SectionResult(text="🐳 Containers\nno containers found", warnings=warnings)

        running = sum(
            1 for c, _ in rows
            if c.get("State") == "running" and _health(c.get("Status", "")) != "unhealthy"
        )
        total = len(rows) + len(missing)

        lines = ["🐳 Containers", f"{running}/{total} running"]
        for c, starred in rows:
            service = c.get("Service") or c.get("Name", "?")
            state = c.get("State", "")
            status = c.get("Status", "")
            health = _health(status)
            icon = _icon(state, health)
            star = " ⭐️" if service in starred else ""
            display = _HEALTH_RE.sub("", status)
            lines.append(f"{icon} {service}{star} {display}")
            if health == "unhealthy":
                warnings.append(f"container {service} {status}")
            elif state and state != "running":
                warnings.append(f"container {service} state={state}")

        for service, starred in missing:
            star = " ⭐️" if service in starred else ""
            lines.append(f"🔴 {service}{star} (not running)")
            warnings.append(f"container {service} not running")

        return SectionResult(text="\n".join(lines), warnings=warnings)


def _health(status: str) -> str:
    if "(unhealthy)" in status:
        return "unhealthy"
    if "(healthy)" in status:
        return "healthy"
    if "starting" in status:
        return "starting"
    return ""


def _icon(state: str, health: str) -> str:
    if state != "running":
        return "🔴"
    if health == "unhealthy":
        return "🔴"
    if health == "starting":
        return "🟡"
    return "✅"


async def _ps(compose_path: str) -> list[dict]:
    proc = await asyncio.create_subprocess_exec(
        "docker", "compose", "-f", compose_path, "ps",
        "--format", "json", "--all",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(stderr.decode().strip() or "docker compose failed")
    out = stdout.decode().strip()
    if not out:
        return []
    if out.startswith("["):
        return json.loads(out)
    return [json.loads(line) for line in out.splitlines() if line.strip()]
