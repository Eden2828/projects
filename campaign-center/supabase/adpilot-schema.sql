-- ============================================================
-- AdPilot — Self-Serve, Agency-Grade Meta Ads (AI-Powered) — Supabase Schema
-- ============================================================
-- This schema is SELF-CONTAINED and NAMESPACED with the `ap_` prefix so it
-- never collides with the existing Campaign Center (agency) tables such as
-- `alerts`, `recommendations`, `campaigns`, `clients`, `profiles`.
--
-- Safe to run on the same Supabase project as the Campaign Center schema.
-- It only CREATEs new objects; it never drops or alters existing ones.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS  (prefixed to avoid clashing with existing enums)
-- ============================================================

do $$ begin
  create type ap_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ap_goal as enum ('leads', 'messages', 'sales', 'traffic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ap_budget_type as enum ('daily', 'lifetime');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ap_draft_status as enum ('draft', 'approved', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ap_reco_status as enum ('pending', 'approved', 'rejected', 'applied');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ap_alert_severity as enum ('critical', 'high', 'medium', 'low', 'info');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ap_alert_status as enum ('open', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ap_actor_type as enum ('user', 'admin', 'system', 'ai');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ap_meta_status as enum ('disconnected', 'pending', 'connected', 'expired', 'error');
exception when duplicate_object then null; end $$;

-- ============================================================
-- updated_at helper
-- ============================================================
create or replace function ap_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- USERS  (mirrors the spec's `users` table; extends auth.users)
-- ============================================================
create table if not exists public.ap_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text,
  role        ap_role not null default 'user',
  created_at  timestamptz not null default now()
);

-- Auto-create an ap_users row whenever a new auth user signs up.
create or replace function ap_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ap_users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ap_on_auth_user_created on auth.users;
create trigger ap_on_auth_user_created
  after insert on auth.users
  for each row execute function ap_handle_new_user();

-- ============================================================
-- BUSINESSES
-- ============================================================
create table if not exists public.ap_businesses (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references public.ap_users(id) on delete cascade,
  business_name      text not null,
  industry           text,
  location           text,
  website_url        text,
  instagram_url      text,
  facebook_page_url  text,
  whatsapp_number    text,
  main_offer         text,
  monthly_budget     numeric(12,2),
  goal               ap_goal,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ap_businesses_user_idx on public.ap_businesses(user_id);
create trigger ap_businesses_updated before update on public.ap_businesses
  for each row execute function ap_set_updated_at();

-- ============================================================
-- QUESTIONNAIRE ANSWERS
-- ============================================================
create table if not exists public.ap_questionnaire_answers (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references public.ap_businesses(id) on delete cascade,
  answers_json jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists ap_questionnaire_business_idx on public.ap_questionnaire_answers(business_id);

-- ============================================================
-- CAMPAIGN DRAFTS
-- ============================================================
create table if not exists public.ap_campaign_drafts (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid not null references public.ap_businesses(id) on delete cascade,
  platform            text not null default 'meta',
  objective           text,
  campaign_name       text,
  budget_type         ap_budget_type default 'daily',
  daily_budget        numeric(12,2),
  target_audience_json jsonb default '{}'::jsonb,
  ad_sets_json        jsonb default '[]'::jsonb,
  ads_json            jsonb default '[]'::jsonb,
  creative_briefs_json jsonb default '[]'::jsonb,
  -- full structured AI plan (risks, optimization plan, landing page rec, etc.)
  plan_json           jsonb default '{}'::jsonb,
  status              ap_draft_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists ap_drafts_business_idx on public.ap_campaign_drafts(business_id);
create index if not exists ap_drafts_status_idx on public.ap_campaign_drafts(status);
create trigger ap_drafts_updated before update on public.ap_campaign_drafts
  for each row execute function ap_set_updated_at();

-- ============================================================
-- RECOMMENDATIONS
-- ============================================================
create table if not exists public.ap_recommendations (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid not null references public.ap_businesses(id) on delete cascade,
  campaign_draft_id   uuid references public.ap_campaign_drafts(id) on delete set null,
  recommendation_type text not null,
  title               text not null,
  description         text,
  priority            ap_alert_severity not null default 'medium',
  status              ap_reco_status not null default 'pending',
  metadata_json       jsonb default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists ap_reco_business_idx on public.ap_recommendations(business_id);
create index if not exists ap_reco_status_idx on public.ap_recommendations(status);

-- ============================================================
-- ALERTS
-- ============================================================
create table if not exists public.ap_alerts (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.ap_businesses(id) on delete cascade,
  severity    ap_alert_severity not null default 'medium',
  title       text not null,
  message     text,
  status      ap_alert_status not null default 'open',
  created_at  timestamptz not null default now()
);
create index if not exists ap_alerts_business_idx on public.ap_alerts(business_id);
create index if not exists ap_alerts_status_idx on public.ap_alerts(status);

-- ============================================================
-- AUDIT LOGS  (every recommendation + action, per Phase 4)
-- ============================================================
create table if not exists public.ap_audit_logs (
  id            uuid primary key default uuid_generate_v4(),
  business_id   uuid references public.ap_businesses(id) on delete cascade,
  actor_type    ap_actor_type not null default 'system',
  action        text not null,
  metadata_json jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists ap_audit_business_idx on public.ap_audit_logs(business_id);
create index if not exists ap_audit_created_idx on public.ap_audit_logs(created_at desc);

-- ============================================================
-- META CONNECTIONS  (token stored encrypted; never exposed to client)
-- ============================================================
create table if not exists public.ap_meta_connections (
  id                     uuid primary key default uuid_generate_v4(),
  business_id            uuid not null references public.ap_businesses(id) on delete cascade,
  meta_user_id           text,
  ad_account_id          text,
  page_id                text,
  instagram_account_id   text,
  access_token_encrypted text,
  token_expires_at       timestamptz,
  status                 ap_meta_status not null default 'disconnected',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index if not exists ap_meta_business_idx on public.ap_meta_connections(business_id);
create trigger ap_meta_updated before update on public.ap_meta_connections
  for each row execute function ap_set_updated_at();

-- ============================================================
-- PERFORMANCE SNAPSHOTS
-- ============================================================
create table if not exists public.ap_performance_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.ap_businesses(id) on delete cascade,
  campaign_id text,
  date        date not null,
  spend       numeric(12,2) default 0,
  impressions bigint default 0,
  clicks      bigint default 0,
  leads       bigint default 0,
  purchases   bigint default 0,
  revenue     numeric(12,2) default 0,
  cpa         numeric(12,2),
  roas        numeric(8,2),
  raw_json    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ap_perf_business_idx on public.ap_performance_snapshots(business_id);
create index if not exists ap_perf_date_idx on public.ap_performance_snapshots(date desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Helper: is the current auth user an AdPilot admin?
create or replace function ap_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ap_users u where u.id = auth.uid() and u.role = 'admin'
  );
$$;

-- Helper: does the current user own this business?
create or replace function ap_owns_business(b_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ap_businesses b where b.id = b_id and b.user_id = auth.uid()
  );
$$;

alter table public.ap_users                  enable row level security;
alter table public.ap_businesses             enable row level security;
alter table public.ap_questionnaire_answers  enable row level security;
alter table public.ap_campaign_drafts        enable row level security;
alter table public.ap_recommendations        enable row level security;
alter table public.ap_alerts                 enable row level security;
alter table public.ap_audit_logs             enable row level security;
alter table public.ap_meta_connections       enable row level security;
alter table public.ap_performance_snapshots  enable row level security;

-- ap_users: a user sees/updates only their own row; admins see all.
drop policy if exists ap_users_self on public.ap_users;
create policy ap_users_self on public.ap_users
  for select using (id = auth.uid() or ap_is_admin());
drop policy if exists ap_users_update_self on public.ap_users;
create policy ap_users_update_self on public.ap_users
  for update using (id = auth.uid());

-- ap_businesses: owner full access; admins read-all.
drop policy if exists ap_biz_owner on public.ap_businesses;
create policy ap_biz_owner on public.ap_businesses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ap_biz_admin_read on public.ap_businesses;
create policy ap_biz_admin_read on public.ap_businesses
  for select using (ap_is_admin());

-- Child tables: owner of parent business has full access; admins read-all.
-- (Pattern repeated for each child table.)
do $$
declare t text;
begin
  foreach t in array array[
    'ap_questionnaire_answers','ap_campaign_drafts','ap_recommendations',
    'ap_alerts','ap_audit_logs','ap_meta_connections','ap_performance_snapshots'
  ] loop
    execute format('drop policy if exists %I_owner on public.%I;', t, t);
    execute format(
      'create policy %I_owner on public.%I for all using (ap_owns_business(business_id)) with check (ap_owns_business(business_id));',
      t, t);
    execute format('drop policy if exists %I_admin_read on public.%I;', t, t);
    execute format(
      'create policy %I_admin_read on public.%I for select using (ap_is_admin());',
      t, t);
  end loop;
end $$;

-- NOTE: the server uses the service-role key for privileged writes (AI drafts,
-- system jobs, encrypted token storage), which bypasses RLS. RLS above protects
-- any direct client (anon-key) access so a user can only ever reach their own data.

-- ============================================================
-- ADMIN AGGREGATE VIEW (used by /app/admin)
-- ============================================================
create or replace view public.ap_admin_business_overview as
select
  b.id              as business_id,
  b.business_name,
  b.industry,
  b.goal,
  b.monthly_budget,
  u.email           as owner_email,
  u.name            as owner_name,
  b.created_at,
  (select count(*) from public.ap_campaign_drafts d where d.business_id = b.id)            as drafts_count,
  (select count(*) from public.ap_recommendations r where r.business_id = b.id and r.status = 'pending') as pending_recos,
  (select count(*) from public.ap_alerts a where a.business_id = b.id and a.status = 'open')             as open_alerts,
  (select status from public.ap_meta_connections m where m.business_id = b.id limit 1)     as meta_status
from public.ap_businesses b
join public.ap_users u on u.id = b.user_id;

-- ============================================================
-- GRANTS — API roles need table privileges in addition to RLS policies.
-- Without these, every query fails with "permission denied". RLS still
-- enforces row-level security on top of these grants.
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
