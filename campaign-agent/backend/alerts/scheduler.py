"""Periodic + on-demand scanning: pull each account, run rules, persist alerts."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

from apscheduler.schedulers.background import BackgroundScheduler

from .. import db, settings
from ..connectors import base
from . import engine

log = logging.getLogger("scheduler")

_scheduler: BackgroundScheduler | None = None


def _load_rules() -> Dict[str, Any]:
    if not settings.RULES_FILE.exists():
        return {}
    try:
        return json.loads(settings.RULES_FILE.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return {}


def scan_account(account: Dict[str, Any]) -> Dict[str, Any]:
    """Scan one account: fetch → evaluate → persist. Returns a small status dict."""
    account_id = account.get("client_id") or account.get("ad_account_id")
    name = account.get("client_name", account_id)
    try:
        snapshots = base.fetch_snapshots(account, date_preset=settings.SCAN_DATE_PRESET)
        try:
            mtd = base.account_spend(account, "this_month")
        except Exception:  # noqa: BLE001  — budget rule is optional
            mtd = 0.0

        prev_map = db.get_previous_snapshots(account_id)
        rules = engine.merge_rules(_load_rules(), account.get("client_id"))
        ctx = engine.RuleContext(
            get_previous=lambda eid: prev_map.get(eid),
            month_to_date_spend=mtd,
        )
        findings = engine.evaluate_client(account, snapshots, rules, ctx)

        db.save_snapshots(account_id, snapshots)
        db.replace_alerts(account_id, findings)
        log.info("Scanned %s: %d entities, %d findings", name, len(snapshots), len(findings))
        return {"account": name, "ok": True, "entities": len(snapshots), "findings": len(findings)}
    except Exception as e:  # noqa: BLE001
        log.exception("Scan failed for %s", name)
        return {"account": name, "ok": False, "error": str(e)}


def scan_all() -> List[Dict[str, Any]]:
    results = []
    for account in base.load_accounts():
        if account.get("status") == "paused":
            continue
        results.append(scan_account(account))
    return results


def start_scheduler() -> None:
    global _scheduler
    if not settings.SCHEDULER_ENABLED or _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        scan_all,
        "interval",
        minutes=settings.SCAN_INTERVAL_MINUTES,
        id="scan_all",
        next_run_time=None,  # don't run immediately on boot
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    log.info("Scheduler started (every %d min)", settings.SCAN_INTERVAL_MINUTES)


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
