import { META_GRAPH_BASE } from './config'
import type { GeneratedCampaignPlan } from '@/lib/adpilot/types'

// ============================================================
// metaCampaignService (Phase 5 — placeholder)
// ============================================================
// Maps an AdPilot campaign draft to Meta Marketing API objects and (eventually)
// publishes them. In the MVP, full live publishing is intentionally NOT wired:
// `publishCampaign` returns a dry-run preview so the architecture is in place
// without risking real ad spend until credentials + app review are ready.

export interface AdAccountSummary {
  id: string
  name: string
  currency: string
  account_status: number
}

/** Fetch the ad accounts available to a connected Meta user. */
export async function listAdAccounts(accessToken: string): Promise<AdAccountSummary[]> {
  const params = new URLSearchParams({
    fields: 'id,name,currency,account_status',
    access_token: accessToken,
  })
  const res = await fetch(`${META_GRAPH_BASE}/me/adaccounts?${params.toString()}`)
  if (!res.ok) throw new Error(`Meta ad-accounts fetch failed: ${res.status}`)
  const json = (await res.json()) as { data: AdAccountSummary[] }
  return json.data ?? []
}

export interface PublishResult {
  dryRun: boolean
  preview: {
    campaign: { name: string; objective: string; status: string }
    adSets: { name: string; daily_budget: number }[]
    ads: { name: string; headline: string }[]
  }
  message: string
}

/**
 * Translate the AI plan into Meta entities. MVP: dry-run only. When live
 * publishing is enabled, this is where create-campaign / create-adset /
 * create-ad Graph calls go, each gated by the safety rules engine.
 */
export async function publishCampaign(
  _accessToken: string,
  _adAccountId: string,
  plan: GeneratedCampaignPlan
): Promise<PublishResult> {
  return {
    dryRun: true,
    preview: {
      campaign: {
        name: plan.campaign_name,
        objective: plan.recommended_objective,
        status: 'PAUSED', // always create paused; never auto-activate in MVP
      },
      adSets: plan.ad_sets.map((s) => ({
        name: s.ad_set_name,
        daily_budget: plan.budget_recommendation.daily_budget,
      })),
      ads: plan.ads.map((a) => ({ name: a.ad_name, headline: a.headline })),
    },
    message:
      'Dry-run only. Live publishing is disabled in the MVP — campaigns are created PAUSED and require manual review before activation.',
  }
}
