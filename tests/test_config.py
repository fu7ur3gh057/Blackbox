"""Config loader: shape of parsed objects, optional sections,
and how unknown keys leak into options."""

from pathlib import Path

import pytest

from core.config import load_config


def _write(tmp_path: Path, body: str) -> Path:
    p = tmp_path / "config.yaml"
    p.write_text(body)
    return p


def test_load_minimal(tmp_path: Path):
    cfg = load_config(_write(tmp_path, "checks: []\nnotifiers: []\n"))
    assert cfg.checks == []
    assert cfg.notifiers == []
    assert cfg.report is None
    assert cfg.logs is None
    assert cfg.web is None


def test_load_check_options_include_unknown_keys(tmp_path: Path):
    cfg = load_config(_write(tmp_path, """
checks:
  - type: cpu
    name: cpu
    interval: 60
    warn_pct: 70
    crit_pct: 95
notifiers: []
"""))
    [check] = cfg.checks
    assert check.type == "cpu"
    assert check.name == "cpu"
    assert check.interval == 60.0
    assert check.options == {"warn_pct": 70, "crit_pct": 95}


def test_load_notifier_options(tmp_path: Path):
    cfg = load_config(_write(tmp_path, """
checks: []
notifiers:
  - type: telegram
    bot_token: "xxx"
    chat_id: "42"
    lang: ru
"""))
    [n] = cfg.notifiers
    assert n.type == "telegram"
    assert n.options == {"bot_token": "xxx", "chat_id": "42", "lang": "ru"}


def test_default_interval(tmp_path: Path):
    cfg = load_config(_write(tmp_path, """
checks:
  - type: cpu
    name: cpu
notifiers: []
"""))
    assert cfg.checks[0].interval == 60.0


def test_report_logs_web_passthrough(tmp_path: Path):
    cfg = load_config(_write(tmp_path, """
checks: []
notifiers: []
report:
  interval: 1800
  hostname: vps
logs:
  digest_interval: 600
web:
  enabled: true
"""))
    assert cfg.report == {"interval": 1800, "hostname": "vps"}
    assert cfg.logs == {"digest_interval": 600}
    assert cfg.web == {"enabled": True}


def test_missing_required_field_raises(tmp_path: Path):
    with pytest.raises(KeyError):
        load_config(_write(tmp_path, """
checks:
  - type: cpu
    interval: 60
notifiers: []
"""))
