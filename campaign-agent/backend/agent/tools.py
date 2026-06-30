"""Agent tool definitions (Claude tool-use) + handlers.

All tools are READ-ONLY. Each handler returns ``(content_str, is_error)``.
Account references accept a client_id, an ad_account_id, or a (fuzzy) name.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

from .. import db
from ..connectors import base

_PRESETS = [
    "today", "yesterday", "last_3d", "last_7d", "last_14d", "last_28d",
    "last_30d", "this_month", "last_month",
]

TOOLS: List[Dict[str, Any]] = [
    {
        "name": "list_accounts",
        "description": (
            "החזר את רשימת חשבונות המודעות שהקמפיינר יכול לגשת אליהם, כולל מזהה, שם, "
            "פלטפורמה, תקציב חודשי, יעדי CPA/ROAS, סטטוס, ומספר התראות פתוחות. "
            "קרא לזה תחילה אם אינך יודע באיזה חשבון מדובר."
        ),
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_account_overview",
        "description": (
            "תמונת מצב של חשבון: כמה קמפיינים באוויר, סיכום הוצאה/תוצאות/CPA/ROAS להיום, "
            "תקציבים, ומספר התראות פתוחות. השתמש בזה לשאלות כמו 'מה באוויר?' / 'מה המצב?'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"account": {"type": "string", "description": "מזהה/שם החשבון"}},
            "required": ["account"],
        },
    },
    {
        "name": "get_campaigns",
        "description": "רשימת הקמפיינים בחשבון עם סטטוס, תקציב, הוצאה ותוצאות (היום). אפשר לסנן לפי סטטוס.",
        "input_schema": {
            "type": "object",
            "properties": {
                "account": {"type": "string"},
                "status": {"type": "string", "enum": ["active", "paused", "all"],
                           "description": "ברירת מחדל: all"},
            },
            "required": ["account"],
        },
    },
    {
        "name": "get_performance",
        "description": (
            "ביצועים של חשבון לטווח זמן: הוצאה, תוצאות, CPA, ROAS, CTR, CPM, קליקים, חשיפות. "
            "השתמש בזה לשאלות כמו 'איך היה השבוע האחרון?' (date_preset=last_7d)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "account": {"type": "string"},
                "date_preset": {"type": "string", "enum": _PRESETS, "description": "ברירת מחדל: last_7d"},
                "breakdown": {"type": "boolean", "description": "אם true — החזר גם פירוט לפי קמפיין"},
            },
            "required": ["account"],
        },
    },
    {
        "name": "compare_periods",
        "description": "השווה ביצועי חשבון בין שתי תקופות (למשל last_7d מול קודם). מחזיר טוטאלים ושינוי באחוזים.",
        "input_schema": {
            "type": "object",
            "properties": {
                "account": {"type": "string"},
                "period_a": {"type": "string", "enum": _PRESETS, "description": "התקופה הנוכחית (למשל last_7d)"},
                "period_b": {"type": "string", "enum": _PRESETS, "description": "תקופת ההשוואה (למשל last_14d)"},
            },
            "required": ["account", "period_a", "period_b"],
        },
    },
    {
        "name": "get_active_alerts",
        "description": (
            "התראות פתוחות שזוהו ע\"י מנוע הניטור. ללא account — כל ההתראות; עם account — לחשבון מסוים. "
            "השתמש בזה לשאלות כמו 'מה לא טוב?' / 'על מה כדאי שאסתכל?'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"account": {"type": "string", "description": "אופציונלי"}},
            "additionalProperties": False,
        },
    },
]


# ----------------------------------------------------------------------------
def _resolve(account_query: str, user: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return base.resolve_account(account_query, user)


def _account_id(account: Dict[str, Any]) -> str:
    return account.get("client_id") or account.get("ad_account_id")


def _err(msg: str) -> Tuple[str, bool]:
    return json.dumps({"error": msg}, ensure_ascii=False), True


def _ok(payload: Any) -> Tuple[str, bool]:
    return json.dumps(payload, ensure_ascii=False, default=str), False


def execute_tool(name: str, tool_input: Dict[str, Any], user: Optional[Dict[str, Any]] = None) -> Tuple[str, bool]:
    try:
        if name == "list_accounts":
            return _list_accounts(user)
        if name == "get_account_overview":
            return _account_overview(tool_input, user)
        if name == "get_campaigns":
            return _campaigns(tool_input, user)
        if name == "get_performance":
            return _performance(tool_input, user)
        if name == "compare_periods":
            return _compare(tool_input, user)
        if name == "get_active_alerts":
            return _alerts(tool_input, user)
        return _err(f"כלי לא מוכר: {name}")
    except Exception as e:  # noqa: BLE001 — surface errors to the model, don't crash the loop
        return _err(f"שגיאה בהרצת {name}: {e}")


def _list_accounts(user) -> Tuple[str, bool]:
    open_counts = db.count_open_by_account()
    out = []
    for a in base.accounts_for_user(user):
        aid = _account_id(a)
        out.append({
            "id": a.get("client_id"),
            "name": a.get("client_name"),
            "platform": a.get("platform", "meta"),
            "status": a.get("status"),
            "monthly_budget": a.get("monthly_budget"),
            "target_cpa": a.get("target_cpa"),
            "target_roas": a.get("target_roas"),
            "open_alerts": open_counts.get(aid, 0),
        })
    return _ok({"accounts": out})


def _account_overview(inp, user) -> Tuple[str, bool]:
    account = _resolve(inp.get("account", ""), user)
    if not account:
        return _err("לא נמצא חשבון תואם. קרא ל-list_accounts לרשימה.")
    snaps = base.fetch_snapshots(account, "today")
    summary = base.summarize(snaps, "campaign")
    campaigns = [
        {
            "name": s.get("entity_name"),
            "status": s.get("effective_status") or s.get("status"),
            "spend": round(s.get("spend", 0), 2),
            "results": round(s.get("results", 0), 2),
            "daily_budget": s.get("daily_budget"),
        }
        for s in snaps if s.get("level") == "campaign"
    ]
    open_alerts = db.count_open_by_account().get(_account_id(account), 0)
    return _ok({
        "account": account.get("client_name"),
        "monthly_budget": account.get("monthly_budget"),
        "target_cpa": account.get("target_cpa"),
        "target_roas": account.get("target_roas"),
        "today": summary,
        "campaigns": campaigns,
        "open_alerts": open_alerts,
    })


def _campaigns(inp, user) -> Tuple[str, bool]:
    account = _resolve(inp.get("account", ""), user)
    if not account:
        return _err("לא נמצא חשבון תואם. קרא ל-list_accounts לרשימה.")
    status_filter = (inp.get("status") or "all").lower()
    snaps = [s for s in base.fetch_snapshots(account, "today") if s.get("level") == "campaign"]
    out = []
    for s in snaps:
        eff = (s.get("effective_status") or s.get("status") or "").upper()
        is_active = eff == "ACTIVE"
        if status_filter == "active" and not is_active:
            continue
        if status_filter == "paused" and is_active:
            continue
        out.append({
            "name": s.get("entity_name"),
            "status": eff,
            "objective": s.get("objective"),
            "daily_budget": s.get("daily_budget"),
            "spend": round(s.get("spend", 0), 2),
            "results": round(s.get("results", 0), 2),
            "cpa": round(s.get("cost_per_result", 0), 2),
            "roas": round(s.get("roas", 0), 2),
        })
    return _ok({"account": account.get("client_name"), "count": len(out), "campaigns": out})


def _performance(inp, user) -> Tuple[str, bool]:
    account = _resolve(inp.get("account", ""), user)
    if not account:
        return _err("לא נמצא חשבון תואם. קרא ל-list_accounts לרשימה.")
    preset = inp.get("date_preset") or "last_7d"
    snaps = base.fetch_snapshots(account, preset)
    summary = base.summarize(snaps, "campaign")
    payload = {"account": account.get("client_name"), "date_preset": preset, "totals": summary}
    if inp.get("breakdown"):
        rows = sorted(
            [s for s in snaps if s.get("level") == "campaign"],
            key=lambda s: s.get("spend", 0), reverse=True,
        )[:15]
        payload["by_campaign"] = [
            {
                "name": s.get("entity_name"),
                "spend": round(s.get("spend", 0), 2),
                "results": round(s.get("results", 0), 2),
                "cpa": round(s.get("cost_per_result", 0), 2),
                "roas": round(s.get("roas", 0), 2),
                "ctr": round(s.get("ctr", 0), 2),
            }
            for s in rows
        ]
    return _ok(payload)


def _compare(inp, user) -> Tuple[str, bool]:
    account = _resolve(inp.get("account", ""), user)
    if not account:
        return _err("לא נמצא חשבון תואם. קרא ל-list_accounts לרשימה.")
    pa, pb = inp.get("period_a"), inp.get("period_b")
    a = base.summarize(base.fetch_snapshots(account, pa), "campaign")
    b = base.summarize(base.fetch_snapshots(account, pb), "campaign")

    def delta(cur, prev):
        if not prev:
            return None
        return round((cur - prev) / prev * 100, 1)

    changes = {
        k: {"a": a.get(k), "b": b.get(k), "change_pct": delta(a.get(k, 0), b.get(k, 0))}
        for k in ("spend", "results", "cpa", "roas", "ctr", "cpm")
    }
    return _ok({
        "account": account.get("client_name"),
        "period_a": pa, "period_b": pb, "comparison": changes,
    })


def _alerts(inp, user) -> Tuple[str, bool]:
    account = None
    if inp.get("account"):
        account = _resolve(inp["account"], user)
        if not account:
            return _err("לא נמצא חשבון תואם. קרא ל-list_accounts לרשימה.")
    account_id = _account_id(account) if account else None
    alerts = db.list_alerts(account_id, status="open")
    out = [
        {
            "severity": a.get("severity"),
            "title": a.get("title"),
            "explanation": a.get("explanation"),
            "recommended_next_step": a.get("recommended_next_step"),
            "metric_value": a.get("metric_value"),
            "benchmark_or_target": a.get("benchmark_or_target"),
            "campaign": a.get("campaign_name"),
        }
        for a in alerts
    ]
    return _ok({"count": len(out), "alerts": out})
