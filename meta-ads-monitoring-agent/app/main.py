"""Entry point: run one full monitoring cycle.

Orchestration:
  1. Load config, clients, and rules.
  2. Connect to Meta (read-only) and verify the token.
  3. For each active client:
       a. Fetch campaigns/adsets/ads + insights.
       b. Build a RuleContext (previous snapshots, MTD spend, account-avg CPM).
       c. Run the QA rules engine.
       d. Persist the new performance snapshots.
  4. Persist all findings.
  5. Generate the daily report (Claude narrative if enabled, deterministic otherwise).
  6. Export Markdown/CSV/email text and store the report in Supabase.

Run directly:  python -m app.main  (one cycle)
Scheduled:     python -m app.scheduler  (loop every CHECK_INTERVAL_MINUTES)
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import config as cfg
from .action_logger import ActionLogger, configure_logging, get_logger
from .claude_client import ClaudeClient
from .config import Settings, load_clients_from_json, load_rules, rules_for_client
from .meta_client import MetaApiError, MetaClient
from .qa_rules_engine import RuleContext, evaluate_client
from .report_generator import (
    ReportData,
    build_report_row,
    render_email_text,
    render_markdown,
    write_exports,
)
from .supabase_client import SupabaseClient

log = get_logger("main")


def _make_run_id() -> str:
    return "run_" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _month_start_iso(now: datetime) -> str:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


def _load_clients(settings: Settings, supabase: Optional[SupabaseClient]) -> List[Dict[str, Any]]:
    """Load clients from the configured source."""
    if settings.clients_source == "supabase" and supabase is not None:
        return supabase.get_clients(only_active=True)
    clients = load_clients_from_json(settings.clients_file)
    # Honor 'status' filtering for parity with the Supabase path.
    return [c for c in clients if (c.get("status") or "active").lower() == "active"]


def run_once(settings: Optional[Settings] = None) -> Dict[str, Any]:
    """Execute a single monitoring cycle. Returns a small result summary dict."""
    settings = settings or cfg.load_settings()
    run_id = _make_run_id()
    now = datetime.now(timezone.utc)
    report_date = now.strftime("%Y-%m-%d")

    # --- Supabase (optional) ---
    supabase: Optional[SupabaseClient] = None
    if settings.supabase_enabled:
        try:
            supabase = SupabaseClient(
                settings.supabase_url, settings.supabase_service_role_key
            )
        except Exception:  # noqa: BLE001
            log.exception("Could not initialize Supabase; continuing without persistence")

    action_log = ActionLogger(run_id=run_id, supabase_client=supabase)
    action_log.info("Starting monitoring run", run_id=run_id, report_date=report_date)

    # --- Validate config ---
    problems = settings.validate()
    if problems:
        for p in problems:
            action_log.error("config", p)
        # Missing Meta token is fatal; everything else is a soft warning above.
        if not settings.meta_access_token:
            raise SystemExit("Fatal: META_ACCESS_TOKEN is required. See .env.example.")

    rules = load_rules(settings.rules_file)

    # --- Meta client (read-only) ---
    meta = MetaClient(
        access_token=settings.meta_access_token,
        base_url=settings.meta_base_url,
        min_seconds_between_calls=settings.meta_min_seconds_between_calls,
        max_retries=settings.meta_max_retries,
    )
    try:
        identity = meta.verify_token()
        action_log.info("Meta token verified", account=identity.get("name"))
    except MetaApiError as exc:
        action_log.error("meta_client", f"Token verification failed: {exc}")
        raise SystemExit("Fatal: Meta access token is invalid or lacks ads_read.")

    # --- Load clients ---
    clients = _load_clients(settings, supabase)
    action_log.info("Loaded clients", count=len(clients))

    all_findings: List[Dict[str, Any]] = []
    snapshots_stored = 0

    # --- Per-client processing ---
    for client in clients:
        cid = client.get("client_id")
        cname = client.get("client_name")
        account = client.get("ad_account_id")
        try:
            entities = meta.fetch_account_entities(account)
        except MetaApiError as exc:
            action_log.error(
                "meta_client", f"Failed to fetch account {account}: {exc}",
                client_id=cid, context={"client_name": cname},
            )
            continue
        except Exception as exc:  # noqa: BLE001
            action_log.error(
                "meta_client", f"Unexpected error for {account}: {exc}",
                client_id=cid, exc_info=True,
            )
            continue

        # Build trend context from history (before inserting this run's snapshots).
        def _get_previous(entity_id: str, _cid=cid) -> Optional[Dict[str, Any]]:
            if supabase is None or not entity_id:
                return None
            return supabase.get_previous_snapshot(_cid, entity_id)

        # Month-to-date spend = historical (DB) + this run's campaign spend.
        mtd_spend = 0.0
        if supabase is not None:
            mtd_spend = supabase.get_month_to_date_spend(cid, _month_start_iso(now))
        mtd_spend += sum(
            float(e.get("spend") or 0) for e in entities if e.get("level") == "campaign"
        )

        ctx = RuleContext(
            get_previous=_get_previous,
            month_to_date_spend=mtd_spend,
            now=now,
        )

        # Apply any per-client threshold overrides before evaluating.
        effective_rules = cfg.rules_for_client(rules, cid)
        findings = evaluate_client(client, entities, effective_rules, ctx)
        for f in findings:
            f["run_id"] = run_id
        all_findings.extend(findings)
        action_log.info(
            "Evaluated client", client_name=cname, entities=len(entities),
            findings=len(findings),
        )

        # Persist snapshots (after using history for trend rules).
        if supabase is not None:
            rows = [_snapshot_row(client, e, run_id) for e in entities]
            snapshots_stored += supabase.insert_snapshots(rows)

    # --- Persist findings ---
    if supabase is not None and all_findings:
        stored = supabase.insert_findings(
            [_finding_row(f) for f in all_findings]
        )
        action_log.info("Stored findings", stored=stored)

    # --- Build report ---
    data = ReportData(run_id=run_id, report_date=report_date, clients=clients, findings=all_findings)

    narrative: Optional[str] = None
    if settings.claude_enabled and all_findings:
        try:
            claude = ClaudeClient(settings.anthropic_api_key, settings.anthropic_model)
            narrative = claude.generate_daily_report(
                report_date=report_date,
                stats=data.stats(),
                per_client=_per_client_payload(data),
                top_accounts=data.top_accounts,
            )
        except Exception as exc:  # noqa: BLE001
            action_log.error("claude_client", f"Report narration failed: {exc}")

    markdown = render_markdown(data, narrative=narrative)
    email_text = render_email_text(data)

    # --- Export to disk ---
    written = write_exports(
        data, settings.reports_dir, settings.export_formats, markdown, email_text
    )
    action_log.info("Wrote report exports", files=written)

    # --- Persist report ---
    if supabase is not None:
        report_id = supabase.insert_daily_report(
            build_report_row(data, markdown, email_text)
        )
        action_log.info("Stored daily report", report_id=report_id)

    summary = {
        "run_id": run_id,
        "report_date": report_date,
        "clients_checked": len(clients),
        "findings": len(all_findings),
        "snapshots_stored": snapshots_stored,
        "errors": action_log.error_count,
        "exports": written,
        **data.stats(),
    }
    action_log.info("Run complete", **{k: summary[k] for k in ("run_id", "findings", "errors")})
    _print_console_summary(summary, data)
    return summary


# -----------------------------------------------------------------------------
# Row mappers (snapshot/finding -> DB columns)
# -----------------------------------------------------------------------------
def _snapshot_row(client: Dict[str, Any], e: Dict[str, Any], run_id: str) -> Dict[str, Any]:
    return {
        "client_id": client.get("client_id"),
        "ad_account_id": client.get("ad_account_id"),
        "level": e.get("level"),
        "entity_id": e.get("entity_id"),
        "entity_name": e.get("entity_name"),
        "campaign_id": e.get("campaign_id"),
        "campaign_name": e.get("campaign_name"),
        "adset_id": e.get("adset_id"),
        "adset_name": e.get("adset_name"),
        "ad_id": e.get("ad_id"),
        "ad_name": e.get("ad_name"),
        "status": e.get("status"),
        "effective_status": e.get("effective_status"),
        "review_status": e.get("review_status"),
        "date_start": e.get("date_start"),
        "date_stop": e.get("date_stop"),
        "spend": e.get("spend"),
        "impressions": e.get("impressions"),
        "clicks": e.get("clicks"),
        "ctr": e.get("ctr"),
        "cpc": e.get("cpc"),
        "cpm": e.get("cpm"),
        "frequency": e.get("frequency"),
        "reach": e.get("reach"),
        "results": e.get("results"),
        "cost_per_result": e.get("cost_per_result"),
        "purchases": e.get("purchases"),
        "leads": e.get("leads"),
        "roas": e.get("roas"),
        "raw": e.get("raw"),
    }


def _finding_row(f: Dict[str, Any]) -> Dict[str, Any]:
    keys = [
        "run_id", "client_id", "client_name", "ad_account_id", "level",
        "campaign_name", "adset_name", "ad_name", "issue_type", "severity",
        "metric_value", "benchmark_or_target", "explanation",
        "recommended_next_step", "detected_at",
    ]
    return {k: f.get(k) for k in keys}


def _per_client_payload(data: ReportData) -> List[Dict[str, Any]]:
    """Compact per-client findings for the Claude prompt."""
    out: List[Dict[str, Any]] = []
    for client_name, items in data.by_client.items():
        out.append(
            {
                "client_name": client_name,
                "findings": [
                    {
                        "issue_type": i.get("issue_type"),
                        "severity": i.get("severity"),
                        "campaign": i.get("campaign_name"),
                        "adset": i.get("adset_name"),
                        "ad": i.get("ad_name"),
                        "metric": i.get("metric_value"),
                        "target": i.get("benchmark_or_target"),
                        "explanation": i.get("explanation"),
                        "next_step": i.get("recommended_next_step"),
                    }
                    for i in items
                ],
            }
        )
    return out


def _print_console_summary(summary: Dict[str, Any], data: ReportData) -> None:
    print("\n" + "=" * 60)
    print(f"  Meta Ads QA Run {summary['run_id']}")
    print("=" * 60)
    print(f"  Accounts checked : {summary['accounts_checked']}")
    print(f"  Findings         : {summary['total_findings']} "
          f"(C:{summary['critical']} H:{summary['high']} "
          f"M:{summary['medium']} L:{summary['low']} I:{summary['info']})")
    print(f"  Clients OK       : {summary['clients_no_issues']}")
    print(f"  Errors           : {summary['errors']}")
    if data.top_accounts:
        print("  Top accounts needing attention:")
        for i, acc in enumerate(data.top_accounts, start=1):
            print(f"    {i}. {acc['client_name']} "
                  f"({acc['total_findings']} findings, top {acc['top_issue_severity']})")
    for fmt, path in summary["exports"].items():
        print(f"  Export [{fmt}]: {path}")
    print("=" * 60 + "\n")


def main() -> int:
    settings = cfg.load_settings()
    configure_logging(level=settings.log_level, as_json=settings.log_json)
    try:
        run_once(settings)
        return 0
    except SystemExit as exc:
        log.error(str(exc))
        return 1
    except Exception:  # noqa: BLE001
        log.exception("Monitoring run failed with an unexpected error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
