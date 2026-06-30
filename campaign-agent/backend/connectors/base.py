"""Platform-agnostic data layer.

The agent and the alerts engine talk only to this module, never directly to a
platform SDK. Today it dispatches to Meta; adding Google Ads later means adding
a branch here + a ``connectors/google_ads.py`` — no changes to the agent.
"""

from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional, Tuple

from .. import config_store, settings
from .meta import MetaClient

_VALID_PRESETS = {
    "today", "yesterday", "last_3d", "last_7d", "last_14d", "last_28d",
    "last_30d", "this_week_mon_today", "this_month", "last_month",
}

# Short-TTL cache so several tools in one agent turn don't re-hit Meta for the
# same account+preset. TTL is small enough that scheduled scans (every N minutes)
# always see fresh data.
_CACHE_TTL_SECONDS = 120
_cache: Dict[Tuple[str, str, str], Tuple[float, Any]] = {}


def _cache_get(key: Tuple[str, str, str]) -> Optional[Any]:
    hit = _cache.get(key)
    if hit and (time.monotonic() - hit[0]) < _CACHE_TTL_SECONDS:
        return hit[1]
    return None


def _cache_put(key: Tuple[str, str, str], value: Any) -> None:
    _cache[key] = (time.monotonic(), value)


# ----------------------------------------------------------------------------
# Account registry (config/accounts.json)
# ----------------------------------------------------------------------------
def load_accounts() -> List[Dict[str, Any]]:
    return config_store.accounts()


def accounts_for_user(user: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Admins (and unknown users) see all accounts; campaigners see theirs."""
    accounts = load_accounts()
    if not user or user.get("role") == "admin":
        return accounts
    email = (user.get("email") or "").lower()
    mine = [a for a in accounts if (a.get("assigned_manager") or "").lower() == email]
    return mine or accounts  # fall back to all if nothing is assigned


def resolve_account(query: str, user: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Match an account by client_id, ad_account_id, or (fuzzy) name."""
    if not query:
        return None
    q = str(query).strip().lower()
    accounts = accounts_for_user(user)
    for a in accounts:
        if q in {str(a.get("client_id", "")).lower(), str(a.get("ad_account_id", "")).lower()}:
            return a
    for a in accounts:
        if q in (a.get("client_name") or "").lower():
            return a
    return None


# ----------------------------------------------------------------------------
# Data fetch (dispatch by platform)
# ----------------------------------------------------------------------------
def fetch_snapshots(account: Dict[str, Any], date_preset: str = "today") -> List[Dict[str, Any]]:
    if date_preset not in _VALID_PRESETS:
        date_preset = "today"
    aid = account.get("ad_account_id", "")
    key = ("snap", aid, date_preset)
    cached = _cache_get(key)
    if cached is not None:
        return cached
    platform = account.get("platform", "meta")
    if platform == "meta":
        data = MetaClient().fetch_account_entities(aid, date_preset=date_preset)
    else:
        raise ValueError(f"פלטפורמה לא נתמכת עדיין: {platform}")
    _cache_put(key, data)
    return data


def account_spend(account: Dict[str, Any], date_preset: str) -> float:
    aid = account.get("ad_account_id", "")
    key = ("spend", aid, date_preset)
    cached = _cache_get(key)
    if cached is not None:
        return cached
    platform = account.get("platform", "meta")
    value = MetaClient().account_spend(aid, date_preset) if platform == "meta" else 0.0
    _cache_put(key, value)
    return value


# ----------------------------------------------------------------------------
# Aggregation helpers (used by agent tools)
# ----------------------------------------------------------------------------
def summarize(snapshots: List[Dict[str, Any]], level: str = "campaign") -> Dict[str, Any]:
    rows = [s for s in snapshots if s.get("level") == level]
    spend = sum(s.get("spend", 0) or 0 for s in rows)
    impressions = sum(s.get("impressions", 0) or 0 for s in rows)
    clicks = sum(s.get("clicks", 0) or 0 for s in rows)
    results = sum(s.get("results", 0) or 0 for s in rows)
    revenue = sum(s.get("revenue", 0) or 0 for s in rows)
    reach = sum(s.get("reach", 0) or 0 for s in rows)
    active = [s for s in rows if (s.get("effective_status") or s.get("status") or "").upper() == "ACTIVE"]
    return {
        "level": level,
        "entities": len(rows),
        "active": len(active),
        "spend": round(spend, 2),
        "impressions": impressions,
        "clicks": clicks,
        "results": round(results, 2),
        "revenue": round(revenue, 2),
        "ctr": round((clicks / impressions * 100), 2) if impressions else 0,
        "cpc": round((spend / clicks), 2) if clicks else 0,
        "cpm": round((spend / impressions * 1000), 2) if impressions else 0,
        "cpa": round((spend / results), 2) if results else 0,
        "roas": round((revenue / spend), 2) if spend else 0,
    }
