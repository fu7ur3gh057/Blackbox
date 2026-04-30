"""Shared fixtures.

Each test that touches the broker also gets a fresh on-disk SQLite (under
the test's tmp_path) wired into broker.state. Tasks resolve sessions
through db.deps.get_session, which reads the same broker.state,
so production code path stays unchanged in tests.
"""

import pytest
import pytest_asyncio

from config import Config
from db.lifetime import init_db, shutdown_db
from services.taskiq.broker import broker as global_broker
from services.taskiq.context import AppContext


@pytest_asyncio.fixture
async def broker(tmp_path):
    """Start the module-level broker on a fresh in-test SQLite, yield it,
    shut down on exit. State is wiped first so previous tests can't bleed
    through TaskiqState (UserDict subclass — clear via .data)."""
    global_broker.state.data.clear()
    await init_db(tmp_path / "blackbox-test.sqlite")
    await global_broker.startup()
    try:
        yield global_broker
    finally:
        await global_broker.shutdown()
        await shutdown_db()


@pytest.fixture
def empty_config() -> Config:
    return Config(checks=[], notifiers=[])


@pytest.fixture
def app_ctx(empty_config: Config) -> AppContext:
    return AppContext(config=empty_config)
