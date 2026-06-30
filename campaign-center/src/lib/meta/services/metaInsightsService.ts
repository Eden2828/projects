import { META_GRAPH_BASE } from './config'

// ============================================================
// metaInsightsService (Phase 5 — placeholder)
// ============================================================
// Pulls performance insights for a connected ad account and normalizes them into
// the shape stored in ap_performance_snapshots.

export interface NormalizedSnapshot {
  campaign_id: string | null
  date: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  purchases: number
  revenue: number
  cpa: number | null
  roas: number | null
  raw: unknown
}

export async function fetchInsights(
  accessToken: string,
  adAccountId: string,
  datePreset = 'yesterday'
): Promise<NormalizedSnapshot[]> {
  const params = new URLSearchParams({
    level: 'campaign',
    date_preset: datePreset,
    fields: 'campaign_id,spend,impressions,clicks,actions,action_values',
    access_token: accessToken,
  })
  const res = await fetch(`${META_GRAPH_BASE}/${adAccountId}/insights?${params.toString()}`)
  if (!res.ok) throw new Error(`Meta insights fetch failed: ${res.status}`)
  const json = (await res.json()) as { data: any[] }
  return (json.data ?? []).map(normalize)
}

function actionValue(actions: any[] | undefined, type: string): number {
  if (!actions) return 0
  const found = actions.find((a) => a.action_type === type)
  return found ? Number(found.value) || 0 : 0
}

function normalize(row: any): NormalizedSnapshot {
  const spend = Number(row.spend) || 0
  const leads = actionValue(row.actions, 'lead')
  const purchases = actionValue(row.actions, 'purchase')
  const revenue = actionValue(row.action_values, 'purchase')
  const conversions = leads + purchases
  return {
    campaign_id: row.campaign_id ?? null,
    date: new Date().toISOString().slice(0, 10),
    spend,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    leads,
    purchases,
    revenue,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: spend > 0 ? revenue / spend : null,
    raw: row,
  }
}
