import logging

from ..notifiers.base import Notifier
from .runner import ReportRunner
from .sections.base import Section
from .sections.dlq import DlqSection
from .sections.docker import DockerComposeSection
from .sections.postgres import PostgresSection
from .sections.recent_errors import RecentErrorsSection
from .sections.vps import VpsSection

log = logging.getLogger(__name__)


def build_report_runner(
    raw: dict,
    notifiers_by_type: dict[str, Notifier],
    logs_storage_path: str | None = None,
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

    lang = raw.get("lang") or (getattr(target[0], "lang", "en") if target else "en")
    sections = _build_sections(raw, lang=lang, logs_storage_path=logs_storage_path)
    if not sections or not target:
        return None

    return ReportRunner(
        interval=interval,
        hostname=hostname,
        sections=sections,
        notifiers=target,
        lang=lang,
    )


def _build_sections(
    raw: dict,
    lang: str = "en",
    logs_storage_path: str | None = None,
) -> list[Section]:
    sections: list[Section] = []
    host = raw.get("host") or {}

    if host:
        # New schema: host.disks (list of paths), host.interfaces (list)
        # Legacy schema: host.disks.paths, host.net.interfaces — handled too.
        disks = host.get("disks")
        if isinstance(disks, dict):
            disks = disks.get("paths")
        if not disks:
            disks = ["/"]

        interfaces = host.get("interfaces")
        if interfaces is None:
            net = host.get("net")
            if isinstance(net, dict):
                interfaces = net.get("interfaces")
            elif isinstance(net, list):
                interfaces = net

        sections.append(VpsSection(
            lang=lang,
            disks=disks,
            interfaces=interfaces,
            warn_pct=float(host.get("warn_pct", 80)),
        ))

    docker = raw.get("docker") or []
    if docker:
        sections.append(DockerComposeSection(projects=docker, lang=lang))

    for pg in raw.get("postgres") or []:
        sections.append(PostgresSection(**pg))
    for dlq in raw.get("dlq") or []:
        sections.append(DlqSection(**dlq))

    if logs_storage_path:
        re_cfg = raw.get("recent_errors")
        if re_cfg is not False:
            re_cfg = re_cfg if isinstance(re_cfg, dict) else {}
            sections.append(RecentErrorsSection(
                storage_path=logs_storage_path,
                limit=int(re_cfg.get("limit", 5)),
                lang=lang,
            ))

    return sections
