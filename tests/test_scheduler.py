"""Scheduler: kicks each check on its interval, reports do too."""

import asyncio

from config import Config
from services.taskiq.context import AppContext
from services.taskiq.scheduler import _periodic, run_scheduler


async def test_periodic_kicks_repeatedly():
    counter = 0
    fired = asyncio.Event()

    async def kick():
        nonlocal counter
        counter += 1
        if counter >= 3:
            fired.set()

    task = asyncio.create_task(_periodic("noop", interval=0.01, kick=kick))
    await asyncio.wait_for(fired.wait(), timeout=2)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert counter >= 3


async def test_periodic_swallows_kick_errors():
    """A failing kick must not stop the scheduler — it logs and keeps going."""
    fired = asyncio.Event()
    counter = 0

    async def kick():
        nonlocal counter
        counter += 1
        if counter == 1:
            raise RuntimeError("first one fails")
        if counter >= 3:
            fired.set()

    task = asyncio.create_task(_periodic("flaky", interval=0.01, kick=kick))
    await asyncio.wait_for(fired.wait(), timeout=2)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert counter >= 3


async def test_run_scheduler_with_no_work_returns_immediately():
    ctx = AppContext(config=Config(checks=[], notifiers=[]))
    # No checks, no report — should return without spinning forever
    await asyncio.wait_for(run_scheduler(ctx), timeout=1)
