"""StateTracker should fire on level upgrades and on recovery, and stay
silent while the level holds steady."""

from core.state import StateTracker


def test_first_observation_emits_only_for_non_ok():
    s = StateTracker()
    assert s.observe("a", "ok") is None
    assert s.observe("b", "warn") == "warn"
    assert s.observe("c", "crit") == "crit"


def test_steady_state_is_silent():
    s = StateTracker()
    s.observe("a", "warn")
    assert s.observe("a", "warn") is None
    assert s.observe("a", "warn") is None


def test_upgrade_fires():
    s = StateTracker()
    s.observe("a", "warn")
    assert s.observe("a", "crit") == "crit"


def test_downgrade_warn_to_ok_fires_recovery():
    s = StateTracker()
    s.observe("a", "warn")
    assert s.observe("a", "ok") == "ok"


def test_downgrade_crit_to_warn_is_silent():
    """Crit→warn is still firing — we don't spam an alert for partial recovery,
    only the eventual return to ok counts."""
    s = StateTracker()
    s.observe("a", "crit")
    assert s.observe("a", "warn") is None


def test_per_check_isolation():
    s = StateTracker()
    s.observe("a", "crit")
    s.observe("b", "ok")
    # b's transition from ok to warn should fire even though a is crit
    assert s.observe("b", "warn") == "warn"
