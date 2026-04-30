import logging
from pathlib import Path

from ..notifiers.base import Notifier
from .processor import LogProcessor
from .sources.docker import DockerLogSource
from .sources.file import FileLogSource
from .sources.journal import JournalLogSource
from .storage import JsonlStorage

log = logging.getLogger(__name__)


def build_log_processor(
    raw: dict,
    notifiers_by_type: dict[str, Notifier],
) -> LogProcessor | None:
    """Build the stream consumer. Notifier dispatch happens via TaskIQ tasks
    (tasks.logs.*), so this factory only validates that at least one notifier
    is reachable — it doesn't pass the list down."""
    if not raw:
        return None

    storage_cfg = raw.get("storage") or {}
    storage_path = Path(storage_cfg.get("path", "logs/blackbox.jsonl"))
    storage = JsonlStorage(
        path=storage_path,
        max_size_mb=int(storage_cfg.get("max_size_mb", 10)),
        keep_archives=int(storage_cfg.get("keep_archives", 7)),
    )

    selected = raw.get("notifier")
    if selected and selected in notifiers_by_type:
        target_count = 1
    elif selected:
        log.warning("logs: notifier %r not found", selected)
        target_count = 0
    else:
        target_count = len(notifiers_by_type)

    if target_count == 0:
        return None

    sources = []
    for s in raw.get("sources") or []:
        kind = s.get("type")
        try:
            if kind == "file":
                sources.append(FileLogSource(
                    name=s["name"], path=s["path"], pattern=s.get("pattern", ".+"),
                ))
            elif kind == "docker":
                sources.append(DockerLogSource(
                    name=s["name"], compose=s["compose"], service=s["service"],
                    pattern=s.get("pattern", ".+"),
                    poll_interval=float(s.get("poll_interval", 60)),
                ))
            elif kind == "journal":
                sources.append(JournalLogSource(
                    name=s["name"], unit=s["unit"], pattern=s.get("pattern", ".+"),
                ))
            else:
                log.warning("logs: unknown source type %r", kind)
        except KeyError as e:
            log.error("logs: source missing required field: %s", e)

    if not sources:
        return None

    sample = next(iter(notifiers_by_type.values()))
    lang = raw.get("lang") or getattr(sample, "lang", "en")

    return LogProcessor(
        sources=sources,
        storage=storage,
        digest_interval=float(raw.get("digest_interval", 3600)),
        max_signatures=int(raw.get("max_signatures", 5000)),
        lang=lang,
    )
