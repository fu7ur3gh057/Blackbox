import asyncio
import logging
import sys
from pathlib import Path

from .config import Config, load_config
from .notifiers import build_notifier
from .runner import Runner


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

    tasks = []

    if config.checks:
        tasks.append(Runner(config, all_notifiers).run())

    if config.report:
        from .report import build_report_runner

        logs_path = ((config.logs or {}).get("storage") or {}).get("path")
        report_runner = build_report_runner(
            config.report, notifiers_by_type, logs_storage_path=logs_path,
        )
        if report_runner is not None:
            tasks.append(report_runner.run())

    if config.logs:
        from .logs import build_log_processor

        log_processor = build_log_processor(config.logs, notifiers_by_type)
        if log_processor is not None:
            tasks.append(log_processor.run())

    if not tasks:
        log.warning("nothing to run, exiting")
        return

    await asyncio.gather(*tasks)


if __name__ == "__main__":
    main()
