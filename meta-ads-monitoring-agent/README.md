# Meta Ads Monitoring & QA Agent

A **strictly read-only** monitoring agent for Meta (Facebook/Instagram) ad
accounts. It watches your managed accounts, detects QA issues, stores findings
in Supabase, and produces a prioritized daily report for PPC managers.

> ⚠️ **Read-only by design.** This agent never changes anything in Meta Ads.
> It only reads data, analyzes it, stores findings, and writes reports. It needs
> only the `ads_read` permission — **never** grant `ads_management`.

---

## What it does

1. **Loads clients** from Supabase or a local `clients.json`.
2. **Pulls read-only data** from the Meta Marketing API: campaigns, adsets, ads,
   and insights (spend, impressions, clicks, CTR, CPC, CPM, frequency, results,
   cost-per-result, purchases, leads, ROAS, status, effective status, and ad
   review status when available).
3. **Stores performance snapshots** in Supabase (a time series used for trend
   detection).
4. **Runs a QA rules engine** that flags issues across CRITICAL → INFO severity.
5. **Uses Claude** *only* to explain findings, prioritize them, and write the
   human-readable daily report. Claude is explicitly forbidden from recommending
   automated/API changes — it only suggests **manual** next steps.
6. **Generates a daily report** and exports it as Markdown, CSV, and email-ready
   text, and stores it in Supabase.

---

## Safety guarantees

| Guarantee | How it is enforced |
|-----------|--------------------|
| Read-only Meta access | The Meta client has a single HTTP helper that **hard-codes `GET`**. There are no write code paths. |
| No `ads_management` | Only `ads_read` data/endpoints are requested. |
| No AI-driven changes | Claude's system prompt forbids recommending automated/API changes; it only suggests manual steps. |
| Rate limiting | Client-side throttle (`META_MIN_SECONDS_BETWEEN_CALLS`) between every call. |
| Retries | Exponential backoff on transient/rate-limit errors (`META_MAX_RETRIES`). |
| Clear error logging | Structured logs + a `system_errors` table in Supabase. |
| DB lockdown | All tables have RLS enabled; only the service-role backend can access them. |

---

## Project structure

```
meta-ads-monitoring-agent/
  app/
    main.py              # Orchestrates one full monitoring cycle
    config.py            # Env + clients + rules loading
    meta_client.py       # READ-ONLY Meta Marketing API client (GET only)
    supabase_client.py   # Supabase persistence layer
    claude_client.py     # Claude reporting/explanation (advisory only)
    qa_rules_engine.py   # Deterministic issue detection
    report_generator.py  # Markdown / CSV / email rendering + aggregation
    action_logger.py     # Structured logging + system_errors capture
    scheduler.py         # In-process interval scheduler
  sql/
    schema.sql           # Supabase tables + indexes + RLS
  clients.example.json   # Sample client list
  rules.example.json     # Sample QA thresholds
  requirements.txt
  README.md
  .env.example
```

---

## Setup

### 1. Prerequisites
- Python 3.10+
- A Meta access token with **`ads_read`** scope (and an App ID/Secret).
- A Supabase project (optional but recommended).
- An Anthropic API key (optional — falls back to a deterministic report).

### 2. Install
```bash
cd meta-ads-monitoring-agent
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure
```bash
cp .env.example .env          # then fill in real values
cp clients.example.json clients.json
cp rules.example.json rules.json
```

Set at minimum `META_ACCESS_TOKEN` in `.env`. To use Supabase, also set
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. To use Claude narration, set
`ANTHROPIC_API_KEY`.

### 4. Provision the database (optional)
Open the Supabase SQL editor and run `sql/schema.sql`. To source clients from the
database instead of the JSON file, set `CLIENTS_SOURCE=supabase` and insert rows
into the `clients` table.

---

## Running

### One cycle (good for cron)
```bash
python -m app.main
```

### Continuous loop (in-process scheduler)
```bash
python -m app.scheduler
```
Runs immediately, then every `CHECK_INTERVAL_MINUTES`.

### External cron (recommended in production)
Linux crontab — every 30 minutes:
```cron
*/30 * * * * cd /path/to/meta-ads-monitoring-agent && /path/to/.venv/bin/python -m app.main >> logs/agent.log 2>&1
```

Windows Task Scheduler — run:
```
powershell -Command "cd C:\path\to\meta-ads-monitoring-agent; .\.venv\Scripts\python.exe -m app.main"
```

---

## Configuration reference

All settings come from environment variables (see `.env.example`). Highlights:

| Variable | Default | Purpose |
|----------|---------|---------|
| `META_ACCESS_TOKEN` | — | Read-only Meta token (`ads_read`). **Required.** |
| `META_API_VERSION` | `v20.0` | Graph API version. |
| `CLIENTS_SOURCE` | `json` | `json` or `supabase`. |
| `CLIENTS_FILE` | `clients.json` | Client list when source is `json`. |
| `RULES_FILE` | `rules.json` | QA thresholds. |
| `CHECK_INTERVAL_MINUTES` | `30` | Scheduler interval. |
| `USE_CLAUDE_REPORT` | `true` | Toggle Claude narration. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Model for report narration. |
| `EXPORT_FORMATS` | `markdown,csv` | Report exports to write. |
| `META_MIN_SECONDS_BETWEEN_CALLS` | `1.0` | Client-side rate limit. |
| `META_MAX_RETRIES` | `4` | Retry attempts on transient failures. |
| `LOG_JSON` | `false` | JSON logs for production pipelines. |

### Client fields
`client_id`, `client_name`, `ad_account_id`, `monthly_budget`, `daily_budget`,
`main_goal`, `target_cpa`, `target_roas`, `industry`, `campaign_type`,
`assigned_ppc_manager`, `status`.

### QA rules / thresholds
Edit `rules.json` (copy from `rules.example.json`). Per-client overrides go under
`client_overrides` keyed by `client_id`.

---

## QA checks performed

| Issue type | Default severity | Trigger |
|------------|------------------|---------|
| `active_campaign_zero_spend` | HIGH | Active campaign, ~0 spend, 0 impressions |
| `spend_without_results` | HIGH | Active entity with spend but 0 results |
| `suspected_tracking_issue` | HIGH | Clicks present but 0 results reported |
| `cpa_above_target` | HIGH | CPA above `target_cpa × multiplier` |
| `roas_below_target` | HIGH | ROAS below `target_roas` |
| `sudden_cpa_increase` | HIGH | CPA spike vs previous snapshot |
| `sudden_spend_drop` | MEDIUM | Spend drop vs previous snapshot |
| `high_frequency` | MEDIUM | Frequency above threshold |
| `low_ctr` | MEDIUM | CTR below floor |
| `entity_turned_off` | MEDIUM | Was active, now paused (unexpected) |
| `learning_limited` | MEDIUM | Adset stuck in Learning Limited (if surfaced) |
| `cpm_above_account_average` | LOW | CPM far above account average |
| `ad_rejected_or_limited` | CRITICAL/HIGH | Disapproved or limited delivery |
| `near_monthly_budget_cap` | HIGH/CRITICAL | MTD spend near/over monthly budget |

Every finding records: `client_name`, `ad_account_id`, `campaign_name`,
`adset_name`/`ad_name` (when relevant), `issue_type`, `severity`, `metric_value`,
`benchmark_or_target`, `explanation`, `recommended_next_step`, and `detected_at`.

---

## Daily report

The report includes: accounts checked; counts of critical/high/medium/low
issues; clients with no issues; the **top 5 accounts needing attention**; and
clear, **manual** next steps per client. It is written to:

- Supabase `daily_reports` table
- `reports/qa_report_<date>.md` (Markdown)
- `reports/qa_findings_<date>.csv` (CSV)
- `reports/qa_email_<date>.txt` (email-ready text)

If Claude is disabled or unavailable, a deterministic template report is produced
instead — the system never depends on AI to generate output.

---

## Graceful degradation

| Missing | Behavior |
|---------|----------|
| Supabase creds | Skips persistence; still fetches, analyzes, and writes local report files. |
| Anthropic key | Skips narration; uses the deterministic report template. |
| A single account errors | Logs to `system_errors`, skips that client, continues the run. |

---

## License

Internal tooling. Adapt as needed for your agency.
