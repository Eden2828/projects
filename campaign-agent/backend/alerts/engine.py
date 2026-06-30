"""QA rules engine — pure, deterministic issue detection.

Given an account config, the entity snapshots, effective thresholds, and a small
``RuleContext`` (for trend rules that need history), it returns a list of
structured finding dicts. NO I/O, NO API calls — only analysis of data already
fetched. Ported from meta-ads-monitoring-agent's qa_rules_engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

CRITICAL = "CRITICAL"
HIGH = "HIGH"
MEDIUM = "MEDIUM"
LOW = "LOW"
INFO = "INFO"

SEVERITY_ORDER = {CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4}

DELIVERY_BLOCKED_STATUSES = {
    "DISAPPROVED", "WITH_ISSUES", "AD_REVIEW_DISAPPROVED", "REJECTED",
    "PENDING_REVIEW", "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ADSET_PAUSED",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class RuleContext:
    get_previous: Callable[[str], Optional[Dict[str, Any]]] = lambda _eid: None
    month_to_date_spend: float = 0.0
    account_avg_cpm: float = 0.0
    now: datetime = field(default_factory=_now)


def merge_rules(rules: Dict[str, Any], client_id: Optional[str]) -> Dict[str, Any]:
    """Base rules with per-client overrides applied."""
    merged = {k: v for k, v in rules.items() if k != "client_overrides"}
    overrides = (rules.get("client_overrides") or {}).get(client_id or "", {})
    merged.update(overrides)
    return merged


def evaluate_client(
    client: Dict[str, Any],
    snapshots: List[Dict[str, Any]],
    rules: Dict[str, Any],
    context: Optional[RuleContext] = None,
) -> List[Dict[str, Any]]:
    ctx = context or RuleContext()
    findings: List[Dict[str, Any]] = []
    if not ctx.account_avg_cpm:
        ctx.account_avg_cpm = _account_avg_cpm(snapshots, rules)

    for snap in snapshots:
        level = snap.get("level")
        if level == "campaign":
            findings.extend(_campaign_rules(client, snap, rules, ctx))
        if level in {"campaign", "adset", "ad"}:
            findings.extend(_common_performance_rules(client, snap, rules, ctx))
        if level in {"adset", "ad"}:
            findings.extend(_delivery_rules(client, snap, rules, ctx))

    budget_finding = _budget_cap_rule(client, rules, ctx)
    if budget_finding:
        findings.append(budget_finding)
    return findings


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
def _campaign_rules(client, snap, rules, ctx) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    spend = float(snap.get("spend") or 0)
    floor = rules.get("zero_spend_floor", 0.5)

    if _is_active(snap) and spend <= floor and int(snap.get("impressions") or 0) == 0:
        hours = rules.get("zero_spend_active_hours", 6)
        out.append(_finding(
            client, snap, issue_type="active_campaign_zero_spend", severity=HIGH,
            metric_value=spend, benchmark_or_target=f"> {floor}",
            explanation=(
                f"הקמפיין '{snap.get('entity_name')}' פעיל אך הוציא {spend:.2f} עם 0 חשיפות "
                f"בטווח הנוכחי. קמפיין פעיל ללא תפוצה {hours}+ שעות בד\"כ מצביע על בעיית "
                "תקציב, תזמון, קהל או אישור."),
            recommended_next_step=(
                "בדוק ידנית ב-Ads Manager את סטטוס התפוצה, התקציב, התזמון וגודל הקהל כדי "
                "להבין למה אין הוצאה.")))

    prev = ctx.get_previous(snap.get("entity_id"))
    if prev:
        prev_spend = float(prev.get("spend") or 0)
        drop_pct = rules.get("spend_drop_percent", 0.6)
        if prev_spend > 0 and spend < prev_spend * (1 - drop_pct):
            actual_drop = 1 - (spend / prev_spend) if prev_spend else 0
            out.append(_finding(
                client, snap, issue_type="sudden_spend_drop", severity=MEDIUM,
                metric_value=spend, benchmark_or_target=f"קודם {prev_spend:.2f}",
                explanation=(
                    f"ההוצאה ירדה ב-{actual_drop*100:.0f}% (מ-{prev_spend:.2f} ל-{spend:.2f}) "
                    "לעומת הסריקה הקודמת."),
                recommended_next_step=(
                    "בדוק מיצוי תקציב, סיום תזמון, עלייה בתחרות או adsets שכובו ב-Ads Manager.")))

        cpr = float(snap.get("cost_per_result") or 0)
        prev_cpr = float(prev.get("cost_per_result") or 0)
        inc_pct = rules.get("cpa_increase_percent", 0.5)
        if prev_cpr > 0 and cpr > prev_cpr * (1 + inc_pct):
            actual_inc = (cpr / prev_cpr) - 1
            out.append(_finding(
                client, snap, issue_type="sudden_cpa_increase", severity=HIGH,
                metric_value=cpr, benchmark_or_target=f"קודם {prev_cpr:.2f}",
                explanation=(
                    f"העלות לתוצאה עלתה ב-{actual_inc*100:.0f}% (מ-{prev_cpr:.2f} ל-{cpr:.2f}) "
                    "לעומת הסריקה הקודמת."),
                recommended_next_step=(
                    "בדוק שינויים אחרונים בקריאייטיב/קהל/הצעת מחיר, ובדוק אם נפח ההמרות ירד "
                    "בעוד ההוצאה נשארה יציבה.")))

        if _is_active(prev) and not _is_active(snap):
            out.append(_finding(
                client, snap, issue_type="entity_turned_off", severity=MEDIUM,
                metric_value=snap.get("effective_status"), benchmark_or_target="ACTIVE",
                explanation=(
                    f"הקמפיין '{snap.get('entity_name')}' היה פעיל בסריקה הקודמת אך כעת "
                    f"'{snap.get('effective_status') or snap.get('status')}'. ודא שהכיבוי היה מכוון."),
                recommended_next_step=(
                    "בדוק עם הצוות אם הקמפיין כובה בכוונה; הפעל מחדש אם כובה בטעות.")))
    return out


def _common_performance_rules(client, snap, rules, ctx) -> List[Dict[str, Any]]:
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

    if only_active and spend >= rules.get("spend_no_results_min_spend", 20.0) and results == 0:
        out.append(_finding(
            client, snap, issue_type="spend_without_results", severity=HIGH,
            metric_value=f"הוצאה {spend:.2f}, תוצאות 0", benchmark_or_target="> 0 תוצאות",
            explanation=(
                f"ה-{snap.get('level')} הזה הוציא {spend:.2f} אך רשם 0 תוצאות. התקציב נצרך "
                "ללא תוצאה מדידה."),
            recommended_next_step=(
                "בדוק את הגדרת ה-pixel/מעקב ההמרות, רלוונטיות ההצעה והטרגוט; בדוק אם אירוע "
                "האופטימיזציה נורה.")))

    min_clicks = rules.get("tracking_clicks_without_results_min_clicks", 50)
    if only_active and clicks >= min_clicks and results == 0 and spend > 0:
        out.append(_finding(
            client, snap, issue_type="suspected_tracking_issue", severity=HIGH,
            metric_value=f"{clicks} קליקים, 0 תוצאות", benchmark_or_target=f">= {min_clicks} קליקים",
            explanation=(
                f"נרשמו {clicks} קליקים אך 0 אירועי המרה. כשנפח קליקים משמעותי לא מייצר "
                "אירועים — המעקב הוא החשוד המיידי."),
            recommended_next_step=(
                "ודא ש-Meta Pixel / Conversions API יורים ומבצעים דה-דופליקציה, בדוק שעמוד "
                "הנחיתה נטען, וודא שאירוע האופטימיזציה ממופה.")))

    if target_cpa > 0 and results > 0:
        mult = rules.get("cpa_over_target_multiplier", 2.0)
        if cpr > target_cpa * mult:
            out.append(_finding(
                client, snap, issue_type="cpa_above_target", severity=HIGH,
                metric_value=cpr, benchmark_or_target=f"יעד {target_cpa:.2f} (x{mult})",
                explanation=(
                    f"העלות לתוצאה {cpr:.2f} חורגת מפי {mult:g} מיעד ה-CPA של {target_cpa:.2f}."),
                recommended_next_step=(
                    "השהה או שפר את ה-adsets/מודעות החלשים ביותר והסט תקציב לכיוון מקטעים "
                    "שעומדים ביעד ה-CPA.")))

    if target_roas > 0 and spend >= rules.get("roas_min_spend", 50.0) and roas > 0:
        ratio = rules.get("roas_below_target_ratio", 1.0)
        if roas < target_roas * ratio:
            out.append(_finding(
                client, snap, issue_type="roas_below_target", severity=HIGH,
                metric_value=roas, benchmark_or_target=f"יעד {target_roas:.2f}",
                explanation=(
                    f"ROAS {roas:.2f} מתחת ליעד של {target_roas:.2f} על הוצאה של {spend:.2f}."),
                recommended_next_step=(
                    "בדוק רווחיות מוצר/הצעה, איכות קהל ותמחור; הסט תקציב לקמפיינים עם ROAS גבוה יותר.")))

    freq_threshold = rules.get("frequency_threshold", 3.0)
    if only_active and frequency > freq_threshold:
        out.append(_finding(
            client, snap, issue_type="high_frequency", severity=MEDIUM,
            metric_value=frequency, benchmark_or_target=f"<= {freq_threshold}",
            explanation=(
                f"תדירות {frequency:.2f} חורגת מ-{freq_threshold}. תדירות גבוהה מובילה לשחיקת "
                "קריאייטיב, ירידת CTR ועליית CPM."),
            recommended_next_step=(
                "רענן קריאייטיב, הרחב את הקהל, או הוסף frequency cap כדי להפחית חשיפה חוזרת.")))

    if only_active and impressions >= rules.get("ctr_min_impressions", 1000) and ctr < rules.get("ctr_floor_percent", 0.7):
        floor = rules.get("ctr_floor_percent", 0.7)
        out.append(_finding(
            client, snap, issue_type="low_ctr", severity=MEDIUM,
            metric_value=f"{ctr:.2f}%", benchmark_or_target=f">= {floor}%",
            explanation=(
                f"CTR {ctr:.2f}% מתחת לרצפה של {floor}% על פני {impressions:,} חשיפות — "
                "סימן להתאמה חלשה של קריאייטיב/קהל."),
            recommended_next_step=(
                "בדוק זוויות וקריאייטיבים חדשים, והדק את הטרגוט לקהל רלוונטי יותר.")))

    if only_active and ctx.account_avg_cpm > 0 and impressions >= rules.get("cpm_min_impressions", 1000):
        mult = rules.get("cpm_high_multiplier", 1.75)
        if cpm > ctx.account_avg_cpm * mult:
            out.append(_finding(
                client, snap, issue_type="cpm_above_account_average", severity=LOW,
                metric_value=cpm, benchmark_or_target=f"ממוצע חשבון {ctx.account_avg_cpm:.2f} (x{mult})",
                explanation=(
                    f"CPM {cpm:.2f} גבוה מפי {mult:g} מממוצע החשבון ({ctx.account_avg_cpm:.2f}) — "
                    "תפוצה יקרה."),
                recommended_next_step=(
                    "בדוק חפיפת/רוויית קהל ודירוג איכות קריאייטיב; הרחב קהל או רענן קריאייטיב "
                    "כדי להוריד CPM.")))
    return out


def _delivery_rules(client, snap, rules, ctx) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    eff = (snap.get("effective_status") or "").upper()
    review = snap.get("review_status")

    if eff in DELIVERY_BLOCKED_STATUSES or review:
        severity = CRITICAL if eff in {"DISAPPROVED", "REJECTED", "AD_REVIEW_DISAPPROVED"} else HIGH
        out.append(_finding(
            client, snap, issue_type="ad_rejected_or_limited", severity=severity,
            metric_value=review or eff, benchmark_or_target="פעיל / מאושר",
            explanation=(
                f"ל-{snap.get('level')} סטטוס תפוצה '{eff or 'לא ידוע'}'"
                + (f" עם משוב ביקורת: {review}" if review else "")
                + ". מודעות שנדחו או מוגבלות לא מתפקדות כרגיל."),
            recommended_next_step=(
                "בדוק את סיבת המדיניות ב-Ads Manager, תקן או החלף את הקריאייטיב/עמוד הנחיתה, "
                "ובקש ביקורת חוזרת אם רלוונטי.")))

    if "LEARNING_LIMITED" in eff:
        out.append(_finding(
            client, snap, issue_type="learning_limited", severity=MEDIUM,
            metric_value=eff, benchmark_or_target="יציאה מ-Learning",
            explanation=(
                f"ה-{snap.get('level')} במצב 'Learning Limited'. לא סביר שיאסוף מספיק אירועי "
                "אופטימיזציה כדי לייצב ביצועים."),
            recommended_next_step=(
                "אחד adsets, הרחב טרגוט, העלה תקציב, או בחר אירוע אופטימיזציה מוקדם יותר במשפך "
                "כדי לצאת מ-Learning Limited.")))
    return out


def _budget_cap_rule(client, rules, ctx) -> Optional[Dict[str, Any]]:
    monthly_budget = float(client.get("monthly_budget") or 0)
    if monthly_budget <= 0 or ctx.month_to_date_spend <= 0:
        return None
    ratio = rules.get("budget_cap_warning_ratio", 0.85)
    used = ctx.month_to_date_spend / monthly_budget
    if used >= ratio:
        severity = CRITICAL if used >= 1.0 else HIGH
        return _finding(
            client, None, level="account", issue_type="near_monthly_budget_cap", severity=severity,
            metric_value=f"{ctx.month_to_date_spend:.2f} ({used*100:.0f}%)",
            benchmark_or_target=f"חודשי {monthly_budget:.2f}",
            explanation=(
                f"ההוצאה מתחילת החודש היא {ctx.month_to_date_spend:.2f}, שהם {used*100:.0f}% "
                f"מהתקציב החודשי ({monthly_budget:.2f})."),
            recommended_next_step=(
                "תאם קצב הוצאה עם הלקוח; החלט אם להאט את ההוצאה לשארית החודש או לאשר תקציב נוסף."))
    return None
