"""Shared fixtures.

Each test that touches the broker gets a fresh InMemoryBroker so registered
tasks and state never leak across tests.
"""

import pytest
import pytest_asyncio

from core.config import Config
from services.taskiq.broker import broker as global_broker
from services.taskiq.context import AppContext


@pytest_asyncio.fixture
async def broker():
    """Start the module-level broker, yield it, shut down on exit. The state
    is wiped before yielding so previous tests can't bleed through. TaskiqState
    is a UserDict subclass, so we clear via the .data dict."""
    global_broker.state.data.clear()
    await global_broker.startup()
    try:
        yield global_broker
    finally:
        await global_broker.shutdown()


@pytest.fixture
def empty_config() -> Config:
    return Config(checks=[], notifiers=[])


@pytest.fixture
def app_ctx(empty_config: Config) -> AppContext:
    return AppContext(config=empty_config)
