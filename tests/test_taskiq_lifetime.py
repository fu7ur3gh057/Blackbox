"""init_broker should populate AppContext with notifiers, checks, and
report metadata, then attach it to broker.state."""

from core.config import Config, NotifierConfig, CheckConfig
from services.taskiq.broker import broker as global_broker
from services.taskiq.lifetime import init_broker, shutdown_broker


async def test_init_broker_attaches_app_context_to_state():
    cfg = Config(
        checks=[CheckConfig(type="cpu", name="cpu", interval=60.0,
                            options={"warn_pct": 80, "crit_pct": 90})],
        notifiers=[NotifierConfig(type="telegram",
                                  options={"bot_token": "t", "chat_id": "1"})],
    )
    try:
        ctx = await init_broker(cfg)
        assert "cpu" in ctx.checks_by_name
        assert "telegram" in ctx.notifiers_by_type
        assert global_broker.state.app_ctx is ctx
        assert ctx.tracker._levels == {}
    finally:
        await shutdown_broker()


async def test_init_broker_with_report_seeds_sections_and_targets():
    cfg = Config(
        checks=[],
        notifiers=[NotifierConfig(type="telegram",
                                  options={"bot_token": "t", "chat_id": "1"})],
        report={"interval": 300, "hostname": "vps01", "host": {"disks": ["/"]}},
    )
    try:
        ctx = await init_broker(cfg)
        assert ctx.report_hostname == "vps01"
        assert ctx.report_sections, "expected at least one section"
        assert ctx.report_targets, "expected at least one notifier target"
    finally:
        await shutdown_broker()


async def test_init_broker_without_report_leaves_report_fields_empty():
    cfg = Config(checks=[], notifiers=[])
    try:
        ctx = await init_broker(cfg)
        assert ctx.report_sections == []
        assert ctx.report_targets == []
    finally:
        await shutdown_broker()
