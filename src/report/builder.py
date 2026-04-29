from ..i18n import fmt_now, fmt_uptime, uptime_label
from .sections.base import SectionResult


def _esc(s: str) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


_REPORT_LABEL = {"en": "Status report", "ru": "Состояние сервера"}
_ALERTS_LABEL = {"en": "alerts", "ru": "алерты"}


def assemble(hostname: str, sections: list[SectionResult], lang: str = "en") -> str:
    parts = [_header(hostname, lang)]
    warnings: list[str] = []
    for s in sections:
        parts.append(_html_section(s.text))
        warnings.extend(s.warnings)
    if warnings:
        parts.append(_alerts_block(warnings, lang))
    return "\n\n".join(parts)


def _header(hostname: str, lang: str) -> str:
    label = _REPORT_LABEL.get(lang, _REPORT_LABEL["en"])
    line1 = f"📊 <b>{label}</b>"
    if hostname:
        line1 += f"  ·  <code>{_esc(hostname)}</code>"
    up = fmt_uptime(lang)
    up_label = uptime_label(lang)
    ts = fmt_now(lang)
    line2 = f"<i>{ts} · {up_label} {up}</i>" if up else f"<i>{ts}</i>"
    return f"{line1}\n{line2}"


def _html_section(text: str) -> str:
    if "\n" in text:
        first, rest = text.split("\n", 1)
        return f"<b>{_esc(first)}</b>\n{_esc(rest)}"
    return f"<b>{_esc(text)}</b>"


def _alerts_block(warnings: list[str], lang: str) -> str:
    lines = [f"⚠️ <b>{len(warnings)} {_ALERTS_LABEL.get(lang, 'alerts')}</b>"]
    for w in warnings:
        lines.append(f"🟡 {_esc(w)}")
    return "\n".join(lines)
