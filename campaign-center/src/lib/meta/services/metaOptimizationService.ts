import type { NormalizedSnapshot } from './metaInsightsService'
import { evaluateAction, type ActionKind } from '@/lib/adpilot/rules'
import type { ApAlertSeverity } from '@/lib/adpilot/types'

// ============================================================
// metaOptimizationService (Phase 5 — placeholder logic, real rule checks)
// ============================================================
// Turns raw performance snapshots into safe, human-reviewable recommendations
// and alerts. It NEVER mutates campaigns directly — every suggestion flows
// through the rules engine and lands as a pending recommendation/alert.

export interface ProposedRecommendation {
  recommendation_type: ActionKind | 'refresh_creative' | 'review'
  title: string
  description: string
  priority: ApAlertSeverity
  metadata: Record<string, unknown>
}

export interface ProposedAlert {
  severity: ApAlertSeverity
  title: string
  message: string
}

export interface OptimizationOutput {
  recommendations: ProposedRecommendation[]
  alerts: ProposedAlert[]
}

export function analyzeSnapshots(
  snapshots: NormalizedSnapshot[],
  ctx: { monthlyBudget: number | null; currentDailyBudget: number | null; targetCpa?: number | null }
): OptimizationOutput {
  const recommendations: ProposedRecommendation[] = []
  const alerts: ProposedAlert[] = []

  for (const s of snapshots) {
    const daysRunning = 7 // placeholder; real impl derives from campaign start
    const data = { daysRunning, impressions: s.impressions, budgetChangesToday: 0 }

    // No delivery → alert (not an automatic action).
    if (s.impressions === 0 && s.spend === 0) {
      alerts.push({
        severity: 'high',
        title: 'Campaign not delivering',
        message: `Campaign ${s.campaign_id ?? ''} had no impressions or spend in the latest snapshot.`,
      })
      continue
    }

    // Strong performer → propose a (capped) budget increase, pending approval.
    const cpaOk = ctx.targetCpa == null || (s.cpa != null && s.cpa <= ctx.targetCpa)
    if (s.roas != null && s.roas >= 2 && cpaOk && ctx.currentDailyBudget) {
      const proposed = Math.round(ctx.currentDailyBudget * 1.2 * 100) / 100
      const evald = evaluateAction('increase_budget', {
        budget: {
          monthlyBudget: ctx.monthlyBudget,
          currentDailyBudget: ctx.currentDailyBudget,
          proposedDailyBudget: proposed,
        },
        data,
      })
      if (evald.allowed) {
        recommendations.push({
          recommendation_type: 'increase_budget',
          title: `Scale a winner (+20% to ${proposed})`,
          description: `ROAS ${s.roas.toFixed(2)} is strong. Suggest raising daily budget from ${ctx.currentDailyBudget} to ${proposed} (within the 20% / monthly caps).`,
          priority: 'medium',
          metadata: { campaign_id: s.campaign_id, proposed, ruleResults: evald.results },
        })
      }
    }

    // Weak performer → propose review/pause, but flag that it needs approval & data.
    if (s.cpa != null && ctx.targetCpa != null && s.cpa > ctx.targetCpa * 2) {
      const evald = evaluateAction('pause_ad', { data })
      recommendations.push({
        recommendation_type: evald.allowed ? 'pause_ad' : 'review',
        title: evald.allowed ? 'Consider pausing an underperformer' : 'Watch an underperformer (needs more data)',
        description: `CPA ${s.cpa.toFixed(2)} is over 2× target ${ctx.targetCpa}. ${
          evald.allowed ? 'Pausing requires your approval.' : evald.results.map((r) => r.reason).join(' ')
        }`,
        priority: evald.allowed ? 'high' : 'low',
        metadata: { campaign_id: s.campaign_id, ruleResults: evald.results },
      })
    }
  }

  return { recommendations, alerts }
}
