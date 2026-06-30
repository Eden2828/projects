"""QA rules engine.

Pure, deterministic issue detection. Given a client, the entity snapshots pulled
from Meta, the effective thresholds, and a small ``RuleContext`` (for trend rules
that need history), it returns a list of structured ``Finding`` dicts.

This module performs NO I/O and NO Meta calls - it only analyzes data already
fetched, which keeps it fast, testable, and side-effect free.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

# Severity levels, highest first.
CRITICAL = "CRITICAL"
HIGH = "HIGH"
MEDIUM = "MEDIUM"
LOW = "LOW"
INFO = "INFO"

SEVERITY_ORDER = {CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4}

# Effective-status values that indicate a real delivery problem.
DELIVERY_BLOCKED_STATUSES = {
    "DISAPPROVED",
    "WITH_ISSUES",
    "AD_REVIEW_DISAPPROVED",
    "REJECTED",
    "PENDING_REVIEW",
    "PENDING_BILLING_INFO",
    "CAMPAIGN_PAUSED",
    "ADSET_PAUSED",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class RuleContext:
    """Side data the engine needs that isn't on the snapshot itself."""

    # Callable(entity_id) -> previous snapshot dict or None. Used by trend rules.
    get_previous: Callable[[str], Optional[Dict[str, Any]]] = lambda _eid: None
    # Month-to-date spend for the client (for the budget-cap rule).
    month_to_date_spend: float = 0.0
    # Account-average CPM computed across the account's ad snapshots.
    account_avg_cpm: float = 0.0
    now: datetime = field(default_factory=_now)


def evaluate_client(
    client: Dict[str, Any],
    snapshots: List[Dict[str, Any]],
    rules: Dict[str, Any],
    context: Optional[RuleContext] = None,
) -> List[Dict[str, Any]]:
    """Run every QA rule for one client and return a flat list of findings."""
    ctx = context or RuleContext()
    findings: List[Dict[str, Any]] = []

    # Precompute account-average CPM from ad-level snapshots if not provided.
    if not ctx.account_avg_cpm:
        ctx.account_avg_cpm = _account_avg_cpm(snapshots, rules)

    for snap in snapshots:
        level = snap.get("level")
        # Account/campaign/adset/ad level rules dispatch by level.
        if level == "campaign":
            findings.extend(_campaign_rules(client, snap, rules, ctx))
        if level in {"campaign", "adset", "ad"}:
            findings.extend(_common_performance_rules(client, snap, rules, ctx))
        if level in {"adset", "ad"}:
            findings.extend(_delivery_rules(client, snap, rules, ctx))

    # Client-level rule: monthly budget cap.
    budget_finding = _budget_cap_rule(client, rules, ctx)
    if budget_finding:
        findings.append(budget_finding)

    return findings


# -----------------------------------------------------------------------------
# Finding builder
# -----------------------------------------------------------------------------
def _finding(
    client: Dict[str, Any],
    snap: Optional[Dict[str, Any]],
    *,
    issue_type: str,
    severity: str,
    metric_value: Any,
    benchmark_or_target: Any,
    explanation: str,
    recommended_next_step: str,
    level: Optional[str] = None,
) -> Dict[str, Any]:
    """Construct a fully-populated finding dict (matches qa_findings schema)."""
    snap = snap or {}
    return {
        "client_id": client.get("client_id"),
        "client_name": client.get("client_name"),
        "ad_account_id": client.get("ad_account_id"),
        "level": level or snap.get("level") or "account",
        "campaign_name": snap.get("campaign_name") or snap.get("entity_name"),
        "adset_name": snap.get("adset_name"),
        "ad_name": snap.get("ad_name"),
        "issue_type": issue_type,
        "severity": severity,
        "metric_value": _fmt(metric_value),
        "benchmark_or_target": _fmt(benchmark_or_target),
        "explanation": explanation,
        "recommended_next_step": recommended_next_step,
        "detected_at": _now().isoformat(),
    }


def _fmt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, float):
        return f"{value:,.2f}"
    return str(value)


def _is_active(snap: Dict[str, Any]) -> bool:
    eff = (snap.get("effective_status") or "").upper()
    status = (snap.get("status") or "").upper()
    return eff == "ACTIVE" or (eff == "" and status == "ACTIVE")


def _account_avg_cpm(snapshots: List[Dict[str, Any]], rules: Dict[str, Any]) -> float:
    """Impression-weighted average CPM across ad-level snapshots with delivery."""
    min_impr = rules.get("cpm_min_impressions", 1000)
    total_spend = 0.0
    total_impr = 0
    for s in snapshots:
        if s.get("level") != "ad":
            continue
        impr = int(s.get("impressions") or 0)
        if impr < min_impr:
            continue
        total_spend += float(s.get("spend") or 0)
        total_impr += impr
    if total_impr <= 0:
        return 0.0
    return (total_spend / total_impr) * 1000.0


# -----------------------------------------------------------------------------
# Campaign-level rules
# -----------------------------------------------------------------------------
def _campaign_rules(
    client: Dict[str, Any],
    snap: Dict[str, Any],
    rules: Dict[str, Any],
    ctx: RuleContext,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    spend = float(snap.get("spend") or 0)
    floor = rules.get("zero_spend_floor", 0.5)

    # Rule: Active campaign with ~0 spend (no delivery so far today).
    if _is_active(snap) and spend <= floor and int(snap.get("impressions") or 0) == 0:
        hours = rules.get("zero_spend_active_hours", 6)
        out.append(
            _finding(
                client, snap,
                issue_type="active_campaign_zero_spend",
                severity=HIGH,
                metric_value=spend,
                benchmark_or_target=f"> {floor}",
                explanation=(
                    f"Campaign '{snap.get('entity_name')}' is ACTIVE but has spent "
                    f"{spend:.2f} with 0 impressions so far in the current period. "
                    f"Active campaigns with no delivery for {hours}+ hours usually "
                    "indicate a budget, schedule, audience, or approval problem."
                ),
                recommended_next_step=(
                    "Manually review the campaign's delivery status, budget, schedule, "
                    "and audience size in Ads Manager to find why it isn't spending."
                ),
            )
        )

    # Rule: Sudden spend drop vs previous snapshot.
    prev = ctx.get_previous(snap.get("entity_id"))
    if prev:
        prev_spend = float(prev.get("spend") or 0)
        drop_pct = rules.get("spend_drop_percent", 0.6)
        if prev_spend > 0 and spend < prev_spend * (1 - drop_pct):
            actual_drop = 1 - (spend / prev_spend) if prev_spend else 0
            out.append(
                _finding(
                    client, snap,
                    issue_type="sudden_spend_drop",
                    severity=MEDIUM,
                    metric_value=spend,
                    benchmark_or_target=f"prev {prev_spend:.2f}",
                    explanation=(
                        f"Spend dropped {actual_drop*100:.0f}% (from {prev_spend:.2f} to "
                        f"{spend:.2f}) versus the previous snapshot."
                    ),
                    recommended_next_step=(
                        "Check for budget exhaustion, schedule end, increased competition, "
                        "or paused adsets in Ads Manager."
                    ),
                )
            )

        # Rule: Sudden CPA increase vs previous snapshot.
        cpr = float(snap.get("cost_per_result") or 0)
        prev_cpr = float(prev.get("cost_per_result") or 0)
        inc_pct = rules.get("cpa_increase_percent", 0.5)
        if prev_cpr > 0 and cpr > prev_cpr * (1 + inc_pct):
            actual_inc = (cpr / prev_cpr) - 1
            out.append(
                _finding(
                    client, snap,
                    issue_type="sudden_cpa_increase",
                    severity=HIGH,
                    metric_value=cpr,
                    benchmark_or_target=f"prev {prev_cpr:.2f}",
                    explanation=(
                        f"Cost per result rose {actual_inc*100:.0f}% (from {prev_cpr:.2f} "
                        f"to {cpr:.2f}) versus the previous snapshot."
                    ),
                    recommended_next_step=(
                        "Review recent creative/audience/bid changes and check whether "
                        "conversion volume fell while spend held steady."
                    ),
                )
            )

        # Rule: Campaign/adset/ad turned off unexpectedly (active -> paused).
        if _is_active(prev) and not _is_active(snap):
            out.append(
                _finding(
                    client, snap,
                    issue_type="entity_turned_off",
                    severity=MEDIUM,
                    metric_value=snap.get("effective_status"),
                    benchmark_or_target="ACTIVE",
                    explanation=(
                        f"Campaign '{snap.get('entity_name')}' was ACTIVE in the previous "
                        f"snapshot but is now '{snap.get('effective_status') or snap.get('status')}'. "
                        "Confirm this pause was intentional."
                    ),
                    recommended_next_step=(
                        "Verify with the team whether this campaign was paused on purpose; "
                        "re-enable if it was switched off by mistake."
                    ),
                )
            )
    return out


# -----------------------------------------------------------------------------
# Performance rules common to campaign / adset / ad
# -----------------------------------------------------------------------------
def _common_performance_rules(
    client: Dict[str, Any],
    snap: Dict[str, Any],
    rules: Dict[str, Any],
    ctx: RuleContext,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    spend = float(snap.get("spend") or 0)
    results = float(snap.get("results") or 0)
    clicks = int(snap.get("clicks") or 0)
    impressions = int(snap.get("impressions") or 0)
    ctr = float(snap.get("ctr") or 0)
    cpm = float(snap.get("cpm") or 0)
    frequency = float(snap.get("frequency") or 0)
    cpr = float(snap.get("cost_per_result") or 0)
    roas = float(snap.get("roas") or 0)
    target_cpa = float(client.get("target_cpa") or 0)
    target_roas = float(client.get("target_roas") or 0)

    only_active = _is_active(snap)

    # Rule: Active entity with spend but 0 results.
    if (
        only_active
        and spend >= rules.get("spend_no_results_min_spend", 20.0)
        and results == 0
    ):
        out.append(
            _finding(
                client, snap,
                issue_type="spend_without_results",
                severity=HIGH,
                metric_value=f"spend {spend:.2f}, results 0",
                benchmark_or_target="> 0 results",
                explanation=(
                    f"This {snap.get('level')} spent {spend:.2f} but recorded 0 results. "
                    "Budget is being consumed with no measurable outcome."
                ),
                recommended_next_step=(
                    "Check conversion tracking/pixel setup, offer relevance, and targeting; "
                    "consider whether the optimization event is firing."
                ),
            )
        )

    # Rule: Tracking issue suspected - clicks exist but no results.
    min_clicks = rules.get("tracking_clicks_without_results_min_clicks", 50)
    if only_active and clicks >= min_clicks and results == 0 and spend > 0:
        out.append(
            _finding(
                client, snap,
                issue_type="suspected_tracking_issue",
                severity=HIGH,
                metric_value=f"{clicks} clicks, 0 results",
                benchmark_or_target=f">= {min_clicks} clicks",
                explanation=(
                    f"{clicks} clicks were recorded but 0 conversion events came back. "
                    "When meaningful click volume produces no events, tracking is the prime suspect."
                ),
                recommended_next_step=(
                    "Verify the Meta Pixel / Conversions API events fire and deduplicate, "
                    "check the landing page loads, and confirm the optimization event is mapped."
                ),
            )
        )

    # Rule: CPA above 2x target.
    if target_cpa > 0 and results > 0:
        mult = rules.get("cpa_over_target_multiplier", 2.0)
        if cpr > target_cpa * mult:
            out.append(
                _finding(
                    client, snap,
                    issue_type="cpa_above_target",
                    severity=HIGH,
                    metric_value=cpr,
                    benchmark_or_target=f"target {target_cpa:.2f} (x{mult})",
                    explanation=(
                        f"Cost per result {cpr:.2f} exceeds {mult:g}x the target CPA "
                        f"of {target_cpa:.2f}."
                    ),
                    recommended_next_step=(
                        "Pause or rework the worst-performing adsets/ads and reallocate "
                        "budget toward segments that hit the target CPA."
                    ),
                )
            )

    # Rule: ROAS below target.
    if target_roas > 0 and spend >= rules.get("roas_min_spend", 50.0) and roas > 0:
        ratio = rules.get("roas_below_target_ratio", 1.0)
        if roas < target_roas * ratio:
            out.append(
                _finding(
                    client, snap,
                    issue_type="roas_below_target",
                    severity=HIGH,
                    metric_value=roas,
                    benchmark_or_target=f"target {target_roas:.2f}",
                    explanation=(
                        f"ROAS {roas:.2f} is below the target of {target_roas:.2f} "
                        f"on {spend:.2f} spend."
                    ),
                    recommended_next_step=(
                        "Review product/offer profitability, audience quality, and bidding; "
                        "shift budget to higher-ROAS campaigns."
                    ),
                )
            )

    # Rule: Frequency above threshold.
    freq_threshold = rules.get("frequency_threshold", 3.0)
    if only_active and frequency > freq_threshold:
        out.append(
            _finding(
                client, snap,
                issue_type="high_frequency",
                severity=MEDIUM,
                metric_value=frequency,
                benchmark_or_target=f"<= {freq_threshold}",
                explanation=(
                    f"Frequency {frequency:.2f} exceeds {freq_threshold}. High frequency "
                    "leads to ad fatigue, falling CTR, and rising CPMs."
                ),
                recommended_next_step=(
                    "Refresh creative, expand the audience, or add frequency caps to reduce "
                    "repeated exposure to the same users."
                ),
            )
        )

    # Rule: CTR below floor.
    if (
        only_active
        and impressions >= rules.get("ctr_min_impressions", 1000)
        and ctr < rules.get("ctr_floor_percent", 0.7)
    ):
        out.append(
            _finding(
                client, snap,
                issue_type="low_ctr",
                severity=MEDIUM,
                metric_value=f"{ctr:.2f}%",
                benchmark_or_target=f">= {rules.get('ctr_floor_percent', 0.7)}%",
                explanation=(
                    f"CTR {ctr:.2f}% is below the floor of {rules.get('ctr_floor_percent', 0.7)}% "
                    f"over {impressions:,} impressions, signalling weak creative/audience fit."
                ),
                recommended_next_step=(
                    "Test new creative angles and hooks, and tighten targeting to a more "
                    "relevant audience."
                ),
            )
        )

    # Rule: CPM unusually high vs account average.
    if (
        only_active
        and ctx.account_avg_cpm > 0
        and impressions >= rules.get("cpm_min_impressions", 1000)
    ):
        mult = rules.get("cpm_high_multiplier", 1.75)
        if cpm > ctx.account_avg_cpm * mult:
            out.append(
                _finding(
                    client, snap,
                    issue_type="cpm_above_account_average",
                    severity=LOW,
                    metric_value=cpm,
                    benchmark_or_target=f"acct avg {ctx.account_avg_cpm:.2f} (x{mult})",
                    explanation=(
                        f"CPM {cpm:.2f} is more than {mult:g}x the account average of "
                        f"{ctx.account_avg_cpm:.2f}, indicating expensive delivery."
                    ),
                    recommended_next_step=(
                        "Check audience overlap/saturation and creative quality ranking; "
                        "broaden the audience or refresh creative to lower CPM."
                    ),
                )
            )

    return out


# -----------------------------------------------------------------------------
# Delivery / status rules (adset + ad)
# -----------------------------------------------------------------------------
def _delivery_rules(
    client: Dict[str, Any],
    snap: Dict[str, Any],
    rules: Dict[str, Any],
    ctx: RuleContext,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    eff = (snap.get("effective_status") or "").upper()
    review = snap.get("review_status")

    # Rule: Ad rejected or limited delivery.
    if eff in DELIVERY_BLOCKED_STATUSES or review:
        severity = CRITICAL if eff in {"DISAPPROVED", "REJECTED", "AD_REVIEW_DISAPPROVED"} else HIGH
        out.append(
            _finding(
                client, snap,
                issue_type="ad_rejected_or_limited",
                severity=severity,
                metric_value=review or eff,
                benchmark_or_target="ACTIVE / approved",
                explanation=(
                    f"This {snap.get('level')} has delivery status '{eff or 'unknown'}'"
                    + (f" with review feedback: {review}" if review else "")
                    + ". Rejected or limited ads do not deliver normally."
                ),
                recommended_next_step=(
                    "Review the policy reason in Ads Manager, fix or replace the creative/landing "
                    "page, and request another review if appropriate."
                ),
            )
        )

    # Rule: Learning limited (if surfaced via effective_status).
    if "LEARNING_LIMITED" in eff:
        out.append(
            _finding(
                client, snap,
                issue_type="learning_limited",
                severity=MEDIUM,
                metric_value=eff,
                benchmark_or_target="exit learning",
                explanation=(
                    f"This {snap.get('level')} is in 'Learning Limited'. It is unlikely to "
                    "gather enough optimization events to stabilize performance."
                ),
                recommended_next_step=(
                    "Consolidate adsets, broaden targeting, raise budget, or pick an earlier "
                    "funnel optimization event to escape Learning Limited."
                ),
            )
        )

    return out


# -----------------------------------------------------------------------------
# Client-level rules
# -----------------------------------------------------------------------------
def _budget_cap_rule(
    client: Dict[str, Any],
    rules: Dict[str, Any],
    ctx: RuleContext,
) -> Optional[Dict[str, Any]]:
    monthly_budget = float(client.get("monthly_budget") or 0)
    if monthly_budget <= 0 or ctx.month_to_date_spend <= 0:
        return None
    ratio = rules.get("budget_cap_warning_ratio", 0.85)
    used = ctx.month_to_date_spend / monthly_budget
    if used >= ratio:
        severity = CRITICAL if used >= 1.0 else HIGH
        return _finding(
            client, None,
            level="account",
            issue_type="near_monthly_budget_cap",
            severity=severity,
            metric_value=f"{ctx.month_to_date_spend:.2f} ({used*100:.0f}%)",
            benchmark_or_target=f"monthly {monthly_budget:.2f}",
            explanation=(
                f"Month-to-date spend is {ctx.month_to_date_spend:.2f}, which is "
                f"{used*100:.0f}% of the {monthly_budget:.2f} monthly budget."
            ),
            recommended_next_step=(
                "Confirm pacing with the client; decide whether to throttle spend for the "
                "rest of the month or approve additional budget."
            ),
        )
    return None
