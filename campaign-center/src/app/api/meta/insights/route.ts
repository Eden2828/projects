import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMetaConfigured, META_NOT_CONFIGURED_MESSAGE } from '@/lib/meta/services/config'
import { getConnection, getMyBusinessId } from '@/lib/meta/services/connection'
import { fetchInsights } from '@/lib/meta/services/metaInsightsService'

// GET /api/meta/insights?ad_account_id=act_123&date_preset=yesterday  (Phase 5)
// Pulls insights and stores them as performance snapshots.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isMetaConfigured()) {
    return NextResponse.json({ error: META_NOT_CONFIGURED_MESSAGE, configured: false }, { status: 503 })
  }

  const businessId = await getMyBusinessId(supabase, user.id)
  if (!businessId) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const admin = createAdminClient()
  const conn = await getConnection(admin, businessId)
  if (!conn) {
    return NextResponse.json({ error: 'Meta account not connected', connected: false }, { status: 409 })
  }

  const url = new URL(req.url)
  const adAccountId = url.searchParams.get('ad_account_id') || conn.ad_account_id
  const datePreset = url.searchParams.get('date_preset') || 'yesterday'
  if (!adAccountId) {
    return NextResponse.json({ error: 'ad_account_id is required' }, { status: 400 })
  }

  try {
    const snapshots = await fetchInsights(conn.accessToken, adAccountId, datePreset)
    if (snapshots.length) {
      await admin.from('ap_performance_snapshots').insert(
        snapshots.map((s) => ({
          business_id: businessId,
          campaign_id: s.campaign_id,
          date: s.date,
          spend: s.spend,
          impressions: s.impressions,
          clicks: s.clicks,
          leads: s.leads,
          purchases: s.purchases,
          revenue: s.revenue,
          cpa: s.cpa,
          roas: s.roas,
          raw_json: s.raw,
        }))
      )
    }
    return NextResponse.json({ data: snapshots })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch insights' }, { status: 502 })
  }
}
