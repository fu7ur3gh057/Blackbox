"""Task-level integration: run_check, send_alert, build_and_send_report,
notify_log_first/digest. Uses the broker fixture (which also brings up
SQLite); state and history live in the DB now, so assertions read back
through the same session_maker."""

from sqlmodel import select

from core.checks.base import Result
from core.config import Config
from core.notifiers import Alert
from core.report.sections.base import Section, SectionResult
from services.db.models import AlertEvent, CheckResult, CheckStateEntry
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

    async def send(self, alert: Alert) -> None:
        self.alerts.append(alert)

    async def send_text(self, text: str) -> None:
        self.texts.append(text)

    async def send_startup(self) -> None: ...
    async def send_shutdown(self) -> None: ...

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


async def _read_state(broker, name: str) -> str | None:
    async with broker.state.db_session_maker() as session:
        row = await session.get(CheckStateEntry, name)
        return row.level if row else None


async def _all_results(broker) -> list[CheckResult]:
    async with broker.state.db_session_maker() as session:
        return list((await session.exec(select(CheckResult))).all())


async def _all_alerts(broker) -> list[AlertEvent]:
    async with broker.state.db_session_maker() as session:
        return list((await session.exec(select(AlertEvent))).all())


# ── run_check ──────────────────────────────────────────────────────────────

async def test_run_check_warn_dispatches_alert_and_persists(broker):
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

    assert await _read_state(broker, "cpu") == "warn"
    [row] = await _all_results(broker)
    assert row.name == "cpu" and row.level == "warn"
    [alert_row] = await _all_alerts(broker)
    assert alert_row.level == "warn"

    assert len(notifier.alerts) == 1
    assert notifier.alerts[0].level == "warn"


async def test_run_check_steady_ok_persists_results_but_no_alerts(broker):
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
    assert await _read_state(broker, "cpu") == "ok"
    assert len(await _all_results(broker)) == 2  # both ok results stored
    assert await _all_alerts(broker) == []


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
    assert await _read_state(broker, "cpu") == "ok"


async def test_run_check_state_survives_restart_simulation(broker):
    """The state table is the source of truth — once written, a fresh task
    invocation should see the prior level and stay quiet on a steady reading."""
    notifier = FakeNotifier()
    ctx = AppContext(
        config=Config(checks=[], notifiers=[]),
        checks_by_name={"cpu": FakeCheck("cpu", Result(level="warn", kind="cpu",
                                                      detail="warn"))},
        notifiers=[notifier],
    )
    broker.state.app_ctx = ctx

    from tasks.checks import run_check
    await (await run_check.kiq("cpu")).wait_result()
    notifier.alerts.clear()
    await (await run_check.kiq("cpu")).wait_result()
    # Same level, second invocation should NOT re-alert.
    assert notifier.alerts == []


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
    assert await _all_results(broker) == []


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
    assert await _read_state(broker, "boom") == "crit"


# ── send_alert ─────────────────────────────────────────────────────────────

async def test_send_alert_broadcasts_and_persists(broker):
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
    [stored] = await _all_alerts(broker)
    assert stored.name == "cpu" and stored.level == "warn"


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
