-- ═══════════════════════════════════════════════════════════════════════
-- CAMPAIGN MANAGERS DASHBOARD — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════

-- ── USER PROFILES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name     TEXT,
  role          TEXT DEFAULT 'campaign_manager'
                  CHECK (role IN ('admin', 'campaign_manager')),
  avatar_color  TEXT DEFAULT '#a855f7',
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── CLIENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  meta_ad_account_id  TEXT,
  status              TEXT DEFAULT 'no_data'
                        CHECK (status IN ('healthy','needs_attention','critical','no_data')),
  assigned_user_id    UUID REFERENCES auth.users(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to clients"
  ON clients FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Managers see assigned clients"
  ON clients FOR SELECT USING (assigned_user_id = auth.uid());


-- ── META CONNECTIONS ─────────────────────────────────────────────────────
-- SECURITY NOTE: access_token is stored here for MVP.
-- In production, use Supabase Vault or encrypt before storing.
CREATE TABLE IF NOT EXISTS meta_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id     TEXT NOT NULL,
  access_token      TEXT,          -- ⚠️ encrypt in production
  connection_status TEXT DEFAULT 'connected'
                      CHECK (connection_status IN ('connected','disconnected','error','expired')),
  last_sync_at      TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins manage connections"
  ON meta_connections FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Managers can read their client connections"
  ON meta_connections FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_id AND c.assigned_user_id = auth.uid()
    )
  );


-- ── CAMPAIGN SNAPSHOTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id     TEXT NOT NULL,
  campaign_name   TEXT,
  date            DATE NOT NULL,
  spend           NUMERIC DEFAULT 0,
  results         INTEGER DEFAULT 0,
  cpa             NUMERIC,
  roas            NUMERIC,
  ctr             NUMERIC,
  cpm             NUMERIC,
  frequency       NUMERIC,
  impressions     INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  raw_data_json   JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, campaign_id, date)
);

ALTER TABLE campaign_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read snapshots for their clients"
  ON campaign_snapshots FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_id
      AND (c.assigned_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
    )
  );

CREATE POLICY "Service role can insert snapshots"
  ON campaign_snapshots FOR INSERT WITH CHECK (true);


-- ── TASKS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID REFERENCES clients(id) ON DELETE CASCADE,
  related_entity_type TEXT,   -- 'campaign' | 'adset' | 'ad' | null
  related_entity_id   TEXT,
  title               TEXT NOT NULL,
  description         TEXT,
  priority            TEXT DEFAULT 'medium'
                        CHECK (priority IN ('low','medium','high','urgent')),
  status              TEXT DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','done')),
  assigned_user_id    UUID REFERENCES auth.users(id),
  due_date            DATE,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tasks for their clients"
  ON tasks FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_id
      AND (c.assigned_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
    )
  );


-- ── AI RECOMMENDATIONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID REFERENCES clients(id) ON DELETE CASCADE,
  related_entity_type TEXT,
  related_entity_id   TEXT,
  title               TEXT NOT NULL,
  explanation         TEXT,
  severity            TEXT DEFAULT 'medium'
                        CHECK (severity IN ('low','medium','high','critical')),
  suggested_action    TEXT,
  related_metric      TEXT,
  confidence          NUMERIC CHECK (confidence BETWEEN 0 AND 100),
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','dismissed','executed')),
  raw_ai_response     JSONB,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage recommendations for their clients"
  ON ai_recommendations FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_id
      AND (c.assigned_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
    )
  );


-- ── AI ACTION LOGS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_action_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES ai_recommendations(id),
  approved_by       UUID REFERENCES auth.users(id),
  action_type       TEXT NOT NULL,
  action_payload    JSONB,
  status            TEXT DEFAULT 'pending'
                      CHECK (status IN ('pending','executing','success','failed')),
  result_message    TEXT,
  executed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage action logs for their clients"
  ON ai_action_logs FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ai_recommendations r
      JOIN clients c ON c.id = r.client_id
      WHERE r.id = recommendation_id
      AND (c.assigned_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
    )
  );


-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at        BEFORE UPDATE ON clients        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tasks_updated_at          BEFORE UPDATE ON tasks          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ai_recommendations_upd    BEFORE UPDATE ON ai_recommendations FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── SEED: FIRST ADMIN USER ────────────────────────────────────────────────
-- After signing up your first user via Supabase Auth, run this to make them admin:
-- UPDATE user_profiles SET role = 'admin' WHERE user_id = 'YOUR-USER-UUID-HERE';
