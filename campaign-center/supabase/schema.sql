-- ============================================================
-- Think Digital Campaign Operations Platform — Supabase Schema
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";
create extension if not exists "btree_gin";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('admin', 'team_lead', 'campaign_manager', 'viewer');
create type alert_severity as enum ('critical', 'high', 'medium', 'low');
create type alert_type as enum (
  'billing_issue', 'rejected_ads', 'learning_limited',
  'cpa_increase', 'roas_decrease', 'ctr_decrease',
  'frequency_increase', 'spend_anomaly', 'conversion_drop',
  'campaign_inactive', 'budget_pacing', 'ad_fatigue'
);
create type alert_status as enum ('open', 'acknowledged', 'resolved', 'ignored');
create type recommendation_action as enum (
  'increase_budget', 'decrease_budget', 'pause_ad', 'pause_adset',
  'pause_campaign', 'duplicate_winner', 'refresh_creatives',
  'expand_audience', 'narrow_audience', 'change_bid_strategy',
  'add_negative_keywords', 'scale_winner'
);
create type approval_status as enum ('pending', 'approved', 'rejected', 'executed', 'failed');
create type task_status as enum ('todo', 'in_progress', 'review', 'done', 'cancelled');
create type task_priority as enum ('urgent', 'high', 'medium', 'low');
create type sync_status as enum ('pending', 'running', 'success', 'failed');
create type entity_type as enum ('campaign', 'adset', 'ad', 'account');
create type report_type as enum ('weekly', 'monthly', 'custom', 'daily_brief');
create type report_format as enum ('pdf', 'pptx', 'xlsx');
create type activity_type as enum (
  'recommendation_created', 'recommendation_approved', 'recommendation_rejected',
  'action_executed', 'action_failed', 'user_login', 'user_action',
  'alert_created', 'alert_resolved', 'sync_completed', 'task_created',
  'task_updated', 'report_generated', 'ai_conversation'
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  full_name       text not null,
  avatar_url      text,
  role            user_role not null default 'campaign_manager',
  is_active       boolean not null default true,
  preferences     jsonb not null default '{
    "theme": "dark",
    "notifications": {"email": true, "browser": true},
    "dashboard": {"sort": "health_score", "view": "grid"},
    "ai_preferences": []
  }',
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- CLIENTS
-- ============================================================

create table public.clients (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  slug                  text unique not null,
  logo_url              text,
  industry              text,
  website               text,
  primary_contact_name  text,
  primary_contact_email text,
  primary_contact_phone text,
  currency              text not null default 'ILS',
  timezone              text not null default 'Asia/Jerusalem',
  monthly_budget        numeric(12,2),
  target_roas           numeric(6,2),
  target_cpa            numeric(10,2),
  notes                 text,
  tags                  text[] default '{}',
  assigned_managers     uuid[] default '{}',
  is_active             boolean not null default true,
  onboarded_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- META AD ACCOUNTS
-- ============================================================

create table public.ad_accounts (
  id                    uuid primary key default uuid_generate_v4(),
  client_id             uuid not null references public.clients(id) on delete cascade,
  meta_account_id       text unique not null,
  account_name          text not null,
  account_status        integer,
  currency              text not null default 'ILS',
  timezone_name         text,
  business_name         text,
  access_token          text,
  token_expires_at      timestamptz,
  daily_budget_limit    numeric(12,2),
  total_spent           numeric(12,2) default 0,
  last_synced_at        timestamptz,
  sync_status           sync_status default 'pending',
  sync_error            text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- CAMPAIGNS
-- ============================================================

create table public.campaigns (
  id                  uuid primary key default uuid_generate_v4(),
  ad_account_id       uuid not null references public.ad_accounts(id) on delete cascade,
  meta_campaign_id    text not null,
  name                text not null,
  status              text,
  objective           text,
  buying_type         text,
  daily_budget        numeric(12,2),
  lifetime_budget     numeric(12,2),
  start_time          timestamptz,
  stop_time           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (ad_account_id, meta_campaign_id)
);

-- ============================================================
-- AD SETS
-- ============================================================

create table public.ad_sets (
  id                  uuid primary key default uuid_generate_v4(),
  campaign_id         uuid not null references public.campaigns(id) on delete cascade,
  meta_adset_id       text not null,
  name                text not null,
  status              text,
  daily_budget        numeric(12,2),
  lifetime_budget     numeric(12,2),
  optimization_goal   text,
  billing_event       text,
  bid_amount          numeric(10,2),
  targeting          jsonb,
  start_time          timestamptz,
  end_time            timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (campaign_id, meta_adset_id)
);

-- ============================================================
-- ADS
-- ============================================================

create table public.ads (
  id              uuid primary key default uuid_generate_v4(),
  ad_set_id       uuid not null references public.ad_sets(id) on delete cascade,
  meta_ad_id      text not null,
  name            text not null,
  status          text,
  creative_id     uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (ad_set_id, meta_ad_id)
);

-- ============================================================
-- CREATIVES
-- ============================================================

create table public.creatives (
  id                uuid primary key default uuid_generate_v4(),
  ad_account_id     uuid not null references public.ad_accounts(id) on delete cascade,
  meta_creative_id  text not null,
  name              text,
  title             text,
  body              text,
  call_to_action    text,
  image_url         text,
  video_url         text,
  thumbnail_url     text,
  format            text,
  object_type       text,
  ai_analysis       jsonb,
  ai_analyzed_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (ad_account_id, meta_creative_id)
);

-- Add FK from ads to creatives
alter table public.ads add constraint ads_creative_id_fkey
  foreign key (creative_id) references public.creatives(id);

-- ============================================================
-- PERFORMANCE METRICS (daily snapshots per entity)
-- ============================================================

create table public.performance_metrics (
  id              uuid primary key default uuid_generate_v4(),
  entity_type     entity_type not null,
  entity_id       uuid not null,
  date            date not null,
  impressions     bigint default 0,
  clicks          bigint default 0,
  spend           numeric(12,2) default 0,
  conversions     integer default 0,
  conversion_value numeric(12,2) default 0,
  reach           bigint default 0,
  frequency       numeric(6,2) default 0,
  cpm             numeric(10,2),
  cpc             numeric(10,2),
  ctr             numeric(8,4),
  cpa             numeric(10,2),
  roas            numeric(8,2),
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  raw_data        jsonb,
  created_at      timestamptz not null default now(),
  unique (entity_type, entity_id, date)
);

create index idx_perf_entity on public.performance_metrics (entity_type, entity_id);
create index idx_perf_date on public.performance_metrics (date desc);
create index idx_perf_entity_date on public.performance_metrics (entity_type, entity_id, date desc);

-- ============================================================
-- CLIENT HEALTH SCORES
-- ============================================================

create table public.health_scores (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  score           integer not null check (score >= 0 and score <= 100),
  components      jsonb not null default '{}',
  explanation     text,
  trend           text check (trend in ('up', 'down', 'stable')),
  previous_score  integer,
  calculated_at   timestamptz not null default now(),
  date            date not null default current_date,
  unique (client_id, date)
);

create index idx_health_client on public.health_scores (client_id, date desc);

-- ============================================================
-- ALERTS
-- ============================================================

create table public.alerts (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  ad_account_id       uuid references public.ad_accounts(id),
  entity_type         entity_type,
  entity_id           uuid,
  entity_name         text,
  alert_type          alert_type not null,
  severity            alert_severity not null,
  status              alert_status not null default 'open',
  title               text not null,
  description         text not null,
  metric_name         text,
  metric_value        numeric,
  metric_threshold    numeric,
  metric_change_pct   numeric,
  context_data        jsonb default '{}',
  acknowledged_by     uuid references public.profiles(id),
  acknowledged_at     timestamptz,
  resolved_by         uuid references public.profiles(id),
  resolved_at         timestamptz,
  auto_resolved       boolean default false,
  snoozed_until       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_alerts_client on public.alerts (client_id, status, severity);
create index idx_alerts_status on public.alerts (status, severity, created_at desc);
create index idx_alerts_created on public.alerts (created_at desc);

-- ============================================================
-- AI RECOMMENDATIONS
-- ============================================================

create table public.ai_recommendations (
  id                  uuid primary key default uuid_generate_v4(),
  alert_id            uuid references public.alerts(id),
  client_id           uuid not null references public.clients(id) on delete cascade,
  ad_account_id       uuid references public.ad_accounts(id),
  entity_type         entity_type,
  entity_id           uuid,
  entity_name         text,
  action_type         recommendation_action not null,
  title               text not null,
  diagnosis           text not null,
  explanation         text not null,
  recommended_action  text not null,
  expected_impact     text not null,
  confidence_score    numeric(4,2) not null check (confidence_score >= 0 and confidence_score <= 1),
  risk_level          text check (risk_level in ('low', 'medium', 'high')),
  action_params       jsonb not null default '{}',
  status              approval_status not null default 'pending',
  requires_second_approval boolean not null default false,
  first_approved_by   uuid references public.profiles(id),
  first_approved_at   timestamptz,
  second_approved_by  uuid references public.profiles(id),
  second_approved_at  timestamptz,
  rejected_by         uuid references public.profiles(id),
  rejection_reason    text,
  executed_at         timestamptz,
  execution_result    jsonb,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_recs_client on public.ai_recommendations (client_id, status, created_at desc);
create index idx_recs_status on public.ai_recommendations (status, created_at desc);

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================

create table public.ai_conversations (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  client_id     uuid references public.clients(id),
  title         text,
  messages      jsonb not null default '[]',
  context       jsonb default '{}',
  token_count   integer default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_conv_user on public.ai_conversations (user_id, updated_at desc);

-- ============================================================
-- TASKS
-- ============================================================

create table public.tasks (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid references public.clients(id),
  campaign_id         uuid references public.campaigns(id),
  recommendation_id   uuid references public.ai_recommendations(id),
  title               text not null,
  description         text,
  status              task_status not null default 'todo',
  priority            task_priority not null default 'medium',
  assigned_to         uuid references public.profiles(id),
  created_by          uuid not null references public.profiles(id),
  due_date            date,
  completed_at        timestamptz,
  labels              text[] default '{}',
  attachments         jsonb default '[]',
  is_ai_generated     boolean default false,
  parent_task_id      uuid references public.tasks(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_tasks_client on public.tasks (client_id, status, priority);
create index idx_tasks_assigned on public.tasks (assigned_to, status);
create index idx_tasks_due on public.tasks (due_date) where status not in ('done', 'cancelled');

-- ============================================================
-- TASK COMMENTS
-- ============================================================

create table public.task_comments (
  id          uuid primary key default uuid_generate_v4(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references public.profiles(id),
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- REPORTS
-- ============================================================

create table public.reports (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  created_by    uuid not null references public.profiles(id),
  title         text not null,
  type          report_type not null,
  format        report_format not null,
  date_from     date not null,
  date_to       date not null,
  content       jsonb not null default '{}',
  file_url      text,
  file_size     integer,
  status        text not null default 'generating',
  error         text,
  generated_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_reports_client on public.reports (client_id, created_at desc);

-- ============================================================
-- APPROVAL LOG
-- ============================================================

create table public.approval_log (
  id                  uuid primary key default uuid_generate_v4(),
  recommendation_id   uuid not null references public.ai_recommendations(id) on delete cascade,
  user_id             uuid not null references public.profiles(id),
  action              text not null check (action in ('approved', 'rejected', 'executed', 'failed')),
  approval_level      integer not null default 1,
  notes               text,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================

create table public.activity_log (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id),
  client_id       uuid references public.clients(id),
  activity_type   activity_type not null,
  entity_type     text,
  entity_id       uuid,
  entity_name     text,
  description     text not null,
  metadata        jsonb default '{}',
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index idx_activity_user on public.activity_log (user_id, created_at desc);
create index idx_activity_client on public.activity_log (client_id, created_at desc);
create index idx_activity_type on public.activity_log (activity_type, created_at desc);
create index idx_activity_created on public.activity_log (created_at desc);

-- ============================================================
-- MANAGER PREFERENCES (AI learning)
-- ============================================================

create table public.manager_preferences (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  client_id       uuid references public.clients(id),
  preference_key  text not null,
  preference_data jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, client_id, preference_key)
);

-- ============================================================
-- SYNC JOBS
-- ============================================================

create table public.sync_jobs (
  id              uuid primary key default uuid_generate_v4(),
  ad_account_id   uuid not null references public.ad_accounts(id) on delete cascade,
  status          sync_status not null default 'pending',
  triggered_by    uuid references public.profiles(id),
  started_at      timestamptz,
  completed_at    timestamptz,
  records_synced  integer default 0,
  error_message   text,
  metadata        jsonb default '{}',
  created_at      timestamptz not null default now()
);

create index idx_sync_account on public.sync_jobs (ad_account_id, created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ad_accounts for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.campaigns for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ad_sets for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ads for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.creatives for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.alerts for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ai_recommendations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ai_conversations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.manager_preferences for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.ad_sets enable row level security;
alter table public.ads enable row level security;
alter table public.creatives enable row level security;
alter table public.performance_metrics enable row level security;
alter table public.health_scores enable row level security;
alter table public.alerts enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.reports enable row level security;
alter table public.approval_log enable row level security;
alter table public.activity_log enable row level security;
alter table public.manager_preferences enable row level security;
alter table public.sync_jobs enable row level security;

-- Helper: check if user is admin or team_lead
create or replace function public.is_admin_or_lead()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'team_lead')
    and is_active = true
  );
$$;

-- Helper: check if current user is active
create or replace function public.is_active_user()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

-- Profiles: users can read all active profiles, only update their own
create policy "profiles_select" on public.profiles for select using (public.is_active_user());
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin_or_lead());

-- Clients: all active users can view
create policy "clients_select" on public.clients for select using (public.is_active_user());
create policy "clients_write" on public.clients for insert with check (public.is_admin_or_lead());
create policy "clients_update" on public.clients for update using (public.is_admin_or_lead());
create policy "clients_delete" on public.clients for delete using (public.is_admin_or_lead());

-- Ad accounts, campaigns, ad sets, ads, creatives, metrics: active users read
create policy "ad_accounts_select" on public.ad_accounts for select using (public.is_active_user());
create policy "ad_accounts_write" on public.ad_accounts for all using (public.is_admin_or_lead());

create policy "campaigns_select" on public.campaigns for select using (public.is_active_user());
create policy "campaigns_write" on public.campaigns for all using (public.is_admin_or_lead());

create policy "ad_sets_select" on public.ad_sets for select using (public.is_active_user());
create policy "ad_sets_write" on public.ad_sets for all using (public.is_admin_or_lead());

create policy "ads_select" on public.ads for select using (public.is_active_user());
create policy "ads_write" on public.ads for all using (public.is_admin_or_lead());

create policy "creatives_select" on public.creatives for select using (public.is_active_user());
create policy "creatives_write" on public.creatives for all using (public.is_admin_or_lead());

create policy "perf_select" on public.performance_metrics for select using (public.is_active_user());
create policy "perf_write" on public.performance_metrics for all using (public.is_admin_or_lead());

create policy "health_select" on public.health_scores for select using (public.is_active_user());
create policy "health_write" on public.health_scores for all using (public.is_admin_or_lead());

-- Alerts: active users can view; managers+ can update
create policy "alerts_select" on public.alerts for select using (public.is_active_user());
create policy "alerts_write" on public.alerts for all using (public.is_admin_or_lead());

-- AI recommendations: active users view; managers+ act
create policy "recs_select" on public.ai_recommendations for select using (public.is_active_user());
create policy "recs_write" on public.ai_recommendations for all using (public.is_admin_or_lead());

-- Conversations: users own their own
create policy "conv_select" on public.ai_conversations for select using (auth.uid() = user_id);
create policy "conv_write" on public.ai_conversations for all using (auth.uid() = user_id);

-- Tasks
create policy "tasks_select" on public.tasks for select using (public.is_active_user());
create policy "tasks_write" on public.tasks for all using (public.is_active_user());

create policy "task_comments_select" on public.task_comments for select using (public.is_active_user());
create policy "task_comments_write" on public.task_comments for all using (public.is_active_user());

-- Reports
create policy "reports_select" on public.reports for select using (public.is_active_user());
create policy "reports_write" on public.reports for all using (public.is_active_user());

-- Approval log
create policy "approval_select" on public.approval_log for select using (public.is_active_user());
create policy "approval_write" on public.approval_log for insert using (public.is_active_user());

-- Activity log
create policy "activity_select" on public.activity_log for select using (public.is_active_user());
create policy "activity_insert" on public.activity_log for insert using (public.is_active_user());

-- Manager preferences
create policy "prefs_select" on public.manager_preferences for select using (auth.uid() = user_id);
create policy "prefs_write" on public.manager_preferences for all using (auth.uid() = user_id);

-- Sync jobs
create policy "sync_select" on public.sync_jobs for select using (public.is_active_user());
create policy "sync_write" on public.sync_jobs for all using (public.is_admin_or_lead());

-- ============================================================
-- VIEWS
-- ============================================================

-- Client summary view with latest health score
create or replace view public.client_summary as
select
  c.id,
  c.name,
  c.slug,
  c.logo_url,
  c.industry,
  c.currency,
  c.monthly_budget,
  c.target_roas,
  c.target_cpa,
  c.tags,
  c.assigned_managers,
  c.is_active,
  hs.score as health_score,
  hs.trend as health_trend,
  hs.explanation as health_explanation,
  hs.components as health_components,
  hs.calculated_at as health_calculated_at,
  (select count(*) from public.alerts a where a.client_id = c.id and a.status = 'open') as open_alerts_count,
  (select count(*) from public.alerts a where a.client_id = c.id and a.status = 'open' and a.severity = 'critical') as critical_alerts_count,
  (select count(*) from public.ai_recommendations r where r.client_id = c.id and r.status = 'pending') as pending_recommendations_count,
  (select count(*) from public.ad_accounts aa where aa.client_id = c.id and aa.is_active = true) as active_accounts_count
from public.clients c
left join lateral (
  select * from public.health_scores
  where client_id = c.id
  order by date desc limit 1
) hs on true;

-- Performance summary per client (last 30 days via accounts → campaigns)
create or replace view public.account_performance_summary as
select
  aa.client_id,
  aa.id as ad_account_id,
  aa.meta_account_id,
  aa.account_name,
  sum(pm.spend) as total_spend,
  sum(pm.impressions) as total_impressions,
  sum(pm.clicks) as total_clicks,
  sum(pm.conversions) as total_conversions,
  sum(pm.conversion_value) as total_conversion_value,
  case when sum(pm.impressions) > 0 then sum(pm.clicks)::numeric / sum(pm.impressions) * 100 else 0 end as avg_ctr,
  case when sum(pm.clicks) > 0 then sum(pm.spend) / sum(pm.clicks) else 0 end as avg_cpc,
  case when sum(pm.impressions) > 0 then sum(pm.spend) / sum(pm.impressions) * 1000 else 0 end as avg_cpm,
  case when sum(pm.conversions) > 0 then sum(pm.spend) / sum(pm.conversions) else 0 end as avg_cpa,
  case when sum(pm.spend) > 0 then sum(pm.conversion_value) / sum(pm.spend) else 0 end as roas
from public.ad_accounts aa
join public.campaigns c on c.ad_account_id = aa.id
join public.performance_metrics pm on pm.entity_type = 'campaign' and pm.entity_id = c.id
where pm.date >= current_date - interval '30 days'
group by aa.client_id, aa.id, aa.meta_account_id, aa.account_name;
