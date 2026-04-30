"""Process-wide runtime context, attached to broker.state.

Tasks inject this via `TaskiqDepends(get_app_context)`. Mutable so that
e.g. StateTracker accumulates between task invocations within one process.
Single-process model only — when we move to a real broker we'll either
push state into Redis or rebuild it in each worker on startup.
"""

from dataclasses import dataclass, field

from monitoring.checks import Check
from monitoring.config import Config
from monitoring.notifiers.base import Notifier
from monitoring.report.sections.base import Section
from monitoring.state import StateTracker


@dataclass
class AppContext:
    config: Config
    checks_by_name: dict[str, Check] = field(default_factory=dict)
    notifiers_by_type: dict[str, Notifier] = field(default_factory=dict)
    notifiers: list[Notifier] = field(default_factory=list)
    tracker: StateTracker = field(default_factory=StateTracker)
    # Report
    report_hostname: str = ""
    report_lang: str = "en"
    report_sections: list[Section] = field(default_factory=list)
    report_targets: list[Notifier] = field(default_factory=list)
    # Logs
    log_storage_path: str | None = None
