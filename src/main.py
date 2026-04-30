import asyncio
import logging
import signal
import sys
from pathlib import Path

from monitoring.config import Config, load_config
from monitoring.notifiers import build_notifier
from monitoring.runner import Runner


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    config_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("config.yaml")
    config = load_config(config_path)
    asyncio.run(_run(config))


async def _run(config: Config) -> None:
    log = logging.getLogger(__name__)

    notifiers_by_type = {n.type: build_notifier(n) for n in config.notifiers}
    all_notifiers = list(notifiers_by_type.values())

    for n in all_notifiers:
        try:
            await n.send_startup()
        except Exception:
            log.exception("startup notification failed for %s", type(n).__name__)

    coros = []

    if config.checks:
        coros.append(Runner(config, all_notifiers).run())

    if config.report:
        from monitoring.report import build_report_runner

        logs_path = ((config.logs or {}).get("storage") or {}).get("path")
        report_runner = build_report_runner(
            config.report, notifiers_by_type, logs_storage_path=logs_path,
        )
        if report_runner is not None:
            coros.append(report_runner.run())

    if config.logs:
        from monitoring.logs import build_log_processor

        log_processor = build_log_processor(config.logs, notifiers_by_type)
        if log_processor is not None:
            coros.append(log_processor.run())

    if not coros:
        log.warning("nothing to run, exiting")
        return

    tasks = [asyncio.create_task(c) for c in coros]

    loop = asyncio.get_running_loop()
    stop = loop.create_future()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _set_if_pending, stop, sig.name)
        except (NotImplementedError, RuntimeError):
            pass

    try:
        await asyncio.wait(
            [stop, *tasks], return_when=asyncio.FIRST_COMPLETED,
        )
        if stop.done():
            log.info("received %s, shutting down", stop.result())
    finally:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

        for n in all_notifiers:
            try:
                await asyncio.wait_for(n.send_shutdown(), timeout=5)
            except Exception:
                log.exception("shutdown notification failed for %s", type(n).__name__)


def _set_if_pending(fut: asyncio.Future, value: str) -> None:
    if not fut.done():
        fut.set_result(value)


if __name__ == "__main__":
    main()
