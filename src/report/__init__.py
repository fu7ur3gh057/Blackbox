import logging

from ..notifiers.base import Notifier
from .runner import ReportRunner
from .sections.base import Section
from .sections.cpu import CpuSection
from .sections.disk import DiskSection
from .sections.dlq import DlqSection
from .sections.docker import DockerComposeSection
from .sections.memory import MemorySection
from .sections.net import NetSection
from .sections.postgres import PostgresSection
from .sections.swap import SwapSection

log = logging.getLogger(__name__)


def build_report_runner(
    raw: dict,
    notifiers_by_type: dict[str, Notifier],
) -> ReportRunner | None:
    interval = float(raw.get("interval", 300))
    hostname = raw.get("hostname", "")

    selected = raw.get("notifier")
    if selected:
        target = [notifiers_by_type[selected]] if selected in notifiers_by_type else []
        if not target:
            log.warning("report: notifier %r not found in config", selected)
    else:
        target = list(notifiers_by_type.values())

    sections = _build_sections(raw)
    if not sections or not target:
        return None

    lang = raw.get("lang") or getattr(target[0], "lang", "en")

    return ReportRunner(
        interval=interval,
        hostname=hostname,
        sections=sections,
        notifiers=target,
        lang=lang,
    )


def _build_sections(raw: dict) -> list[Section]:
    sections: list[Section] = []
    host = raw.get("host") or {}

    if "memory" in host:
        opts = host["memory"] if isinstance(host["memory"], dict) else {}
        sections.append(MemorySection(**opts))
    if "swap" in host:
        opts = host["swap"] if isinstance(host["swap"], dict) else {}
        sections.append(SwapSection(**opts))
    if "cpu" in host:
        opts = host["cpu"] if isinstance(host["cpu"], dict) else {}
        sections.append(CpuSection(**opts))
    if "disks" in host:
        d = host["disks"]
        if isinstance(d, list):
            sections.append(DiskSection(paths=d))
        else:
            sections.append(DiskSection(**d))
    if "net" in host:
        n = host["net"]
        if n is True:
            sections.append(NetSection())
        elif isinstance(n, dict):
            sections.append(NetSection(interfaces=n.get("interfaces")))
        elif isinstance(n, list):
            sections.append(NetSection(interfaces=n))

    docker = raw.get("docker") or []
    if docker:
        sections.append(DockerComposeSection(projects=docker))

    for pg in raw.get("postgres") or []:
        sections.append(PostgresSection(**pg))
    for dlq in raw.get("dlq") or []:
        sections.append(DlqSection(**dlq))

    return sections
