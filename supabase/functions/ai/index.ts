import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── ENV ────────────────────────────────────────────────────────────────────
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY   = Deno.env.get('ANTHROPIC_API_KEY') || ''
const OPENAI_KEY      = Deno.env.get('OPENAI_API_KEY')    || ''

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

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

async function getUserId(req: Request): Promise<string | null> {
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  if (!jwt) return null
  const { data: { user } } = await sb.auth.getUser(jwt)
  return user?.id || null
}

// ── PROMPT ────────────────────────────────────────────────────────────────
function buildPrompt(insights: unknown, campaigns: Array<Record<string, unknown>>) {
  const top = (campaigns || []).slice(0, 8).map(c => ({
    name: c.name, spend: c.spend, results: c.results,
    cpa: c.cpa, ctr: c.ctr, frequency: c.frequency,
  }))
  return `You are an expert Meta Ads campaign manager. Analyze the data and return 3-5 actionable recommendations.

ACCOUNT INSIGHTS (last 7 days):
${JSON.stringify(insights || {}, null, 2)}

TOP CAMPAIGNS:
${JSON.stringify(top, null, 2)}

Reply with ONLY a valid JSON array (no markdown, no other text):
[
  {
    "title": "Short action title (Hebrew is fine)",
    "explanation": "2-3 sentence explanation (Hebrew is fine)",
    "severity": "low|medium|high|critical",
    "suggested_action": "Specific actionable step",
    "confidence": <integer 0-100>,
    "related_metric": "cpa|roas|ctr|frequency|spend|results|cpm"
  }
]`
}

function mockRecs() {
  return [
    { title: 'CPA עלה השבוע',  explanation: 'עלות לתוצאה עלתה ב-24%. בדוק קריאייטיבים וחלוקת תקציב.', severity: 'high',   suggested_action: 'עצור קמפיינים עם CPA גבוה מהממוצע', confidence: 85, related_metric: 'cpa' },
    { title: 'תדירות גבוהה',   explanation: 'תדירות מעל 4 — סימן לעייפות קריאייטיבית.',               severity: 'medium', suggested_action: 'רענן קריאייטיבים או הרחב קהלים',      confidence: 78, related_metric: 'frequency' },
    { title: 'CTR נמוך',       explanation: 'אחוז הקלקה מתחת לממוצע ענפי.',                           severity: 'medium', suggested_action: 'בדוק קופי ועצב מודעה עם CTA חזק יותר', confidence: 70, related_metric: 'ctr' },
  ]
}

async function generateRecommendations(insights: unknown, campaigns: Array<Record<string, unknown>>) {
  const prompt = buildPrompt(insights, campaigns)

  if (ANTHROPIC_KEY) {
    try {
      const res  = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const text = data?.content?.[0]?.text || '[]'
      return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]')
    } catch { return mockRecs() }
  }

  if (OPENAI_KEY) {
    try {
      const res  = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content || '[]'
      return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]')
    } catch { return mockRecs() }
  }

  return mockRecs()
}

// ── MAIN ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop() || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* no body */ }

  try {
    if (route === 'analyze') {
      const userId = await getUserId(req)
      if (!userId) return json({ error: 'Unauthorized' }, 401)

      const { client_id, insights, campaigns } = body
      if (!client_id) return json({ error: 'client_id required' }, 400)

      const recs = await generateRecommendations(insights, campaigns)

      // Dismiss old pending recs for this client
      await sb.from('ai_recommendations')
        .update({ status: 'dismissed' })
        .eq('client_id', client_id)
        .eq('status', 'pending')

      // Insert new ones
      const saved = []
      for (const r of recs) {
        const { data } = await sb
          .from('ai_recommendations')
          .insert({ client_id, ...r, status: 'pending' })
          .select()
          .single()
        if (data) saved.push(data)
      }

      return json({ recommendations: saved })
    }

    return json({ error: `Unknown route: ${route}` }, 404)

  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('[ai fn]', route, e.message)
    return json({ error: e.message || 'Server error' }, 500)
  }
})
