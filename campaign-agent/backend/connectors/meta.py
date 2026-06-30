"""Read-only Meta Marketing API client.

SAFETY CONTRACT (enforced in code below):
  * GET requests only. The single low-level helper ``_get`` hard-codes the HTTP
    method to GET — there is no POST/PUT/DELETE path, so this client is
    structurally incapable of mutating Meta Ads.
  * Calls are rate-limited (client-side throttle) and retried with exponential
    backoff on transient failures.

Ported from the proven meta-ads-monitoring-agent client; reads config from
``backend.settings``.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional

import requests
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .. import config_store, settings

CAMPAIGN_FIELDS = "id,name,status,effective_status,objective,daily_budget,lifetime_budget"
ADSET_FIELDS = "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal"
AD_FIELDS = (
    "id,name,status,effective_status,adset_id,campaign_id,"
    "ad_review_feedback,configured_status"
)
INSIGHT_FIELDS = (
    "spend,impressions,clicks,ctr,cpc,cpm,frequency,reach,"
    "actions,action_values,cost_per_action_type,date_start,date_stop"
)

PURCHASE_ACTION_TYPES = {
    "purchase",
    "omni_purchase",
    "offsite_conversion.fb_pixel_purchase",
}
LEAD_ACTION_TYPES = {
    "lead",
    "leadgen.other",
    "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_lead",
}


class MetaApiError(Exception):
    """Non-retryable Meta API error (auth, permissions, bad request)."""


class MetaRateLimitError(Exception):
    """Meta signalled rate limiting; safe to retry with backoff."""


class MetaClient:
    """A minimal, read-only wrapper over the Meta Marketing Graph API."""

    def __init__(
        self,
        access_token: Optional[str] = None,
        base_url: Optional[str] = None,
        *,
        min_seconds_between_calls: Optional[float] = None,
        max_retries: Optional[int] = None,
        timeout: int = 60,
    ) -> None:
        self._token = access_token or config_store.meta_token()
        self._base_url = (base_url or settings.META_BASE_URL).rstrip("/")
        self._min_interval = (
            min_seconds_between_calls
            if min_seconds_between_calls is not None
            else settings.META_MIN_SECONDS_BETWEEN_CALLS
        )
        self._max_retries = max(1, max_retries if max_retries is not None else settings.META_MAX_RETRIES)
        self._timeout = timeout
        self._session = requests.Session()
        self._lock = threading.Lock()
        self._last_call_ts = 0.0

    # ------------------------------------------------------------------
    # Low-level HTTP (GET ONLY)
    # ------------------------------------------------------------------
    def _throttle(self) -> None:
        with self._lock:
            elapsed = time.monotonic() - self._last_call_ts
            wait = self._min_interval - elapsed
            if wait > 0:
                time.sleep(wait)
            self._last_call_ts = time.monotonic()

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        params = dict(params or {})
        url = path if path.startswith("http") else f"{self._base_url}/{path.lstrip('/')}"
        if "access_token" not in url:
            params["access_token"] = self._token

        @retry(
            retry=retry_if_exception_type((MetaRateLimitError, requests.ConnectionError, requests.Timeout)),
            wait=wait_exponential(multiplier=2, min=2, max=60),
            stop=stop_after_attempt(self._max_retries),
            reraise=True,
        )
        def _do_request() -> Dict[str, Any]:
            self._throttle()
            # NOTE: method is hard-coded to GET. Do not parameterize this.
            resp = self._session.get(url, params=params, timeout=self._timeout)
            if resp.status_code == 200:
                return resp.json()
            try:
                err = resp.json().get("error", {})
            except ValueError:
                err = {"message": resp.text[:500]}
            code = err.get("code")
            message = err.get("message", f"HTTP {resp.status_code}")
            if resp.status_code == 429 or code in {4, 17, 32, 613}:
                raise MetaRateLimitError(message)
            raise MetaApiError(f"Meta API error (code={code}, http={resp.status_code}): {message}")

        return _do_request()

    def _get_all_pages(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        *,
        max_pages: int = 25,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        payload = self._get(path, params)
        results.extend(payload.get("data", []))
        pages = 1
        next_url = payload.get("paging", {}).get("next")
        while next_url and pages < max_pages:
            payload = self._get(next_url)  # absolute & pre-signed
            results.extend(payload.get("data", []))
            next_url = payload.get("paging", {}).get("next")
            pages += 1
        return results

    # ------------------------------------------------------------------
    # Connectivity
    # ------------------------------------------------------------------
    def verify_token(self) -> Dict[str, Any]:
        return self._get("me", {"fields": "id,name"})

    @staticmethod
    def _norm_account(ad_account_id: str) -> str:
        return ad_account_id if ad_account_id.startswith("act_") else f"act_{ad_account_id}"

    # ------------------------------------------------------------------
    # High-level: pull a full account snapshot
    # ------------------------------------------------------------------
    def fetch_account_entities(
        self,
        ad_account_id: str,
        *,
        date_preset: str = "today",
    ) -> List[Dict[str, Any]]:
        account = self._norm_account(ad_account_id)
        entities: List[Dict[str, Any]] = []

        campaigns = self._get_all_pages(f"{account}/campaigns", {"fields": CAMPAIGN_FIELDS, "limit": 200})
        campaign_index = {c["id"]: c for c in campaigns}
        adsets = self._get_all_pages(f"{account}/adsets", {"fields": ADSET_FIELDS, "limit": 200})
        adset_index = {a["id"]: a for a in adsets}
        ads = self._get_all_pages(f"{account}/ads", {"fields": AD_FIELDS, "limit": 500})

        campaign_insights = self._fetch_insights_map(account, "campaign", date_preset)
        adset_insights = self._fetch_insights_map(account, "adset", date_preset)
        ad_insights = self._fetch_insights_map(account, "ad", date_preset)

        for camp in campaigns:
            entities.append(self._build_snapshot(
                level="campaign", obj=camp,
                insight=campaign_insights.get(camp["id"], {}), campaign=camp))
        for adset in adsets:
            camp = campaign_index.get(adset.get("campaign_id"), {})
            entities.append(self._build_snapshot(
                level="adset", obj=adset,
                insight=adset_insights.get(adset["id"], {}), campaign=camp, adset=adset))
        for ad in ads:
            adset = adset_index.get(ad.get("adset_id"), {})
            camp = campaign_index.get(ad.get("campaign_id"), {})
            entities.append(self._build_snapshot(
                level="ad", obj=ad,
                insight=ad_insights.get(ad["id"], {}), campaign=camp, adset=adset, ad=ad))
        return entities

    def account_spend(self, ad_account_id: str, date_preset: str) -> float:
        """Sum campaign-level spend for a preset (used for month-to-date budget)."""
        account = self._norm_account(ad_account_id)
        rows = self._get_all_pages(
            f"{account}/insights",
            {"level": "campaign", "fields": "spend", "date_preset": date_preset, "limit": 500},
        )
        return sum(self._to_float(r.get("spend")) for r in rows)

    def _fetch_insights_map(self, account: str, level: str, date_preset: str) -> Dict[str, Dict[str, Any]]:
        rows = self._get_all_pages(
            f"{account}/insights",
            {"level": level, "fields": INSIGHT_FIELDS, "date_preset": date_preset, "limit": 500},
        )
        key = f"{level}_id"
        index: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            obj_id = row.get(key)
            if obj_id:
                index[obj_id] = row
        return index

    # ------------------------------------------------------------------
    # Normalization
    # ------------------------------------------------------------------
    @staticmethod
    def _sum_actions(actions: Optional[List[Dict[str, Any]]], wanted: set) -> float:
        if not actions:
            return 0.0
        total = 0.0
        for a in actions:
            if a.get("action_type") in wanted:
                try:
                    total += float(a.get("value", 0))
                except (TypeError, ValueError):
                    pass
        return total

    @staticmethod
    def _to_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _to_int(value: Any, default: int = 0) -> int:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return default

    def _build_snapshot(
        self,
        *,
        level: str,
        obj: Dict[str, Any],
        insight: Dict[str, Any],
        campaign: Optional[Dict[str, Any]] = None,
        adset: Optional[Dict[str, Any]] = None,
        ad: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        campaign = campaign or {}
        adset = adset or {}
        ad = ad or {}

        actions = insight.get("actions")
        action_values = insight.get("action_values")
        purchases = self._sum_actions(actions, PURCHASE_ACTION_TYPES)
        leads = self._sum_actions(actions, LEAD_ACTION_TYPES)
        revenue = self._sum_actions(action_values, PURCHASE_ACTION_TYPES)

        spend = self._to_float(insight.get("spend"))
        impressions = self._to_int(insight.get("impressions"))
        clicks = self._to_int(insight.get("clicks"))
        results = purchases + leads
        roas = (revenue / spend) if spend > 0 and revenue > 0 else 0.0
        cost_per_result = (spend / results) if results > 0 else 0.0

        review_status = None
        feedback = ad.get("ad_review_feedback")
        if isinstance(feedback, dict):
            negative = feedback.get("negative") or {}
            if negative:
                review_status = "; ".join(str(v) for v in negative.values())[:300]

        return {
            "level": level,
            "entity_id": obj.get("id"),
            "entity_name": obj.get("name"),
            "campaign_id": campaign.get("id") or obj.get("campaign_id"),
            "campaign_name": campaign.get("name"),
            "adset_id": adset.get("id") or obj.get("adset_id"),
            "adset_name": adset.get("name"),
            "ad_id": ad.get("id") if level == "ad" else None,
            "ad_name": ad.get("name") if level == "ad" else None,
            "status": obj.get("status") or obj.get("configured_status"),
            "effective_status": obj.get("effective_status"),
            "review_status": review_status,
            "objective": campaign.get("objective"),
            "daily_budget": self._to_float(obj.get("daily_budget")) / 100 if obj.get("daily_budget") else None,
            "lifetime_budget": self._to_float(obj.get("lifetime_budget")) / 100 if obj.get("lifetime_budget") else None,
            "date_start": insight.get("date_start"),
            "date_stop": insight.get("date_stop"),
            "spend": spend,
            "impressions": impressions,
            "clicks": clicks,
            "ctr": self._to_float(insight.get("ctr")),
            "cpc": self._to_float(insight.get("cpc")),
            "cpm": self._to_float(insight.get("cpm")),
            "frequency": self._to_float(insight.get("frequency")),
            "reach": self._to_int(insight.get("reach")),
            "results": results,
            "cost_per_result": cost_per_result,
            "purchases": purchases,
            "leads": leads,
            "revenue": revenue,
            "roas": roas,
        }
