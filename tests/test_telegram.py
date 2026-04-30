"""TelegramNotifier: HTML rendering — spoilers around percentages, level
icons, kind-specific bodies, and the actual HTTP shape we send."""

import httpx
import pytest
import respx

from core.notifiers import Alert
from core.notifiers.telegram import TelegramNotifier


@pytest.fixture
def notifier() -> TelegramNotifier:
    return TelegramNotifier(bot_token="x", chat_id="42", lang="ru")


@respx.mock
async def test_alert_payload_uses_html_parse_mode(notifier: TelegramNotifier):
    route = respx.post("https://api.telegram.org/botx/sendMessage").mock(
        return_value=httpx.Response(200, json={"ok": True}),
    )
    alert = Alert(check="cpu", level="warn", detail="cpu", kind="cpu",
                  metrics={"value": 84.2, "threshold": 80.0})
    await notifier.send(alert)

    [call] = route.calls
    body = call.request.read().decode()
    assert '"parse_mode":"HTML"' in body or '"parse_mode": "HTML"' in body
    assert '"chat_id":"42"' in body or '"chat_id": "42"' in body


@respx.mock
async def test_warn_uses_yellow_circle_and_spoilers(notifier: TelegramNotifier):
    route = respx.post("https://api.telegram.org/botx/sendMessage").mock(
        return_value=httpx.Response(200, json={"ok": True}),
    )
    await notifier.send(Alert(check="memory", level="warn", detail="x", kind="memory",
                              metrics={"value": 84.2, "threshold": 80.0}))
    body = route.calls[0].request.read().decode()
    assert "🟡" in body
    # Both percentage values should be wrapped in spoilers
    assert "<tg-spoiler><b>84.2%</b></tg-spoiler>" in body
    assert "<tg-spoiler><b>80%</b></tg-spoiler>" in body


@respx.mock
async def test_crit_uses_red_circle(notifier: TelegramNotifier):
    route = respx.post("https://api.telegram.org/botx/sendMessage").mock(
        return_value=httpx.Response(200, json={"ok": True}),
    )
    await notifier.send(Alert(check="cpu", level="crit", detail="x", kind="cpu",
                              metrics={"value": 95.5, "threshold": 90.0}))
    body = route.calls[0].request.read().decode()
    assert "🔴" in body


@respx.mock
async def test_recovery_uses_check_mark(notifier: TelegramNotifier):
    route = respx.post("https://api.telegram.org/botx/sendMessage").mock(
        return_value=httpx.Response(200, json={"ok": True}),
    )
    await notifier.send(Alert(check="memory", level="ok", detail="x", kind="memory",
                              metrics={"value": 67.4, "threshold": 80.0}))
    body = route.calls[0].request.read().decode()
    assert "✅" in body
    assert "<tg-spoiler><b>67.4%</b></tg-spoiler>" in body


@respx.mock
async def test_disk_includes_free_gb_unspoilered(notifier: TelegramNotifier):
    route = respx.post("https://api.telegram.org/botx/sendMessage").mock(
        return_value=httpx.Response(200, json={"ok": True}),
    )
    await notifier.send(Alert(check="disk-root", level="warn", detail="x", kind="disk",
                              metrics={"value": 85.0, "threshold": 80.0,
                                       "path": "/var", "free_gb": 12.3}))
    body = route.calls[0].request.read().decode()
    # Percentages spoilered, free disk space deliberately not — user explicitly
    # asked for spoiler over percentages only.
    assert "<tg-spoiler><b>85.0%</b></tg-spoiler>" in body
    assert "12.3" in body  # free GB present in plain
    assert "<tg-spoiler>12.3" not in body


@respx.mock
async def test_startup_and_shutdown_messages(notifier: TelegramNotifier):
    route = respx.post("https://api.telegram.org/botx/sendMessage").mock(
        return_value=httpx.Response(200, json={"ok": True}),
    )
    await notifier.send_startup()
    await notifier.send_shutdown()
    assert len(route.calls) == 2
    bodies = [c.request.read().decode() for c in route.calls]
    assert any("🟢" in b and "подключ" in b for b in bodies)
    assert any("⏹" in b and "остановлен" in b for b in bodies)


@respx.mock
async def test_unknown_kind_falls_back_to_detail():
    """When kind+level isn't in the templates table, body falls back to
    the escaped detail string."""
    n = TelegramNotifier(bot_token="x", chat_id="42", lang="en")
    route = respx.post("https://api.telegram.org/botx/sendMessage").mock(
        return_value=httpx.Response(200, json={"ok": True}),
    )
    await n.send(Alert(check="weird", level="warn", detail="<unknown>", kind=""))
    body = route.calls[0].request.read().decode()
    assert "&lt;unknown&gt;" in body  # html-escaped
