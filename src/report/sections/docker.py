import asyncio
import json
import re

from .base import SectionResult

_HEALTH_RE = re.compile(r"\s*\((un)?healthy\)|\s*\(health: starting\)|\s*\(starting\)")
_UP_RE = re.compile(r"Up\s+(\d+)\s+(\w+)")
_EXITED_RE = re.compile(r"Exited.*?(\d+)\s+(\w+)\s+ago")

_LABELS = {
    "en": {"title": "🐳 Docker containers", "total": "total"},
    "ru": {"title": "🐳 Docker-контейнеры", "total": "всего"},
}


def _short_unit(unit: str) -> str:
    base = unit.rstrip("s").lower()
    return {"second": "s", "minute": "m", "hour": "h", "day": "d", "week": "w"}.get(base, base[:1])


def _short_status(status: str) -> str:
    if m := _UP_RE.search(status):
        return f"up {m.group(1)}{_short_unit(m.group(2))}"
    if m := _EXITED_RE.search(status):
        return f"exited {m.group(1)}{_short_unit(m.group(2))} ago"
    if "Exited" in status:
        return "exited"
    return status.lower() or "?"


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
        return "❌"
    if health == "unhealthy":
        return "❌"
    if health == "starting":
        return "🟡"
    return "✅"


_MEM_UNITS = {"B": 1 / 1_048_576, "KiB": 1 / 1024, "MiB": 1, "GiB": 1024,
              "TiB": 1024 * 1024, "kB": 1 / 1000, "MB": 1, "GB": 1000}


def _to_mb(s: str) -> int | None:
    s = s.strip()
    for suffix, mult in sorted(_MEM_UNITS.items(), key=lambda kv: -len(kv[0])):
        if s.endswith(suffix):
            try:
                return int(float(s[: -len(suffix)]) * mult)
            except ValueError:
                return None
    return None


def _parse_mem(usage: str) -> str:
    parts = usage.split("/")
    if len(parts) != 2:
        return usage
    used = _to_mb(parts[0])
    total = _to_mb(parts[1])
    if used is None or total is None:
        return usage
    return f"{used}/{total} MB"


async def _stats(names: list[str]) -> dict[str, dict]:
    if not names:
        return {}
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker", "stats", "--no-stream", "--format", "{{json .}}", *names,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
    except (FileNotFoundError, asyncio.TimeoutError):
        return {}
    if proc.returncode != 0:
        return {}
    out: dict[str, dict] = {}
    for line in stdout.decode("utf-8", "replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        name = d.get("Name", "")
        out[name] = {
            "cpu": d.get("CPUPerc", "").rstrip("%"),
            "mem": _parse_mem(d.get("MemUsage", "")),
        }
    return out


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
    txt = stdout.decode().strip()
    if not txt:
        return []
    if txt.startswith("["):
        return json.loads(txt)
    return [json.loads(ln) for ln in txt.splitlines() if ln.strip()]


class DockerComposeSection:
    def __init__(self, projects: list[dict], lang: str = "en") -> None:
        self.projects = projects
        self.lang = lang

    async def render(self) -> SectionResult:
        L = _LABELS.get(self.lang, _LABELS["en"])
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
            return SectionResult(text=f"{L['title']}\nno containers found", warnings=warnings)

        names_for_stats = [c.get("Name") for c, _ in rows if c.get("Name")]
        stats = await _stats(names_for_stats)

        total = len(rows) + len(missing)
        title_line = f"{L['title']} ({L['total']}: {total})"
        lines = [title_line]

        for c, starred in rows:
            service = c.get("Service") or c.get("Name", "?")
            state = c.get("State", "")
            status = c.get("Status", "")
            health = _health(status)
            icon = _icon(state, health)
            star = " ⭐" if service in starred else ""
            short = _short_status(status)

            parts = [f"{icon} {service}{star}", f"| {short}"]

            stat = stats.get(c.get("Name", ""), {})
            if stat.get("cpu"):
                parts.append(f"| cpu {stat['cpu']}%")
            if stat.get("mem"):
                parts.append(f"| mem {stat['mem']}")
            lines.append(" ".join(parts))

            if health == "unhealthy":
                warnings.append(f"container {service} unhealthy")
            elif state and state != "running":
                warnings.append(f"container {service} {state}")

        for service, starred in missing:
            star = " ⭐" if service in starred else ""
            lines.append(f"❌ {service}{star} | not running")
            warnings.append(f"container {service} not running")

        return SectionResult(text="\n".join(lines), warnings=warnings)
