"""Structured logging and error capture.

Provides:
  * ``configure_logging`` - sets up console logging (plain or JSON).
  * ``get_logger`` - convenience accessor.
  * ``ActionLogger`` - thin wrapper that records errors both to the log and to
    the Supabase ``system_errors`` table (best-effort, never raises).

This module is intentionally dependency-light so it can be imported everywhere,
including by the Supabase client itself (which is passed in lazily to avoid a
circular import).
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class _JsonFormatter(logging.Formatter):
    """Render log records as single-line JSON for log pipelines."""

    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Attach any structured extras passed via logger.x(..., extra={"extra": {...}}).
        extra = getattr(record, "extra", None)
        if isinstance(extra, dict):
            payload.update(extra)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: str = "INFO", as_json: bool = False) -> None:
    """Configure the root logger once for the whole process."""
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove any pre-existing handlers to avoid duplicate lines on re-runs.
    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(stream=sys.stdout)
    if as_json:
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S%z",
            )
        )
    root.addHandler(handler)

    # Quiet noisy third-party libraries.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


class ActionLogger:
    """Records errors to logs and (best-effort) to the Supabase error table.

    ``supabase_client`` is optional and injected after construction so this
    module has no hard dependency on Supabase.
    """

    def __init__(self, run_id: str, supabase_client: Optional[Any] = None) -> None:
        self.run_id = run_id
        self.supabase_client = supabase_client
        self.log = get_logger("agent")
        self.error_count = 0

    def attach_supabase(self, supabase_client: Any) -> None:
        self.supabase_client = supabase_client

    def info(self, message: str, **extra: Any) -> None:
        self.log.info(message, extra={"extra": extra} if extra else None)

    def warning(self, message: str, **extra: Any) -> None:
        self.log.warning(message, extra={"extra": extra} if extra else None)

    def debug(self, message: str, **extra: Any) -> None:
        self.log.debug(message, extra={"extra": extra} if extra else None)

    def error(
        self,
        component: str,
        message: str,
        *,
        client_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        severity: str = "ERROR",
        exc_info: bool = False,
    ) -> None:
        """Log an error and persist it to ``system_errors`` if Supabase is wired up."""
        self.error_count += 1
        self.log.error(
            f"[{component}] {message}",
            extra={"extra": {"component": component, "client_id": client_id, **(context or {})}},
            exc_info=exc_info,
        )
        if self.supabase_client is not None:
            try:
                self.supabase_client.record_error(
                    run_id=self.run_id,
                    component=component,
                    message=message,
                    client_id=client_id,
                    severity=severity,
                    context=context,
                )
            except Exception:  # noqa: BLE001 - error logging must never crash the run
                self.log.exception("Failed to persist error to Supabase")
