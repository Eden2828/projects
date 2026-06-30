"""Supabase persistence layer.

Wraps the supabase-py client and exposes typed helpers for each table:
clients, performance_snapshots, qa_findings, daily_reports, system_errors.

All write methods are best-effort and log failures rather than raising, so a
transient database hiccup never aborts a monitoring run (the run still produces
local reports). The exception is ``record_error`` which deliberately swallows
everything to avoid recursive error storms.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .action_logger import get_logger
from .config import normalize_client

log = get_logger("supabase_client")

try:  # supabase is optional at import time so tooling can run without it.
    from supabase import Client, create_client
except Exception:  # noqa: BLE001
    Client = Any  # type: ignore
    create_client = None  # type: ignore


class SupabaseClient:
    """Thin, typed wrapper around the Supabase REST client."""

    def __init__(self, url: str, service_role_key: str) -> None:
        if create_client is None:
            raise RuntimeError("supabase package is not installed.")
        self._client: Client = create_client(url, service_role_key)

    # ------------------------------------------------------------------
    # clients
    # ------------------------------------------------------------------
    def get_clients(self, only_active: bool = True) -> List[Dict[str, Any]]:
        """Load the managed client list from the clients table."""
        query = self._client.table("clients").select("*")
        if only_active:
            query = query.eq("status", "active")
        resp = query.execute()
        return [normalize_client(row) for row in (resp.data or [])]

    # ------------------------------------------------------------------
    # performance_snapshots
    # ------------------------------------------------------------------
    def insert_snapshots(self, snapshots: List[Dict[str, Any]]) -> int:
        """Bulk-insert performance snapshots. Returns the number inserted."""
        if not snapshots:
            return 0
        try:
            resp = self._client.table("performance_snapshots").insert(snapshots).execute()
            return len(resp.data or [])
        except Exception:  # noqa: BLE001
            log.exception("Failed to insert performance snapshots")
            return 0

    def get_previous_snapshot(
        self, client_id: str, entity_id: str
    ) -> Optional[Dict[str, Any]]:
        """Return the most recent prior snapshot for an entity (for trend rules)."""
        try:
            resp = (
                self._client.table("performance_snapshots")
                .select("*")
                .eq("client_id", client_id)
                .eq("entity_id", entity_id)
                .order("captured_at", desc=True)
                .limit(1)
                .execute()
            )
            rows = resp.data or []
            return rows[0] if rows else None
        except Exception:  # noqa: BLE001
            log.exception("Failed to fetch previous snapshot for %s", entity_id)
            return None

    def get_month_to_date_spend(self, client_id: str, month_start_iso: str) -> float:
        """Sum campaign-level spend snapshots since the start of the month.

        Used for the 'close to monthly budget cap' rule. We only sum the
        campaign level to avoid double counting adset/ad rows.
        """
        try:
            resp = (
                self._client.table("performance_snapshots")
                .select("spend")
                .eq("client_id", client_id)
                .eq("level", "campaign")
                .gte("captured_at", month_start_iso)
                .execute()
            )
            return sum(float(r.get("spend") or 0) for r in (resp.data or []))
        except Exception:  # noqa: BLE001
            log.exception("Failed to compute MTD spend for %s", client_id)
            return 0.0

    # ------------------------------------------------------------------
    # qa_findings
    # ------------------------------------------------------------------
    def insert_findings(self, findings: List[Dict[str, Any]]) -> int:
        if not findings:
            return 0
        try:
            resp = self._client.table("qa_findings").insert(findings).execute()
            return len(resp.data or [])
        except Exception:  # noqa: BLE001
            log.exception("Failed to insert QA findings")
            return 0

    # ------------------------------------------------------------------
    # daily_reports
    # ------------------------------------------------------------------
    def insert_daily_report(self, report: Dict[str, Any]) -> Optional[str]:
        try:
            resp = self._client.table("daily_reports").insert(report).execute()
            rows = resp.data or []
            return rows[0].get("id") if rows else None
        except Exception:  # noqa: BLE001
            log.exception("Failed to insert daily report")
            return None

    # ------------------------------------------------------------------
    # system_errors
    # ------------------------------------------------------------------
    def record_error(
        self,
        *,
        run_id: str,
        component: str,
        message: str,
        client_id: Optional[str] = None,
        severity: str = "ERROR",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Persist a structured error row. Never raises."""
        try:
            self._client.table("system_errors").insert(
                {
                    "run_id": run_id,
                    "component": component,
                    "client_id": client_id,
                    "severity": severity,
                    "message": message[:2000],
                    "context": context,
                }
            ).execute()
        except Exception:  # noqa: BLE001
            # Deliberately swallowed: error logging must not cascade.
            log.debug("record_error failed (non-fatal)", exc_info=True)
