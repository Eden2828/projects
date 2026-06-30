"""Anthropic Claude integration (reporting & explanation only).

Claude is used in a strictly advisory capacity:
  * Explain findings in plain language for PPC managers.
  * Prioritize what to look at first.
  * Write the narrative daily report.

HARD CONSTRAINT: the system prompt forbids Claude from ever recommending direct
API/automated changes to Meta Ads. It may only suggest MANUAL next steps for a
human PPC manager to perform. This mirrors the agent's read-only guarantee.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .action_logger import get_logger

log = get_logger("claude_client")

try:
    import anthropic
except Exception:  # noqa: BLE001
    anthropic = None  # type: ignore


SYSTEM_PROMPT = """\
You are a senior Meta (Facebook/Instagram) Ads QA analyst writing a daily \
monitoring briefing for PPC managers at an agency.

You are part of a strictly READ-ONLY monitoring system. Follow these rules without exception:
1. NEVER recommend making automated or direct API changes to the ad accounts.
2. Only recommend MANUAL next steps a human PPC manager should take inside Ads Manager.
3. Do not invent metrics or issues. Use only the findings and data provided.
4. Be concise, specific, and prioritized. Lead with the most urgent items.
5. Write for a busy professional: short paragraphs, scannable structure, no fluff.
6. Money and metrics should reference the numbers given in the findings.

Your goal: tell the PPC manager exactly what to check first and why, grounded \
strictly in the supplied findings.
"""


class ClaudeClient:
    """Wrapper around the Anthropic Messages API for report narration."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6") -> None:
        if anthropic is None:
            raise RuntimeError("anthropic package is not installed.")
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    # ------------------------------------------------------------------
    def generate_daily_report(
        self,
        *,
        report_date: str,
        stats: Dict[str, Any],
        per_client: List[Dict[str, Any]],
        top_accounts: List[Dict[str, Any]],
    ) -> Optional[str]:
        """Ask Claude to write the narrative daily report (Markdown).

        Returns Markdown text, or None if the call fails (caller falls back to a
        deterministic template report).
        """
        # Keep the payload compact: send only the fields Claude needs.
        payload = {
            "report_date": report_date,
            "totals": stats,
            "clients": per_client,
            "top_accounts_needing_attention": top_accounts,
        }

        user_prompt = (
            "Write today's Meta Ads QA daily report in Markdown for the PPC team. "
            "Use this structure:\n"
            "1. A one-paragraph executive summary.\n"
            "2. 'What to check first' - a prioritized, numbered list across all clients "
            "(most urgent first), each line naming the client and the single most important action.\n"
            "3. A short per-client section, only for clients that have findings, "
            "grouping issues by severity and giving manual next steps.\n"
            "4. A closing line listing clients with no issues.\n\n"
            "Remember: only manual next steps for a human - never suggest automated/API changes.\n\n"
            "Here is the structured data (JSON):\n"
            f"{json.dumps(payload, ensure_ascii=False, default=str)}"
        )

        try:
            resp = self._client.messages.create(
                model=self._model,
                max_tokens=4000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )
            return "".join(
                block.text for block in resp.content if getattr(block, "type", "") == "text"
            ).strip()
        except Exception:  # noqa: BLE001
            log.exception("Claude daily report generation failed")
            return None

    # ------------------------------------------------------------------
    def prioritize_findings(
        self, findings: List[Dict[str, Any]], limit: int = 10
    ) -> Optional[List[Dict[str, Any]]]:
        """Optionally ask Claude to rank findings and add a 'check first' reason.

        Returns a list of {issue_index, priority, reason} or None on failure.
        The deterministic severity sort is always available as a fallback, so this
        is a best-effort enhancement.
        """
        if not findings:
            return []
        compact = [
            {
                "i": idx,
                "client": f.get("client_name"),
                "issue_type": f.get("issue_type"),
                "severity": f.get("severity"),
                "metric": f.get("metric_value"),
                "target": f.get("benchmark_or_target"),
            }
            for idx, f in enumerate(findings)
        ]
        user_prompt = (
            "Given these Meta Ads QA findings, return ONLY a JSON array of the top "
            f"{limit} the PPC manager should check first. Each element: "
            '{"i": <index>, "priority": <1-based rank>, "reason": "<short why>"}. '
            "Rank by business impact and urgency. JSON only, no prose.\n\n"
            f"{json.dumps(compact, ensure_ascii=False)}"
        )
        try:
            resp = self._client.messages.create(
                model=self._model,
                max_tokens=1500,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text = "".join(
                b.text for b in resp.content if getattr(b, "type", "") == "text"
            ).strip()
            # Strip code fences if present.
            text = text.strip("`").lstrip("json").strip()
            return json.loads(text)
        except Exception:  # noqa: BLE001
            log.exception("Claude prioritization failed")
            return None
