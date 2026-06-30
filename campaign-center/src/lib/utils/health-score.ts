import type { HealthScoreComponents, PerformanceMetrics, Client } from '@/types'

interface HealthScoreInput {
  client: Client
  metrics: PerformanceMetrics[] // last 7-30 days
  alerts: Array<{ alert_type: string; severity: string }>
  rejectedAdsCount: number
  billingStatus: 'ok' | 'warning' | 'critical'
  previousScore?: number
}

export function calculateHealthScore(input: HealthScoreInput): {
  score: number
  components: HealthScoreComponents
  trend: 'up' | 'down' | 'stable'
} {
  const { client, metrics, alerts, rejectedAdsCount, billingStatus } = input

  // Aggregate metrics
  const recentMetrics = metrics.slice(0, 7)
  const olderMetrics = metrics.slice(7, 14)

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0

  const avgCpa = avg(recentMetrics.filter(m => m.cpa).map(m => m.cpa!))
  const avgCtr = avg(recentMetrics.filter(m => m.ctr).map(m => m.ctr!))
  const avgCpm = avg(recentMetrics.filter(m => m.cpm).map(m => m.cpm!))
  const avgRoas = avg(recentMetrics.filter(m => m.roas).map(m => m.roas!))
  const avgFrequency = avg(recentMetrics.filter(m => m.frequency).map(m => m.frequency))

  const oldAvgCpa = avg(olderMetrics.filter(m => m.cpa).map(m => m.cpa!))
  const oldAvgRoas = avg(olderMetrics.filter(m => m.roas).map(m => m.roas!))

  // CPA Score (weight: 25)
  let cpaScore = 100
  if (client.target_cpa && avgCpa > 0) {
    const ratio = avgCpa / client.target_cpa
    if (ratio <= 0.8) cpaScore = 100
    else if (ratio <= 1.0) cpaScore = 90
    else if (ratio <= 1.2) cpaScore = 75
    else if (ratio <= 1.5) cpaScore = 55
    else if (ratio <= 2.0) cpaScore = 30
    else cpaScore = 10
  } else if (avgCpa > 0) {
    cpaScore = 70 // No target set
  }

  // CTR Score (weight: 15)
  let ctrScore = 100
  const ctrPct = avgCtr * 100
  if (ctrPct >= 3.0) ctrScore = 100
  else if (ctrPct >= 2.0) ctrScore = 85
  else if (ctrPct >= 1.0) ctrScore = 70
  else if (ctrPct >= 0.5) ctrScore = 50
  else if (ctrPct >= 0.2) ctrScore = 30
  else ctrScore = avgCtr > 0 ? 15 : 70 // no data defaults

  // CPM Score (weight: 10)
  let cpmScore = 100
  if (avgCpm > 0) {
    if (avgCpm <= 20) cpmScore = 100
    else if (avgCpm <= 40) cpmScore = 80
    else if (avgCpm <= 70) cpmScore = 60
    else if (avgCpm <= 100) cpmScore = 40
    else cpmScore = 20
  }

  // ROAS Score (weight: 25)
  let roasScore = 100
  if (client.target_roas && avgRoas > 0) {
    const ratio = avgRoas / client.target_roas
    if (ratio >= 1.2) roasScore = 100
    else if (ratio >= 1.0) roasScore = 90
    else if (ratio >= 0.8) roasScore = 70
    else if (ratio >= 0.6) roasScore = 50
    else roasScore = 25
  } else if (avgRoas > 0) {
    if (avgRoas >= 4) roasScore = 100
    else if (avgRoas >= 3) roasScore = 85
    else if (avgRoas >= 2) roasScore = 65
    else if (avgRoas >= 1) roasScore = 45
    else roasScore = 20
  } else {
    roasScore = 70
  }

  // Frequency Score (weight: 10)
  let frequencyScore = 100
  if (avgFrequency >= 6) frequencyScore = 15
  else if (avgFrequency >= 4.5) frequencyScore = 35
  else if (avgFrequency >= 3.5) frequencyScore = 55
  else if (avgFrequency >= 2.5) frequencyScore = 75
  else frequencyScore = 100

  // Billing Score (weight: 15)
  let billingScore = 100
  if (billingStatus === 'critical') billingScore = 0
  else if (billingStatus === 'warning') billingScore = 50

  // Rejected Ads Score (weight: 5)
  let rejectedScore = 100
  if (rejectedAdsCount >= 5) rejectedScore = 10
  else if (rejectedAdsCount >= 3) rejectedScore = 40
  else if (rejectedAdsCount >= 1) rejectedScore = 70

  // Budget Pacing Score (weight: 5)
  const totalSpend = recentMetrics.reduce((s, m) => s + m.spend, 0)
  const expectedSpend = client.monthly_budget ? (client.monthly_budget / 30) * 7 : null
  let pacingScore = 100
  let pacingRatio = 1
  if (expectedSpend && expectedSpend > 0) {
    pacingRatio = totalSpend / expectedSpend
    if (pacingRatio >= 0.85 && pacingRatio <= 1.15) pacingScore = 100
    else if (pacingRatio >= 0.7 || pacingRatio <= 1.3) pacingScore = 75
    else if (pacingRatio >= 0.5 || pacingRatio <= 1.5) pacingScore = 50
    else pacingScore = 25
  }

  // Trend Score (weight: -10 penalty if declining)
  let trendScore = 100
  let trendDirection: 'up' | 'down' | 'stable' = 'stable'
  if (oldAvgRoas > 0 && avgRoas > 0) {
    const roasChange = (avgRoas - oldAvgRoas) / oldAvgRoas
    if (roasChange > 0.1) { trendScore = 100; trendDirection = 'up' }
    else if (roasChange > -0.05) { trendScore = 90; trendDirection = 'stable' }
    else if (roasChange > -0.2) { trendScore = 65; trendDirection = 'down' }
    else { trendScore = 35; trendDirection = 'down' }
  } else if (oldAvgCpa > 0 && avgCpa > 0) {
    const cpaChange = (avgCpa - oldAvgCpa) / oldAvgCpa
    if (cpaChange < -0.1) { trendScore = 100; trendDirection = 'up' }
    else if (cpaChange < 0.05) { trendScore = 90; trendDirection = 'stable' }
    else { trendScore = 60; trendDirection = 'down' }
  }

  // Weighted score
  const weights = { cpa: 0.25, ctr: 0.15, cpm: 0.10, roas: 0.25, frequency: 0.10, billing: 0.15 }
  const baseScore =
    cpaScore * weights.cpa +
    ctrScore * weights.ctr +
    cpmScore * weights.cpm +
    roasScore * weights.roas +
    frequencyScore * weights.frequency +
    billingScore * weights.billing

  // Apply penalty factors
  const rejectedPenalty = (100 - rejectedScore) * 0.05
  const pacingPenalty = (100 - pacingScore) * 0.05
  const trendBonus = (trendScore - 100) * 0.10

  const score = Math.max(0, Math.min(100, Math.round(baseScore - rejectedPenalty - pacingPenalty + trendBonus)))

  // Determine trend vs previous score
  let trend: 'up' | 'down' | 'stable' = trendDirection
  if (input.previousScore !== undefined) {
    const diff = score - input.previousScore
    if (diff > 3) trend = 'up'
    else if (diff < -3) trend = 'down'
    else trend = 'stable'
  }

  const components: HealthScoreComponents = {
    cpa: { score: cpaScore, weight: 25, value: avgCpa, target: client.target_cpa },
    ctr: { score: ctrScore, weight: 15, value: avgCtr },
    cpm: { score: cpmScore, weight: 10, value: avgCpm },
    roas: { score: roasScore, weight: 25, value: avgRoas, target: client.target_roas },
    frequency: { score: frequencyScore, weight: 10, value: avgFrequency },
    billing: { score: billingScore, weight: 15, status: billingStatus },
    rejected_ads: { score: rejectedScore, weight: 5, count: rejectedAdsCount },
    budget_pacing: { score: pacingScore, weight: 5, pacing_ratio: pacingRatio },
    trend: { score: trendScore, weight: 10, direction: trendDirection },
  }

  return { score, components, trend }
}

export function getHealthColor(score: number): string {
  if (score >= 80) return 'text-emerald-500'
  if (score >= 60) return 'text-yellow-500'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-500'
}

export function getHealthBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

export function getHealthLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Warning'
  return 'Critical'
}
