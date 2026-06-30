-- ============================================================
-- AdPilot — Grants fix
-- ============================================================
-- Supabase's API roles (anon, authenticated, service_role) need table-level
-- GRANTs in addition to RLS policies. If tables were created without the
-- default-privilege grants firing, every query fails with "permission denied".
-- This block (safe to re-run) restores access. RLS still enforces row security.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
