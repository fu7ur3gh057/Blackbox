from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class CheckConfig:
    type: str
    name: str
    interval: float
    options: dict = field(default_factory=dict)


@dataclass
class NotifierConfig:
    type: str
    options: dict = field(default_factory=dict)


@dataclass
class Config:
    checks: list[CheckConfig]
    notifiers: list[NotifierConfig]
    report: dict | None = None
    logs: dict | None = None
    web: dict | None = None
    db: dict | None = None


def load_config(path: Path) -> Config:
    raw = yaml.safe_load(path.read_text()) or {}
    checks = [
        CheckConfig(
            type=item.pop("type"),
            name=item.pop("name"),
            interval=float(item.pop("interval", 60)),
            options=item,
        )
        for item in raw.get("checks", [])
    ]
    notifiers = [
        NotifierConfig(type=item.pop("type"), options=item)
        for item in raw.get("notifiers", [])
    ]
    return Config(
        checks=checks,
        notifiers=notifiers,
        report=raw.get("report"),
        logs=raw.get("logs"),
        web=raw.get("web"),
        db=raw.get("db"),
    )
