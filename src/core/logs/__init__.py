import logging

from ..notifiers.base import Notifier
from .processor import LogProcessor
from .sources.docker import DockerLogSource
from .sources.file import FileLogSource
from .sources.journal import JournalLogSource
from .store import LogEventStore

log = logging.getLogger(__name__)


def build_log_store(raw: dict | None) -> LogEventStore:
    """Storage is always SQLite-backed; the only knobs are retention.

    Accepts the new schema (`retention_days`, `max_rows`) at the top of
    the `logs:` block, or under `logs.storage:` for symmetry with the
    old shape. Legacy `path` / `max_size_mb` / `keep_archives` keys are
    silently ignored — they were JSONL-specific and the file isn't
    written any more.
    """
    raw = raw or {}
    storage_cfg = raw.get("storage") or {}
    retention_days = (
        raw.get("retention_days")
        or storage_cfg.get("retention_days")
        or 7
    )
    max_rows = (
        raw.get("max_rows")
        or storage_cfg.get("max_rows")
        or 200_000
    )
    return LogEventStore(retention_days=int(retention_days), max_rows=int(max_rows))


def build_log_processor(
    raw: dict,
    notifiers_by_type: dict[str, Notifier],
    *,
    store: LogEventStore | None = None,
) -> LogProcessor | None:
    """Build the stream consumer. Notifier dispatch happens via TaskIQ tasks
    (tasks.logs.*), so this factory only validates that at least one notifier
    is reachable — it doesn't pass the list down."""
    if not raw:
        return None

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
        store=store or build_log_store(raw),
        digest_interval=float(raw.get("digest_interval", 3600)),
        max_signatures=int(raw.get("max_signatures", 5000)),
        lang=lang,
    )


__all__ = ["LogEventStore", "build_log_processor", "build_log_store"]
