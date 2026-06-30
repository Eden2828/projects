"""Scheduler: run the monitoring cycle on a fixed interval.

Two ways to schedule:
  * In-process loop (this module): ``python -m app.scheduler`` runs ``run_once``
    immediately and then every CHECK_INTERVAL_MINUTES. Good for a container or a
    long-running service.
  * External cron: schedule ``python -m app.main`` instead (see README). Preferred
    on platforms that already provide cron/systemd timers.

The loop is crash-resilient: a failure in one cycle is logged and the loop
continues to the next interval rather than exiting.
"""

from __future__ import annotations

import signal
import time
from types import FrameType
from typing import Optional

import schedule

from . import config as cfg
from .action_logger import configure_logging, get_logger
from .main import run_once

log = get_logger("scheduler")

_stop = False


def _handle_signal(signum: int, _frame: Optional[FrameType]) -> None:
    global _stop
    log.info("Received signal %s; will stop after the current cycle.", signum)
    _stop = True


def _safe_run() -> None:
    """Run one cycle, swallowing exceptions so the scheduler keeps going."""
    try:
        run_once()
    except SystemExit as exc:
        log.error("Cycle aborted: %s", exc)
    except Exception:  # noqa: BLE001
        log.exception("Cycle failed; will retry at the next interval")


def main() -> int:
    settings = cfg.load_settings()
    configure_logging(level=settings.log_level, as_json=settings.log_json)

    interval = max(1, settings.check_interval_minutes)
    log.info("Scheduler starting; interval = %d minute(s)", interval)

    # Graceful shutdown on Ctrl-C / SIGTERM.
    signal.signal(signal.SIGINT, _handle_signal)
    try:
        signal.signal(signal.SIGTERM, _handle_signal)
    except (AttributeError, ValueError):
        pass  # SIGTERM not available on some platforms (e.g. Windows non-main thread)

    # Run immediately on startup, then on the interval.
    _safe_run()
    schedule.every(interval).minutes.do(_safe_run)

    while not _stop:
        schedule.run_pending()
        time.sleep(1)

    log.info("Scheduler stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
