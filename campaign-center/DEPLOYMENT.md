# Think Digital — Campaign Operations Platform
## Deployment Guide

---

## Prerequisites

- Node.js 20+
- Supabase project (free tier or above)
- Google Gemini API key
- Meta App with Marketing API access (App ID: 4457830191115452)

---

## 1. Supabase Setup

### 1.1 Create Project
1. Go to https://supabase.com and create a new project
2. Choose a region close to Israel (Europe West)
3. Note your Project URL and keys

### 1.2 Run Schema
1. Go to SQL Editor in Supabase dashboard
2. Copy the contents of `supabase/schema.sql`
3. Run the full script

### 1.3 Enable Auth
1. Go to Authentication > Providers
2. Enable Email provider
3. Disable "Confirm email" for internal use (optional)
4. Create first admin user manually in Authentication > Users

### 1.4 Create Admin Profile
After creating the auth user, run in SQL Editor:
```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  '<auth-user-uuid>',
  'admin@thinkdigital.co.il',
  'Admin User',
  'admin'
);
```

---

## 2. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in all values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIzaSy...
META_APP_ID=4457830191115452
META_APP_SECRET=your_app_secret
META_ACCESS_TOKEN=your_long_lived_token
NEXTAUTH_SECRET=generate_with_openssl_rand_-hex_32
NEXTAUTH_URL=https://thinkdigital.co.il/campaign-center
META_WEBHOOK_VERIFY_TOKEN=choose_a_secure_token
ENCRYPTION_KEY=generate_64_char_hex
```

### Generate secrets:
```bash
# NEXTAUTH_SECRET
openssl rand -hex 32

# ENCRYPTION_KEY  
openssl rand -hex 32
```

---

## 3. Meta API Setup

### 3.1 Get Long-Lived Access Token
1. Go to developers.facebook.com
2. Open your app (ID: 4457830191115452)
3. Use Graph API Explorer to get a token
4. Exchange for long-lived token (60 days):

```bash
curl "https://graph.facebook.com/v21.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id=4457830191115452&
  client_secret=YOUR_SECRET&
  fb_exchange_token=SHORT_LIVED_TOKEN"
```

### 3.2 System User (Recommended)
For production, create a System User in Meta Business Manager:
1. Business Settings > Users > System Users
2. Create System User with "Admin" role
3. Add all ad accounts to the system user
4. Generate a token with permissions:
   - `ads_management`
   - `ads_read`
   - `business_management`

### 3.3 Webhook Setup (Optional)
1. In your Meta App, go to Webhooks
2. Add callback URL: `https://thinkdigital.co.il/campaign-center/api/meta/webhook`
3. Verify token: your `META_WEBHOOK_VERIFY_TOKEN` value
4. Subscribe to: `ad_account` events

---

## 4. Install & Run

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Start production
npm start
```

The platform runs at `http://localhost:3000/campaign-center` locally.

---

## 5. Integrate with Existing Website

Since the platform uses `basePath: '/campaign-center'`, you can deploy it as:

### Option A: Subdirectory (Recommended)
Deploy alongside your main Next.js site using `next.config.js` routing:

In your main `thinkdigital.co.il` Next.js app:
```js
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/campaign-center/:path*',
        destination: 'https://campaign-center-app.vercel.app/campaign-center/:path*',
      },
    ]
  },
}
```

### Option B: Same Repository
Copy this into your main repository's `apps/campaign-center` and use a monorepo setup.

### Option C: Vercel Deploy
```bash
vercel deploy
# Then set up rewrites in main site
```

---

## 6. Adding Clients & Ad Accounts

### Via the Platform (once live):
1. Login as admin
2. Go to Settings > Integrations
3. Add ad accounts with their Meta account IDs and access tokens

### Via SQL (initial setup):
```sql
-- Add client
INSERT INTO clients (name, slug, industry, currency, target_roas, target_cpa)
VALUES ('Client Name', 'client-name', 'E-commerce', 'ILS', 3.0, 150.00);

-- Add ad account
INSERT INTO ad_accounts (client_id, meta_account_id, account_name, access_token, currency)
VALUES (
  '<client-uuid>',
  '12345678',  -- Meta account ID (without act_ prefix)
  'Client Name - Main',
  '<access-token>',
  'ILS'
);
```

---

## 7. Daily Sync Schedule

Set up a cron job to sync data and run health checks daily:

### Via Supabase Edge Functions:
Create `supabase/functions/daily-sync/index.ts`:
```typescript
Deno.serve(async () => {
  const response = await fetch('https://thinkdigital.co.il/campaign-center/api/meta/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Deno.env.get('CRON_SECRET') },
    body: JSON.stringify({ sync_all: true }),
  })
  return new Response('OK')
})
```

Schedule in Supabase dashboard: `0 6 * * *` (6 AM daily)

### Via Vercel Cron:
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/meta/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

---

## 8. Health Score Calculation

Health scores are calculated on demand (when a client page is loaded) and stored daily.
To bulk-calculate all scores, run via API:

```bash
# Calculate health for all clients
curl -X POST https://thinkdigital.co.il/campaign-center/api/clients/bulk-health \
  -H "Authorization: Bearer <token>"
```

---

## 9. Performance at Scale (100-150 clients)

The system is built to handle the expected scale:

- **Database**: Supabase with proper indexes handles millions of metric rows
- **API**: Next.js with edge caching for read-heavy endpoints
- **AI**: Gemini requests are on-demand with result caching
- **Meta API**: Rate limiting handled with exponential backoff
- **Real-time**: Supabase real-time for alert notifications

For 150 clients with daily syncs:
- ~4,500 metric rows added daily
- ~135,000 rows monthly
- Query performance maintained by composite indexes

---

## 10. User Management

| Role | Permissions |
|------|-------------|
| Admin | Full access, user management, all approvals |
| Team Lead | All access, approve high-risk actions |
| Campaign Manager | View all, approve regular actions, manage tasks |
| Viewer | Read-only, no approvals |

Create users in Supabase Auth, then set their role in the `profiles` table.

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│          thinkdigital.co.il             │
│                                         │
│  /campaign-center/* → Campaign Platform │
│                                         │
├─────────────────────────────────────────┤
│           Next.js App Router            │
│                                         │
│  Frontend: React + Tailwind + Charts    │
│  Backend: API Routes (Node.js runtime)  │
├──────────────┬──────────────────────────┤
│   Supabase   │      External APIs        │
│              │                           │
│  PostgreSQL  │  Meta Marketing API v21   │
│  Auth (JWT)  │  Google Gemini 1.5 Pro    │
│  Real-time   │                           │
│  Storage     │                           │
└──────────────┴──────────────────────────┘
```

---

## Support

Internal platform for Think Digital. For issues, contact the development team.
