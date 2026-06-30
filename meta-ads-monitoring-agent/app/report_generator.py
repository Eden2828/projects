"""Report generation and export.

Aggregates findings into a daily report and renders it to multiple formats:
  * A deterministic Markdown report (always available, no AI required).
  * A CSV of all findings.
  * Email-ready plain text.
  * A structured dict ready to insert into the ``daily_reports`` table.

If a Claude narrative is supplied it is used as the report body; otherwise the
built-in deterministic template is used so the system never depends on AI to
produce output.
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .qa_rules_engine import SEVERITY_ORDER, CRITICAL, HIGH, MEDIUM, LOW, INFO

SEVERITIES = [CRITICAL, HIGH, MEDIUM, LOW, INFO]

# Severity weights used to score which accounts most need attention.
SEVERITY_WEIGHT = {CRITICAL: 100, HIGH: 25, MEDIUM: 5, LOW: 2, INFO: 1}


class ReportData:
    """Computed aggregates for a single monitoring run."""

    def __init__(
        self,
        run_id: str,
        report_date: str,
        clients: List[Dict[str, Any]],
        findings: List[Dict[str, Any]],
    ) -> None:
        self.run_id = run_id
        self.report_date = report_date
        self.clients = clients
        self.findings = findings

        self.accounts_checked = len(clients)
        self.severity_counts = {sev: 0 for sev in SEVERITIES}
        self.by_client: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        for f in findings:
            sev = f.get("severity", INFO)
            self.severity_counts[sev] = self.severity_counts.get(sev, 0) + 1
            self.by_client[f.get("client_name") or f.get("client_id") or "unknown"].append(f)

        names_with_findings = set(self.by_client.keys())
        self.clients_no_issues = [
            c["client_name"] for c in clients
            if c.get("client_name") not in names_with_findings
        ]
        self.top_accounts = self._compute_top_accounts(limit=5)

    def _compute_top_accounts(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Score each client by weighted severity and return the worst ``limit``."""
        scored: List[Dict[str, Any]] = []
        for client_name, items in self.by_client.items():
            score = sum(SEVERITY_WEIGHT.get(i.get("severity", INFO), 1) for i in items)
            counts = {sev: 0 for sev in SEVERITIES}
            for i in items:
                counts[i.get("severity", INFO)] = counts.get(i.get("severity", INFO), 0) + 1
            top_issue = sorted(
                items, key=lambda x: SEVERITY_ORDER.get(x.get("severity", INFO), 99)
            )[0]
            scored.append(
                {
                    "client_name": client_name,
                    "score": score,
                    "total_findings": len(items),
                    "counts": counts,
                    "top_issue_type": top_issue.get("issue_type"),
                    "top_issue_severity": top_issue.get("severity"),
                    "top_recommended_next_step": top_issue.get("recommended_next_step"),
                }
            )
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:limit]

    def stats(self) -> Dict[str, Any]:
        return {
            "accounts_checked": self.accounts_checked,
            "critical": self.severity_counts.get(CRITICAL, 0),
            "high": self.severity_counts.get(HIGH, 0),
            "medium": self.severity_counts.get(MEDIUM, 0),
            "low": self.severity_counts.get(LOW, 0),
            "info": self.severity_counts.get(INFO, 0),
            "total_findings": len(self.findings),
            "clients_no_issues": len(self.clients_no_issues),
        }


# -----------------------------------------------------------------------------
# Rendering
# -----------------------------------------------------------------------------
def _severity_emoji(sev: str) -> str:
    return {
        CRITICAL: "🔴",
        HIGH: "🟠",
        MEDIUM: "🟡",
        LOW: "🔵",
        INFO: "⚪",
    }.get(sev, "•")


def render_markdown(data: ReportData, narrative: Optional[str] = None) -> str:
    """Render the deterministic Markdown report (or wrap a Claude narrative)."""
    s = data.stats()
    lines: List[str] = []
    lines.append(f"# Meta Ads QA Daily Report — {data.report_date}")
    lines.append("")
    lines.append(f"_Run ID: `{data.run_id}` · Generated {datetime.now(timezone.utc).isoformat()}_")
    lines.append("")

    # Summary table.
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- **Accounts checked:** {s['accounts_checked']}")
    lines.append(f"- {_severity_emoji(CRITICAL)} **Critical:** {s['critical']}")
    lines.append(f"- {_severity_emoji(HIGH)} **High:** {s['high']}")
    lines.append(f"- {_severity_emoji(MEDIUM)} **Medium:** {s['medium']}")
    lines.append(f"- {_severity_emoji(LOW)} **Low:** {s['low']}")
    lines.append(f"- {_severity_emoji(INFO)} **Info:** {s['info']}")
    lines.append(f"- ✅ **Clients with no issues:** {s['clients_no_issues']}")
    lines.append("")

    # If Claude wrote a narrative, include it as the main body.
    if narrative:
        lines.append("## Briefing")
        lines.append("")
        lines.append(narrative)
        lines.append("")

    # Top 5 accounts needing attention.
    lines.append("## Top 5 Accounts Needing Attention")
    lines.append("")
    if data.top_accounts:
        lines.append("| # | Client | Score | C | H | M | L | Top issue | First step |")
        lines.append("|---|--------|-------|---|---|---|---|-----------|-----------|")
        for i, acc in enumerate(data.top_accounts, start=1):
            c = acc["counts"]
            lines.append(
                f"| {i} | {acc['client_name']} | {acc['score']} | "
                f"{c[CRITICAL]} | {c[HIGH]} | {c[MEDIUM]} | {c[LOW]} | "
                f"{acc['top_issue_type']} ({acc['top_issue_severity']}) | "
                f"{(acc['top_recommended_next_step'] or '')[:80]} |"
            )
    else:
        lines.append("_No accounts flagged. 🎉_")
    lines.append("")

    # Per-client detail (deterministic; complements the narrative).
    lines.append("## Findings by Client")
    lines.append("")
    if not data.findings:
        lines.append("_No findings across any monitored account._")
        lines.append("")
    else:
        for client_name in sorted(data.by_client.keys()):
            items = sorted(
                data.by_client[client_name],
                key=lambda x: SEVERITY_ORDER.get(x.get("severity", INFO), 99),
            )
            lines.append(f"### {client_name} ({len(items)} findings)")
            lines.append("")
            for f in items:
                loc = " › ".join(
                    p for p in [f.get("campaign_name"), f.get("adset_name"), f.get("ad_name")] if p
                ) or f.get("level", "")
                lines.append(
                    f"- {_severity_emoji(f.get('severity'))} **{f.get('severity')} · "
                    f"{f.get('issue_type')}** — {loc}"
                )
                lines.append(
                    f"  - Metric: `{f.get('metric_value')}` vs target `{f.get('benchmark_or_target')}`"
                )
                lines.append(f"  - {f.get('explanation')}")
                lines.append(f"  - 👉 **Next step:** {f.get('recommended_next_step')}")
            lines.append("")

    # Clients with no issues.
    lines.append("## Clients With No Issues")
    lines.append("")
    if data.clients_no_issues:
        lines.append(", ".join(sorted(data.clients_no_issues)))
    else:
        lines.append("_None — every monitored client has at least one finding._")
    lines.append("")

    return "\n".join(lines)


def render_csv(data: ReportData) -> str:
    """Render all findings as CSV text."""
    buf = io.StringIO()
    fieldnames = [
        "client_name", "ad_account_id", "level", "campaign_name", "adset_name",
        "ad_name", "issue_type", "severity", "metric_value", "benchmark_or_target",
        "explanation", "recommended_next_step", "detected_at",
    ]
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for f in sorted(
        data.findings, key=lambda x: SEVERITY_ORDER.get(x.get("severity", INFO), 99)
    ):
        writer.writerow(f)
    return buf.getvalue()


def render_email_text(data: ReportData) -> str:
    """Render a concise, email-ready plain-text summary."""
    s = data.stats()
    lines: List[str] = []
    lines.append(f"Meta Ads QA Daily Report - {data.report_date}")
    lines.append("=" * 48)
    lines.append(
        f"Accounts checked: {s['accounts_checked']} | "
        f"Critical: {s['critical']} | High: {s['high']} | "
        f"Medium: {s['medium']} | Low: {s['low']}"
    )
    lines.append(f"Clients with no issues: {s['clients_no_issues']}")
    lines.append("")
    lines.append("TOP ACCOUNTS NEEDING ATTENTION:")
    if data.top_accounts:
        for i, acc in enumerate(data.top_accounts, start=1):
            lines.append(
                f"  {i}. {acc['client_name']} - {acc['total_findings']} findings "
                f"(top: {acc['top_issue_type']} / {acc['top_issue_severity']})"
            )
            lines.append(f"     First step: {acc['top_recommended_next_step']}")
    else:
        lines.append("  None.")
    lines.append("")
    lines.append("NEXT STEPS PER CLIENT:")
    for client_name in sorted(data.by_client.keys()):
        items = sorted(
            data.by_client[client_name],
            key=lambda x: SEVERITY_ORDER.get(x.get("severity", INFO), 99),
        )
        lines.append(f"- {client_name}:")
        for f in items[:5]:
            lines.append(
                f"    [{f.get('severity')}] {f.get('issue_type')} -> "
                f"{f.get('recommended_next_step')}"
            )
    return "\n".join(lines)


def build_report_row(
    data: ReportData,
    markdown: str,
    email_text: str,
) -> Dict[str, Any]:
    """Build the dict to insert into the ``daily_reports`` table."""
    s = data.stats()
    return {
        "run_id": data.run_id,
        "report_date": data.report_date,
        "accounts_checked": s["accounts_checked"],
        "critical_count": s["critical"],
        "high_count": s["high"],
        "medium_count": s["medium"],
        "low_count": s["low"],
        "info_count": s["info"],
        "clients_no_issues": s["clients_no_issues"],
        "summary_markdown": markdown,
        "summary_text": email_text,
        "top_accounts": data.top_accounts,
        "metrics": s,
    }


def write_exports(
    data: ReportData,
    reports_dir: Path,
    formats: List[str],
    markdown: str,
    email_text: str,
) -> Dict[str, str]:
    """Write requested export files to disk and return {format: path}."""
    reports_dir.mkdir(parents=True, exist_ok=True)
    stamp = data.report_date
    written: Dict[str, str] = {}

    if "markdown" in formats:
        path = reports_dir / f"qa_report_{stamp}.md"
        path.write_text(markdown, encoding="utf-8")
        written["markdown"] = str(path)

    if "csv" in formats:
        path = reports_dir / f"qa_findings_{stamp}.csv"
        path.write_text(render_csv(data), encoding="utf-8")
        written["csv"] = str(path)

    # Always write the email-ready text alongside the others for convenience.
    email_path = reports_dir / f"qa_email_{stamp}.txt"
    email_path.write_text(email_text, encoding="utf-8")
    written["email_text"] = str(email_path)

    return written
