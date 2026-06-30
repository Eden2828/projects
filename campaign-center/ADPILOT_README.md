# AdPilot — Agency-Grade Meta Ads, Self-Serve & AI-Powered

AdPilot is an MVP SaaS built **inside** the existing Think Digital `campaign-center`
Next.js app. It is mounted at **`/app`** and is completely separate from the
internal agency dashboard at `/campaign-center` (different routes, different
database tables, shared Supabase auth). Nothing in the existing app was changed
except one additive update to `src/middleware.ts`.

**Positioning:** professional, agency-grade management of Meta (Facebook &
Instagram) ad campaigns that business owners run themselves — full control,
transparency, and ownership of their own ad account, with the strategy, creative,
and optimization automated by AI.

A business owner can: sign up → fill an onboarding questionnaire → have Claude
generate a full Meta Ads campaign draft → review it → (admin) review across all
businesses. The architecture is ready for Meta OAuth + Marketing API publishing.

---

## Architecture at a glance

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind + the existing design tokens (`card`, `btn-primary`, …). RTL Hebrew. |
| Auth | Supabase (`@supabase/ssr`), email/password |
| Database | Supabase Postgres, **all tables prefixed `ap_`**, full Row Level Security |
| AI | Anthropic Claude (`claude-opus-4-8`) via `@anthropic-ai/sdk`, structured JSON output + Zod validation |
| Meta | Placeholder services + OAuth routes; live publishing intentionally disabled in MVP |
| Secrets | Server-only env vars; AI/Meta keys never reach the browser; Meta tokens AES-256-GCM encrypted at rest |

### Routes

Pages (under `/app`):
`/app` (public landing) · `/app/login` · `/app/signup` · `/app/dashboard` ·
`/app/onboarding` · `/app/drafts` · `/app/drafts/[id]` · `/app/recommendations` ·
`/app/alerts` · `/app/settings` · `/app/admin` (admin only).

API:
- `POST /api/adpilot/onboarding` — save business + questionnaire
- `POST /api/ai/generate-campaign` — Claude generates + validates + saves a draft
- `PATCH /api/adpilot/recommendations/[id]` — approve/reject (owner or admin)
- `GET /api/meta/auth/start` · `GET /api/meta/auth/callback` — OAuth
- `GET /api/meta/ad-accounts` · `POST /api/meta/publish-campaign` · `GET /api/meta/insights`
- `POST /api/jobs/daily-optimization` — cron-ready (Bearer `CRON_SECRET`)

### Key files

```
src/app/app/**                      AdPilot pages (route group (dashboard) = protected shell)
src/app/api/ai/generate-campaign    Phase 3 — Claude campaign generation
src/app/api/meta/**                 Phase 5 — OAuth + Meta endpoints
src/app/api/jobs/daily-optimization Phase 6 — optimization job
src/lib/adpilot/rules.ts            Phase 4 — safety rules engine
src/lib/adpilot/campaign-schema.ts  AI output Zod + JSON schema
src/lib/anthropic/client.ts         Claude client (reads AI_API_KEY)
src/lib/meta/services/**            metaAuth/Campaign/Insights/Optimization services
src/components/adpilot/**           reusable RTL UI
supabase/adpilot-schema.sql         tables + RLS + admin view + signup trigger
supabase/adpilot-seed.sql           demo data
```

---

## 1. Run locally

```bash
cd campaign-center
npm install
cp .env.example .env.local   # then fill in the values (see §2)
npm run dev                  # http://localhost:3000/app
```

Open **http://localhost:3000/app** for the AdPilot landing page.
(The existing agency dashboard remains at `/campaign-center`.)

## 2. Environment variables

Everything lives in `campaign-center/.env.local`. Required for AdPilot:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser, RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only — privileged writes) |
| `AI_API_KEY` | **Anthropic API key** (campaign generation) |
| `AI_MODEL` | optional, defaults to `claude-opus-4-8` |
| `ENCRYPTION_KEY` | 32-byte hex — encrypts Meta tokens at rest |
| `CRON_SECRET` | Bearer secret for the optimization job |
| `META_APP_ID`, `META_APP_SECRET` | Meta app (optional until you wire Meta) |
| `META_REDIRECT_URI` | e.g. `http://localhost:3000/api/meta/auth/callback` |
| `META_API_VERSION` | e.g. `v21.0` |

Generate secrets:
```bash
# ENCRYPTION_KEY (32-byte hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# CRON_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

If `AI_API_KEY` is missing, `/api/ai/generate-campaign` returns 503.
If Meta vars are missing, the Meta endpoints/UI clearly show
**“Meta integration is not configured yet.”**

## 3. Connect Supabase & run migrations

1. Create a Supabase project (or reuse the existing one — the `ap_` prefix avoids
   collisions with the Campaign Center tables).
2. In the Supabase **SQL Editor**, run:
   - `supabase/adpilot-schema.sql`  (tables, enums, RLS, admin view, signup trigger)
3. (Optional) Enable email auth in **Authentication → Providers**. For fastest
   local testing, turn **off** “Confirm email” so signup logs you in immediately.

The schema is additive and idempotent (`create … if not exists`, guarded enum
creation) — safe to run alongside the existing `supabase/schema.sql`.

## 4. Test the end-to-end MVP flow

1. Go to `/app/signup`, create an account.
2. You land on **onboarding** — fill the questionnaire, save.
3. On the **dashboard**, click **“צור קמפיין עם AI”** (Generate campaign with AI).
   - Claude returns a structured plan → validated with Zod → saved to
     `ap_campaign_drafts`. You’re redirected to the draft detail page.
4. Review ad sets, ads, creative briefs, landing-page rec, risks, and the
   14-day optimization plan.
5. **Admin review:** promote your user to admin and open `/app/admin`:
   ```sql
   update public.ap_users set role = 'admin' where email = 'you@example.com';
   ```
   You’ll see all businesses + pending recommendations with approve/reject.

## 5. Test AI generation directly

```bash
# Must be authenticated — easiest via the UI button. For a raw test, copy the
# Supabase auth cookies from the browser, or call from a logged-in session.
curl -X POST http://localhost:3000/api/ai/generate-campaign \
  -H "Content-Type: application/json" --cookie "<supabase-auth-cookies>" -d '{}'
```
The route loads your business + latest questionnaire answers, calls Claude with a
JSON-schema-constrained output, validates with Zod, caps the daily budget at
`monthly_budget / 30`, and saves the draft.

## 6. Test the optimization job (Phase 6)

```bash
curl -X POST http://localhost:3000/api/jobs/daily-optimization \
  -H "Authorization: Bearer $CRON_SECRET"
```
It reads the latest performance snapshots, runs them through the **safety rules
engine**, and creates **pending** recommendations + alerts. It never performs a
destructive action automatically. Wire it to a scheduler (Vercel Cron / GitHub
Actions / cron-job.org) hitting this URL daily with the Bearer header.

Seed sample snapshots first with `supabase/adpilot-seed.sql` (run after signing up).

## 7. Connect Meta later (development mode)

1. In the [Meta App Dashboard](https://developers.facebook.com/apps/), add the
   **Marketing API** product and set the OAuth redirect URI to your
   `META_REDIRECT_URI`.
2. Fill `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_API_VERSION`.
3. In **Settings → Connect Meta**, click connect. OAuth requests
   `ads_read` + `ads_management`. The token is exchanged for a long-lived token,
   AES-256-GCM-encrypted, and stored in `ap_meta_connections`.
4. `/api/meta/ad-accounts` and `/api/meta/insights` then work for app
   admins/testers. **Live publishing stays a dry-run** (`metaCampaignService.publishCampaign`)
   until you enable it.

> **Meta App Review & Business Verification** are required before using
> `ads_management` with external (non-tester) users in production. The code is
> built to work in **development mode** for app admins/testers first — add your
> Meta account as a tester/admin on the app to use it now.

---

## Safety rules (Phase 4)

`src/lib/adpilot/rules.ts` is the single source of truth:

- Never exceed the monthly budget (also enforced server-side at generation time).
- Never increase a daily budget by more than 20% in one step.
- Never pause an ad before it has enough data (≥3 days / ≥1000 impressions).
- Never make more than one budget change per campaign per day.
- Every recommendation and action is written to `ap_audit_logs`.
- **Any destructive action requires explicit approval** in the MVP — approving a
  recommendation never auto-executes a Meta change yet.

## Security notes

- `AI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET`, and decrypted Meta
  tokens are used **only** in server route handlers / server libs — never imported
  into a `'use client'` module.
- RLS ensures a browser (anon key) can only read/write the signed-in user’s own
  rows; admins additionally get read-all policies. Privileged server writes use the
  service role and bypass RLS after verifying ownership.
- Meta access tokens are encrypted at rest with `ENCRYPTION_KEY`.
