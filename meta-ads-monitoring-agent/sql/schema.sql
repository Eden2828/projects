-- =============================================================================
-- Meta Ads Monitoring & QA Agent - Supabase / Postgres schema
-- Run this in the Supabase SQL editor (or psql) to provision all tables.
--
-- Design notes:
--   * This agent is READ-ONLY against Meta. These tables only store what the
--     agent observes and produces (snapshots, findings, reports, errors).
--   * Uses the service-role key from the backend; Row Level Security is enabled
--     with no public policies so the anon/public role cannot read or write.
-- =============================================================================

-- Helpful extension for UUID generation.
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- clients: the accounts under management. Can be the source of truth instead of
-- clients.json, or simply mirror it.
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
    client_id            text primary key,
    client_name          text not null,
    ad_account_id        text not null,
    monthly_budget       numeric,
    daily_budget         numeric,
    main_goal            text,
    target_cpa           numeric,
    target_roas          numeric,
    industry             text,
    campaign_type        text,
    assigned_ppc_manager text,
    status               text not null default 'active',
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create index if not exists idx_clients_status on public.clients (status);
create index if not exists idx_clients_account on public.clients (ad_account_id);

-- -----------------------------------------------------------------------------
-- performance_snapshots: one row per entity (campaign / adset / ad) per run.
-- This is the time series the QA engine compares against to detect trends
-- (sudden spend drops, CPA spikes, etc.).
-- -----------------------------------------------------------------------------
create table if not exists public.performance_snapshots (
    id                uuid primary key default gen_random_uuid(),
    client_id         text not null references public.clients (client_id) on delete cascade,
    ad_account_id     text not null,
    level             text not null,            -- 'campaign' | 'adset' | 'ad'
    entity_id         text not null,            -- Meta object id
    entity_name       text,
    campaign_id       text,
    campaign_name     text,
    adset_id          text,
    adset_name        text,
    ad_id             text,
    ad_name           text,
    status            text,                     -- configured status (ACTIVE/PAUSED)
    effective_status  text,                     -- delivery status from Meta
    review_status     text,                     -- ad review / disapproval status if available
    date_start        date,
    date_stop         date,
    spend             numeric default 0,
    impressions       bigint default 0,
    clicks            bigint default 0,
    ctr               numeric default 0,        -- percent
    cpc               numeric default 0,
    cpm               numeric default 0,
    frequency         numeric default 0,
    reach             bigint default 0,
    results           numeric default 0,
    cost_per_result   numeric default 0,
    purchases         numeric default 0,
    leads             numeric default 0,
    roas              numeric default 0,
    raw               jsonb,                    -- full raw insight payload for audit
    captured_at       timestamptz not null default now()
);

create index if not exists idx_snap_client_time on public.performance_snapshots (client_id, captured_at desc);
create index if not exists idx_snap_entity_time on public.performance_snapshots (entity_id, captured_at desc);
create index if not exists idx_snap_level on public.performance_snapshots (level);

-- -----------------------------------------------------------------------------
-- qa_findings: one row per detected issue per run.
-- -----------------------------------------------------------------------------
create table if not exists public.qa_findings (
    id                   uuid primary key default gen_random_uuid(),
    run_id               text,                  -- groups all findings from one monitoring cycle
    client_id            text references public.clients (client_id) on delete set null,
    client_name          text,
    ad_account_id        text,
    level                text,                  -- account | campaign | adset | ad
    campaign_name        text,
    adset_name           text,
    ad_name              text,
    issue_type           text not null,
    severity             text not null,         -- CRITICAL | HIGH | MEDIUM | LOW | INFO
    metric_value         text,
    benchmark_or_target  text,
    explanation          text,
    recommended_next_step text,
    detected_at          timestamptz not null default now()
);

create index if not exists idx_find_run on public.qa_findings (run_id);
create index if not exists idx_find_client on public.qa_findings (client_id);
create index if not exists idx_find_severity on public.qa_findings (severity);
create index if not exists idx_find_time on public.qa_findings (detected_at desc);

-- -----------------------------------------------------------------------------
-- daily_reports: the human-readable report generated per run.
-- -----------------------------------------------------------------------------
create table if not exists public.daily_reports (
    id                uuid primary key default gen_random_uuid(),
    run_id            text,
    report_date       date not null default current_date,
    accounts_checked  int default 0,
    critical_count    int default 0,
    high_count        int default 0,
    medium_count      int default 0,
    low_count         int default 0,
    info_count        int default 0,
    clients_no_issues int default 0,
    summary_markdown  text,                     -- full Markdown report
    summary_text      text,                     -- email-ready plain text
    top_accounts      jsonb,                    -- top-5 accounts needing attention
    metrics           jsonb,                    -- assorted run metrics
    created_at        timestamptz not null default now()
);

create index if not exists idx_reports_date on public.daily_reports (report_date desc);
create index if not exists idx_reports_run on public.daily_reports (run_id);

-- -----------------------------------------------------------------------------
-- system_errors: structured error log for observability.
-- -----------------------------------------------------------------------------
create table if not exists public.system_errors (
    id            uuid primary key default gen_random_uuid(),
    run_id        text,
    component     text,                          -- meta_client | supabase_client | claude_client | ...
    client_id     text,
    severity      text default 'ERROR',
    message       text not null,
    context       jsonb,
    occurred_at   timestamptz not null default now()
);

create index if not exists idx_errors_time on public.system_errors (occurred_at desc);
create index if not exists idx_errors_component on public.system_errors (component);

-- -----------------------------------------------------------------------------
-- Row Level Security: lock everything down. The backend uses the service-role
-- key which bypasses RLS; no public policies are defined, so anon access is denied.
-- -----------------------------------------------------------------------------
alter table public.clients               enable row level security;
alter table public.performance_snapshots enable row level security;
alter table public.qa_findings           enable row level security;
alter table public.daily_reports         enable row level security;
alter table public.system_errors         enable row level security;
