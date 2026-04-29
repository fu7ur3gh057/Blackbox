class StateTracker:
    """Tracks last severity per check; fires only on level upgrade or recovery."""

    _SEVERITY = {"ok": 0, "warn": 1, "crit": 2}

    def __init__(self) -> None:
        self._levels: dict[str, str] = {}

    def observe(self, name: str, level: str) -> str | None:
        prev = self._levels.get(name)
        self._levels[name] = level
        if prev is None:
            return level if level != "ok" else None
        if prev == level:
            return None
        if level == "ok":
            return "ok"
        if self._SEVERITY[level] > self._SEVERITY[prev]:
            return level
        return None
