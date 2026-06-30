import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeSnapshots } from '@/lib/meta/services/metaOptimizationService'
import type { NormalizedSnapshot } from '@/lib/meta/services/metaInsightsService'
import { logAudit } from '@/lib/adpilot/audit'

export const maxDuration = 60

// ============================================================
// POST /api/jobs/daily-optimization   (Phase 6)
// Cron-ready. Auth: `Authorization: Bearer <CRON_SECRET>`.
// Pulls latest snapshots, compares to rules, creates recommendations + alerts.
// NEVER performs destructive actions automatically — everything is pending review.
// ============================================================
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') || ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // All businesses that have at least one performance snapshot.
  const { data: businesses } = await admin
    .from('ap_businesses')
    .select('id, monthly_budget')

  let recoCount = 0
  let alertCount = 0
  const processed: string[] = []

  for (const biz of businesses ?? []) {
    // Latest snapshot per campaign (most recent date first, take up to 50 rows).
    const { data: snaps } = await admin
      .from('ap_performance_snapshots')
      .select('*')
      .eq('business_id', biz.id)
      .order('date', { ascending: false })
      .limit(50)

    if (!snaps || snaps.length === 0) continue

    // Deduplicate to the latest row per campaign_id.
    const latestByCampaign = new Map<string, any>()
    for (const s of snaps) {
      const key = s.campaign_id ?? '_none'
      if (!latestByCampaign.has(key)) latestByCampaign.set(key, s)
    }

    const normalized: NormalizedSnapshot[] = [...latestByCampaign.values()].map((s) => ({
      campaign_id: s.campaign_id,
      date: s.date,
      spend: Number(s.spend) || 0,
      impressions: Number(s.impressions) || 0,
      clicks: Number(s.clicks) || 0,
      leads: Number(s.leads) || 0,
      purchases: Number(s.purchases) || 0,
      revenue: Number(s.revenue) || 0,
      cpa: s.cpa != null ? Number(s.cpa) : null,
      roas: s.roas != null ? Number(s.roas) : null,
      raw: s.raw_json,
    }))

    // Current daily budget: take the latest draft's daily budget as a proxy.
    const { data: latestDraft } = await admin
      .from('ap_campaign_drafts')
      .select('daily_budget')
      .eq('business_id', biz.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { recommendations, alerts } = analyzeSnapshots(normalized, {
      monthlyBudget: biz.monthly_budget != null ? Number(biz.monthly_budget) : null,
      currentDailyBudget: latestDraft?.daily_budget != null ? Number(latestDraft.daily_budget) : null,
    })

    if (recommendations.length) {
      await admin.from('ap_recommendations').insert(
        recommendations.map((r) => ({
          business_id: biz.id,
          recommendation_type: r.recommendation_type,
          title: r.title,
          description: r.description,
          priority: r.priority,
          status: 'pending',
          metadata_json: r.metadata,
        }))
      )
      recoCount += recommendations.length
    }

    if (alerts.length) {
      await admin.from('ap_alerts').insert(
        alerts.map((a) => ({
          business_id: biz.id,
          severity: a.severity,
          title: a.title,
          message: a.message,
          status: 'open',
        }))
      )
      alertCount += alerts.length
    }

    await logAudit(admin, {
      businessId: biz.id,
      actorType: 'system',
      action: 'daily_optimization_run',
      metadata: { recommendations: recommendations.length, alerts: alerts.length },
    })
    processed.push(biz.id)
  }

  return NextResponse.json({
    ok: true,
    processed_businesses: processed.length,
    recommendations_created: recoCount,
    alerts_created: alertCount,
  })
}
