"""Task-level integration: run_check, send_alert, build_and_send_report,
notify_log_first/digest. We use the shared broker fixture and inject a
hand-rolled AppContext to keep tests hermetic."""

from collections import namedtuple

from core.checks.base import Result
from core.config import Config
from core.notifiers import Alert
from core.report.sections.base import Section, SectionResult
from core.state import StateTracker
from services.taskiq.context import AppContext


# ── Test doubles ───────────────────────────────────────────────────────────

class FakeNotifier:
    type = "fake"
    lang = "en"

    def __init__(self):
        self.alerts: list[Alert] = []
        self.texts: list[str] = []
        self.log_firsts: list[tuple[str, str]] = []
        self.log_digests: list[tuple[list, str]] = []
        self.startups = 0
        self.shutdowns = 0

    async def send(self, alert: Alert) -> None:
        self.alerts.append(alert)

    async def send_text(self, text: str) -> None:
        self.texts.append(text)

    async def send_startup(self) -> None:
        self.startups += 1

    async def send_shutdown(self) -> None:
        self.shutdowns += 1

    async def send_log_first(self, source: str, sample: str) -> None:
        self.log_firsts.append((source, sample))

    async def send_log_digest(self, items: list, period_label: str = "") -> None:
        self.log_digests.append((items, period_label))


class FakeCheck:
    interval = 1.0

    def __init__(self, name: str, result: Result):
        self.name = name
        self._result = result

    async def run(self) -> Result:
        return self._result


class FakeSection(Section):
    def __init__(self, text: str, warnings: list[str] | None = None):
        self.text = text
        self.warnings = warnings or []

    async def render(self) -> SectionResult:
        return SectionResult(text=self.text, warnings=self.warnings)


# ── run_check ──────────────────────────────────────────────────────────────

async def test_run_check_warn_dispatches_alert(broker):
    notifier = FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        checks_by_name={"cpu": FakeCheck("cpu", Result(level="warn", kind="cpu",
                                                      detail="cpu warn"))},
        notifiers=[notifier],
    )
    broker.state.app_ctx = ctx

    from tasks.checks import run_check
    res = await (await run_check.kiq("cpu")).wait_result()
    assert not res.is_err
    assert ctx.tracker._levels == {"cpu": "warn"}
    # send_alert ran inline (InMemoryBroker), notifier should have received it
    assert len(notifier.alerts) == 1
    assert notifier.alerts[0].level == "warn"
    assert notifier.alerts[0].kind == "cpu"


async def test_run_check_steady_ok_does_not_fire(broker):
    notifier = FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        checks_by_name={"cpu": FakeCheck("cpu", Result(level="ok", kind="cpu", detail="ok"))},
        notifiers=[notifier],
    )
    broker.state.app_ctx = ctx

    from tasks.checks import run_check
    await (await run_check.kiq("cpu")).wait_result()
    await (await run_check.kiq("cpu")).wait_result()
    assert notifier.alerts == []


async def test_run_check_recovery_fires_ok(broker):
    notifier = FakeNotifier()
    bad = Result(level="crit", kind="cpu", detail="bad")
    good = Result(level="ok", kind="cpu", detail="good")
    check = FakeCheck("cpu", bad)
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        checks_by_name={"cpu": check},
        notifiers=[notifier],
    )
    broker.state.app_ctx = ctx

    from tasks.checks import run_check
    await (await run_check.kiq("cpu")).wait_result()
    check._result = good
    await (await run_check.kiq("cpu")).wait_result()

    assert [a.level for a in notifier.alerts] == ["crit", "ok"]


async def test_run_check_unknown_name_is_silent(broker):
    notifier = FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        checks_by_name={},
        notifiers=[notifier],
    )
    broker.state.app_ctx = ctx

    from tasks.checks import run_check
    res = await (await run_check.kiq("nonexistent")).wait_result()
    assert not res.is_err
    assert notifier.alerts == []


async def test_run_check_crashed_handler_is_reported_as_crit(broker):
    class BoomCheck:
        name = "boom"
        interval = 1.0

        async def run(self):
            raise RuntimeError("kaboom")

    notifier = FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        checks_by_name={"boom": BoomCheck()},
        notifiers=[notifier],
    )
    broker.state.app_ctx = ctx

    from tasks.checks import run_check
    await (await run_check.kiq("boom")).wait_result()
    [alert] = notifier.alerts
    assert alert.level == "crit"
    assert "kaboom" in alert.detail


# ── send_alert ─────────────────────────────────────────────────────────────

async def test_send_alert_broadcasts_to_all_notifiers(broker):
    n1, n2 = FakeNotifier(), FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        notifiers=[n1, n2],
    )
    broker.state.app_ctx = ctx

    from tasks.alerts import send_alert
    alert = Alert(check="cpu", level="warn", detail="x", kind="cpu")
    await (await send_alert.kiq(alert)).wait_result()

    assert n1.alerts == [alert]
    assert n2.alerts == [alert]


async def test_send_alert_one_failing_notifier_does_not_block_others(broker):
    class Bad(FakeNotifier):
        async def send(self, alert):
            raise RuntimeError("offline")

    bad, good = Bad(), FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        notifiers=[bad, good],
    )
    broker.state.app_ctx = ctx

    from tasks.alerts import send_alert
    res = await (await send_alert.kiq(
        Alert(check="x", level="crit", detail="x", kind="cpu"),
    )).wait_result()
    assert not res.is_err
    assert good.alerts, "the working notifier should still receive the alert"


# ── build_and_send_report ─────────────────────────────────────────────────

async def test_report_assembles_and_sends_to_targets(broker):
    n = FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        report_hostname="vps01",
        report_lang="ru",
        report_sections=[FakeSection("📊 host\nload 0.1")],
        report_targets=[n],
    )
    broker.state.app_ctx = ctx

    from tasks.report import build_and_send_report
    await (await build_and_send_report.kiq()).wait_result()

    [text] = n.texts
    assert "vps01" in text
    assert "load 0.1" in text


async def test_report_skipped_when_no_sections(broker):
    n = FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        report_targets=[n],
        report_sections=[],
    )
    broker.state.app_ctx = ctx

    from tasks.report import build_and_send_report
    await (await build_and_send_report.kiq()).wait_result()
    assert n.texts == []


async def test_report_section_crash_is_isolated(broker):
    class BoomSec(Section):
        async def render(self):
            raise RuntimeError("section boom")

    n = FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        report_hostname="h",
        report_lang="en",
        report_sections=[BoomSec(), FakeSection("ok\nbody")],
        report_targets=[n],
    )
    broker.state.app_ctx = ctx

    from tasks.report import build_and_send_report
    await (await build_and_send_report.kiq()).wait_result()
    [text] = n.texts
    assert "ok" in text
    assert "section boom" in text  # surfaced as warning text


# ── log notification tasks ────────────────────────────────────────────────

async def test_notify_log_first_uses_logs_notifier_when_set(broker):
    only = FakeNotifier()
    only.type = "log-channel"
    other = FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[],
                      logs={"notifier": "log-channel"}),
        notifiers_by_type={"log-channel": only, "tg-main": other},
        notifiers=[only, other],
    )
    broker.state.app_ctx = ctx

    from tasks.logs import notify_log_first
    await (await notify_log_first.kiq("svc", "boom")).wait_result()
    assert only.log_firsts == [("svc", "boom")]
    assert other.log_firsts == []


async def test_notify_log_digest_falls_back_to_all_notifiers(broker):
    n1, n2 = FakeNotifier(), FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        notifiers_by_type={"a": n1, "b": n2},
        notifiers=[n1, n2],
    )
    broker.state.app_ctx = ctx

    from tasks.logs import notify_log_digest
    items = [{"source": "svc", "sample": "x", "count": 5}]
    await (await notify_log_digest.kiq(items, "last hour")).wait_result()
    assert n1.log_digests == [(items, "last hour")]
    assert n2.log_digests == [(items, "last hour")]
