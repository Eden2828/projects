"""SQLite persistence: snapshots (for trend detection), alerts, chat history.

Zero-config — a single file under ``data/``. Thread-safe enough for this
internal tool: every call opens a short-lived connection.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import settings

_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    with _lock, _conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS snapshots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id  TEXT NOT NULL,
                entity_id   TEXT NOT NULL,
                captured_at TEXT NOT NULL,
                data        TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_snap_account_entity
                ON snapshots(account_id, entity_id, captured_at);

            CREATE TABLE IF NOT EXISTS alerts (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id           TEXT NOT NULL,
                dedup_key            TEXT NOT NULL,
                issue_type           TEXT NOT NULL,
                severity             TEXT NOT NULL,
                level                TEXT,
                client_name          TEXT,
                campaign_name        TEXT,
                adset_name           TEXT,
                ad_name              TEXT,
                title                TEXT,
                explanation          TEXT,
                recommended_next_step TEXT,
                metric_value         TEXT,
                benchmark_or_target  TEXT,
                status               TEXT NOT NULL DEFAULT 'open',
                detected_at          TEXT NOT NULL,
                updated_at           TEXT NOT NULL,
                UNIQUE(account_id, dedup_key)
            );
            CREATE INDEX IF NOT EXISTS idx_alert_account_status
                ON alerts(account_id, status);

            CREATE TABLE IF NOT EXISTS chat_history (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                username   TEXT NOT NULL,
                account_id TEXT,
                role       TEXT NOT NULL,
                content    TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )


# ----------------------------------------------------------------------------
# Snapshots
# ----------------------------------------------------------------------------
def get_previous_snapshots(account_id: str) -> Dict[str, Dict[str, Any]]:
    """Return the most recent snapshot per entity_id for an account."""
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT entity_id, data, MAX(captured_at) AS captured_at
            FROM snapshots
            WHERE account_id = ?
            GROUP BY entity_id
            """,
            (account_id,),
        ).fetchall()
    out: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        try:
            out[r["entity_id"]] = json.loads(r["data"])
        except (ValueError, TypeError):
            pass
    return out


def save_snapshots(account_id: str, snapshots: List[Dict[str, Any]]) -> None:
    ts = _now()
    with _lock, _conn() as conn:
        conn.executemany(
            "INSERT INTO snapshots(account_id, entity_id, captured_at, data) VALUES (?,?,?,?)",
            [
                (account_id, s.get("entity_id") or "", ts, json.dumps(s, ensure_ascii=False, default=str))
                for s in snapshots
                if s.get("entity_id")
            ],
        )
        # Retention: keep only the two most recent capture timestamps per account.
        keep = conn.execute(
            "SELECT DISTINCT captured_at FROM snapshots WHERE account_id=? "
            "ORDER BY captured_at DESC LIMIT 2",
            (account_id,),
        ).fetchall()
        if keep:
            oldest_kept = keep[-1]["captured_at"]
            conn.execute(
                "DELETE FROM snapshots WHERE account_id=? AND captured_at < ?",
                (account_id, oldest_kept),
            )


# ----------------------------------------------------------------------------
# Alerts
# ----------------------------------------------------------------------------
def _dedup_key(finding: Dict[str, Any]) -> str:
    parts = [
        finding.get("issue_type") or "",
        finding.get("level") or "",
        finding.get("campaign_name") or "",
        finding.get("adset_name") or "",
        finding.get("ad_name") or "",
    ]
    return "|".join(parts)


def replace_alerts(account_id: str, findings: List[Dict[str, Any]]) -> None:
    """Upsert findings into the alerts table for an account.

    - New findings are inserted as ``open``.
    - Findings already present keep their status (so acknowledgements survive)
      but refresh their metrics/timestamp.
    - Previously-open findings that no longer appear are auto-resolved.
    """
    ts = _now()
    current_keys = set()
    with _lock, _conn() as conn:
        for f in findings:
            key = _dedup_key(f)
            current_keys.add(key)
            title = _title_for(f)
            existing = conn.execute(
                "SELECT id, status FROM alerts WHERE account_id=? AND dedup_key=?",
                (account_id, key),
            ).fetchone()
            if existing:
                conn.execute(
                    """UPDATE alerts SET severity=?, level=?, client_name=?, campaign_name=?,
                       adset_name=?, ad_name=?, title=?, explanation=?, recommended_next_step=?,
                       metric_value=?, benchmark_or_target=?, updated_at=?,
                       status=CASE WHEN status='resolved' THEN 'open' ELSE status END
                       WHERE id=?""",
                    (
                        f.get("severity"), f.get("level"), f.get("client_name"),
                        f.get("campaign_name"), f.get("adset_name"), f.get("ad_name"),
                        title, f.get("explanation"), f.get("recommended_next_step"),
                        f.get("metric_value"), f.get("benchmark_or_target"), ts, existing["id"],
                    ),
                )
            else:
                conn.execute(
                    """INSERT INTO alerts(account_id, dedup_key, issue_type, severity, level,
                       client_name, campaign_name, adset_name, ad_name, title, explanation,
                       recommended_next_step, metric_value, benchmark_or_target, status,
                       detected_at, updated_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'open', ?, ?)""",
                    (
                        account_id, key, f.get("issue_type"), f.get("severity"), f.get("level"),
                        f.get("client_name"), f.get("campaign_name"), f.get("adset_name"),
                        f.get("ad_name"), title, f.get("explanation"),
                        f.get("recommended_next_step"), f.get("metric_value"),
                        f.get("benchmark_or_target"), ts, ts,
                    ),
                )
        # Auto-resolve open alerts that are no longer detected.
        open_rows = conn.execute(
            "SELECT id, dedup_key FROM alerts WHERE account_id=? AND status='open'",
            (account_id,),
        ).fetchall()
        for r in open_rows:
            if r["dedup_key"] not in current_keys:
                conn.execute(
                    "UPDATE alerts SET status='resolved', updated_at=? WHERE id=?",
                    (ts, r["id"]),
                )


SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}


def list_alerts(account_id: Optional[str] = None, status: str = "open") -> List[Dict[str, Any]]:
    q = "SELECT * FROM alerts WHERE 1=1"
    params: List[Any] = []
    if account_id:
        q += " AND account_id=?"
        params.append(account_id)
    if status and status != "all":
        q += " AND status=?"
        params.append(status)
    with _conn() as conn:
        rows = conn.execute(q, params).fetchall()
    alerts = [dict(r) for r in rows]
    alerts.sort(key=lambda a: (SEVERITY_ORDER.get(a.get("severity"), 9), a.get("detected_at") or ""))
    return alerts


def acknowledge_alert(alert_id: int) -> bool:
    with _lock, _conn() as conn:
        cur = conn.execute(
            "UPDATE alerts SET status='acknowledged', updated_at=? WHERE id=? AND status='open'",
            (_now(), alert_id),
        )
        return cur.rowcount > 0


def count_open_by_account() -> Dict[str, int]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT account_id, COUNT(*) AS n FROM alerts WHERE status='open' GROUP BY account_id"
        ).fetchall()
    return {r["account_id"]: r["n"] for r in rows}


# ----------------------------------------------------------------------------
# Chat history
# ----------------------------------------------------------------------------
def save_chat(username: str, account_id: Optional[str], role: str, content: str) -> None:
    with _lock, _conn() as conn:
        conn.execute(
            "INSERT INTO chat_history(username, account_id, role, content, created_at) VALUES (?,?,?,?,?)",
            (username, account_id, role, content, _now()),
        )


# ----------------------------------------------------------------------------
def _title_for(f: Dict[str, Any]) -> str:
    """Short Hebrew headline per issue type."""
    titles = {
        "active_campaign_zero_spend": "קמפיין פעיל ללא הוצאה",
        "spend_without_results": "הוצאה ללא תוצאות",
        "suspected_tracking_issue": "חשד לבעיית מעקב (tracking)",
        "cpa_above_target": "CPA גבוה מהיעד",
        "roas_below_target": "ROAS נמוך מהיעד",
        "sudden_cpa_increase": "קפיצה חדה ב-CPA",
        "sudden_spend_drop": "ירידה חדה בהוצאה",
        "high_frequency": "תדירות חשיפה גבוהה",
        "low_ctr": "CTR נמוך",
        "entity_turned_off": "ישות כובתה",
        "learning_limited": "Learning Limited",
        "cpm_above_account_average": "CPM גבוה מהממוצע",
        "ad_rejected_or_limited": "מודעה נדחתה / מוגבלת",
        "near_monthly_budget_cap": "מתקרב לתקרת התקציב החודשי",
    }
    base = titles.get(f.get("issue_type") or "", f.get("issue_type") or "התראה")
    name = f.get("campaign_name") or f.get("client_name") or ""
    return f"{base} — {name}" if name else base
