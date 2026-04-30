"""Report assembly: section formatting, alerts block, recommendations spoiler."""

from core.report.builder import _alerts_block, _recommendations, assemble
from core.report.sections.base import SectionResult


def test_assemble_includes_hostname_and_section_text():
    sec = SectionResult(text="📊 VPS\nCPU: 5%", warnings=[])
    out = assemble("vps01", [sec], lang="en")
    assert "vps01" in out
    assert "<b>📊 VPS</b>" in out
    assert "CPU: 5%" in out


def test_assemble_no_warnings_no_recommendations_block():
    sec = SectionResult(text="hello", warnings=[])
    out = assemble("", [sec], lang="ru")
    assert "Рекомендации" not in out


def test_alerts_block_lists_each_warning():
    out = _alerts_block(["disk /var 92%", "swap 100%"], lang="en")
    assert "2 alerts" in out
    assert "disk /var 92%" in out
    assert "swap 100%" in out


def test_recommendations_wrapped_in_spoiler():
    """The user explicitly asked for the recommendations body to be hidden
    behind a spoiler so the report stays compact."""
    out = _recommendations(["swap 100%", "disk /var 92%"], lang="ru")
    assert out is not None
    assert "<tg-spoiler>" in out
    assert "</tg-spoiler>" in out
    # Header stays visible — outside the spoiler
    body_start = out.index("<tg-spoiler>")
    assert "Рекомендации" in out[:body_start]


def test_recommendations_dedup_advice():
    """Two warnings that match the same trigger should still yield only
    one recommendation line."""
    out = _recommendations(["disk /var 90%", "disk /home 95%"], lang="en")
    assert out is not None
    # Disk advice appears once
    assert out.count("Free disk space") == 1


def test_recommendations_returns_none_when_no_match():
    out = _recommendations(["something unrecognised"], lang="en")
    assert out is None


def test_recommendations_returns_none_when_no_warnings():
    assert _recommendations([], lang="en") is None


def test_assemble_escapes_html_in_section_text():
    sec = SectionResult(text="<dangerous>")
    out = assemble("", [sec], lang="en")
    assert "&lt;dangerous&gt;" in out
    assert "<dangerous>" not in out
