import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── ENV ────────────────────────────────────────────────────────────────────
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const META_APP_ID      = Deno.env.get('META_APP_ID') || ''
const META_APP_SECRET  = Deno.env.get('META_APP_SECRET') || ''
const META_VER         = 'v20.0'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ── SUPABASE CLIENT (service role — bypasses RLS) ──────────────────────────
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// ── META HELPER ────────────────────────────────────────────────────────────
async function metaFetch(endpoint: string, params: Record<string, string>, token: string) {
  const qs  = new URLSearchParams({ ...params, access_token: token }).toString()
  const res = await fetch(`https://graph.facebook.com/${META_VER}/${endpoint}?${qs}`)
  const data = await res.json()
  if (data.error) {
    const e = data.error
    if (e.code === 190) throw Object.assign(new Error('META_TOKEN_EXPIRED'), { code: 'TOKEN_EXPIRED' })
    if (e.code === 17)  throw Object.assign(new Error('META_RATE_LIMIT'),    { code: 'RATE_LIMIT' })
    throw new Error(e.message || 'Meta API error')
  }
  return data
}

const INSIGHT_FIELDS = [
  'spend','impressions','clicks','reach',
  'ctr','cpm','frequency',
  'actions','cost_per_action_type','purchase_roas',
].join(',')

function buildDateParams(preset: string, date_from: string, date_to: string): Record<string, string> {
  const MAP: Record<string, string> = {
    today: 'today', last7: 'last_7d', last14: 'last_14d',
    thisMonth: 'this_month', last30: 'last_30d',
  }
  if (preset && preset !== 'custom' && MAP[preset]) return { date_preset: MAP[preset] }
  if (date_from && date_to) return { time_range: JSON.stringify({ since: date_from, until: date_to }) }
  return { date_preset: 'last_7d' }
}

// ── AUTH HELPER — returns user_id from JWT ─────────────────────────────────
async function getUserId(req: Request): Promise<string | null> {
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  if (!jwt) return null
  const { data: { user } } = await sb.auth.getUser(jwt)
  return user?.id || null
}

// ── TOKEN HELPER — looks up stored Meta token for a user ──────────────────
async function getUserToken(userId: string): Promise<string | null> {
  const { data, error } = await sb
    .from('user_meta_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .limit(1)
    .single()
  if (error || !data) return null
  return data.access_token
}

// ── MAIN ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // Route = last segment of URL path, e.g. /functions/v1/meta/accounts → "accounts"
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop() || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* no body */ }

  const { client_id, campaign_id, adset_id, preset = '', date_from = '', date_to = '', token } = body

  try {
    // ── CONNECT: exchange short-lived FB token → long-lived, save to DB ──
    if (route === 'connect') {
      const userId = await getUserId(req)
      if (!userId) return json({ error: 'Unauthorized' }, 401)
      if (!token)  return json({ error: 'token required' }, 400)

      let finalToken = token
      if (META_APP_ID && META_APP_SECRET) {
        try {
          const r = await fetch(
            `https://graph.facebook.com/${META_VER}/oauth/access_token` +
            `?grant_type=fb_exchange_token&client_id=${META_APP_ID}` +
            `&client_secret=${META_APP_SECRET}&fb_exchange_token=${token}`
          )
          const d = await r.json()
          if (d.access_token) finalToken = d.access_token
        } catch { /* keep short-lived as fallback */ }
      }

      const { error } = await sb.from('user_meta_tokens').upsert(
        { user_id: userId, access_token: finalToken, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    // ── ACCOUNTS: list all ad accounts for the logged-in user ─────────────
    if (route === 'accounts') {
      const userId = await getUserId(req)
      if (!userId) return json({ error: 'Unauthorized' }, 401)

      const tk = await getUserToken(userId)
      if (!tk) return json({ error: 'META_NOT_CONNECTED' }, 404)

      const dp = buildDateParams(preset, date_from, date_to)
      const datePreset = dp.date_preset || 'last_7d'

      const data = await metaFetch('me/adaccounts', {
        fields: `id,name,account_status,currency,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}`,
        limit: '200',
      }, tk)
      return json(data)
    }

    // ── All other routes: need client_id (Meta ad account ID) + user token ─
    if (!client_id) return json({ error: 'client_id required' }, 400)

    const userId = await getUserId(req)
    if (!userId) return json({ error: 'Unauthorized' }, 401)

    const access_token = await getUserToken(userId)
    if (!access_token) return json({ error: 'META_NOT_CONNECTED' }, 404)

    const adAccountId = client_id.toString().replace('act_', '')
    const dateParams  = buildDateParams(preset, date_from, date_to)
    const dp          = dateParams.date_preset || 'last_7d'

    // ── INSIGHTS ──────────────────────────────────────────────────────────
    if (route === 'insights') {
      const data = await metaFetch(`act_${adAccountId}/insights`,
        { fields: INSIGHT_FIELDS, ...dateParams }, access_token)
      return json(data)
    }

    // ── CAMPAIGNS ─────────────────────────────────────────────────────────
    if (route === 'campaigns') {
      const data = await metaFetch(`act_${adAccountId}/campaigns`, {
        fields: `id,name,status,objective,daily_budget,lifetime_budget,` +
                `insights.date_preset(${dp}){${INSIGHT_FIELDS}}`,
        limit: '100',
        ...(dateParams.time_range ? dateParams : {}),
      }, access_token)
      return json(data)
    }

    // ── ADSETS ────────────────────────────────────────────────────────────
    if (route === 'adsets') {
      const endpoint = campaign_id ? `${campaign_id}/adsets` : `act_${adAccountId}/adsets`
      const data = await metaFetch(endpoint, {
        fields: `id,name,status,daily_budget,lifetime_budget,targeting,` +
                `insights.date_preset(${dp}){${INSIGHT_FIELDS}}`,
        limit: '100',
      }, access_token)
      return json(data)
    }

    // ── ADS ───────────────────────────────────────────────────────────────
    if (route === 'ads') {
      const endpoint = adset_id    ? `${adset_id}/ads`    :
                       campaign_id ? `${campaign_id}/ads` :
                       `act_${adAccountId}/ads`
      const data = await metaFetch(endpoint, {
        fields: `id,name,status,` +
                `creative{id,name,title,body,image_url,thumbnail_url,` +
                `video_id,object_story_spec,asset_feed_spec},` +
                `insights.date_preset(${dp}){${INSIGHT_FIELDS}}`,
        limit: '100',
      }, access_token)
      return json(data)
    }

    // ── SYNC: save campaign snapshots for AI ──────────────────────────────
    if (route === 'sync') {
      const campaigns = await metaFetch(`act_${adAccountId}/campaigns`, {
        fields: `id,name,insights.date_preset(last_7d){${INSIGHT_FIELDS},date_start,date_stop}`,
        limit: '100',
      }, access_token)

      let saved = 0
      for (const camp of (campaigns.data || [])) {
        const ins = camp.insights?.data?.[0]
        if (!ins) continue
        const actions  = (ins.actions || []) as Array<{ value: string }>
        const results  = actions.reduce((s, a) => s + parseInt(a.value || '0', 10), 0)
        const cpa      = results > 0 ? parseFloat(ins.spend) / results : null
        const roasArr  = (ins.purchase_roas || []) as Array<{ value: string }>
        const roas     = roasArr[0] ? parseFloat(roasArr[0].value) : null

        await sb.from('campaign_snapshots').upsert({
          client_id:     client_id,
          campaign_id:   camp.id,
          campaign_name: camp.name,
          date:          ins.date_start,
          spend:         parseFloat(ins.spend || '0'),
          results, cpa, roas,
          ctr:           parseFloat(ins.ctr       || '0'),
          cpm:           parseFloat(ins.cpm       || '0'),
          frequency:     parseFloat(ins.frequency || '0'),
          impressions:   parseInt(ins.impressions || '0', 10),
          clicks:        parseInt(ins.clicks      || '0', 10),
          reach:         parseInt(ins.reach       || '0', 10),
          raw_data_json: ins,
        }, { onConflict: 'client_id,campaign_id,date' })
        saved++
      }
      return json({ ok: true, saved })
    }

    return json({ error: `Unknown route: ${route}` }, 404)

  } catch (err: unknown) {
    const e = err as { message?: string; code?: string }
    console.error('[meta fn]', route, e.message)
    const status = e.code === 'TOKEN_EXPIRED' ? 401 : e.code === 'RATE_LIMIT' ? 429 : 500
    return json({ error: e.message || 'Server error' }, status)
  }
})
