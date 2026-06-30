import type { PerformanceMetrics, AlertType, AlertSeverity } from '@/types'

export interface AnomalyResult {
  type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  metric_name: string
  metric_value: number
  metric_threshold: number
  metric_change_pct: number
  context_data: Record<string, unknown>
}

interface MetricWindow {
  recent: number[]   // last 3 days
  baseline: number[] // prior 7-14 days
}

function getWindow(metrics: PerformanceMetrics[], field: keyof PerformanceMetrics): MetricWindow {
  const sorted = [...metrics].sort((a, b) => b.date.localeCompare(a.date))
  return {
    recent: sorted.slice(0, 3).map(m => Number(m[field] ?? 0)).filter(v => v > 0),
    baseline: sorted.slice(3, 10).map(m => Number(m[field] ?? 0)).filter(v => v > 0),
  }
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

function pctChange(current: number, baseline: number): number {
  if (baseline === 0) return 0
  return ((current - baseline) / baseline) * 100
}

export function detectAnomalies(
  metrics: PerformanceMetrics[],
  options: {
    rejectedAdsCount?: number
    billingStatus?: 'ok' | 'warning' | 'critical'
    hasLearningLimited?: boolean
    lastActivityDate?: string
    targetCpa?: number | null
    targetRoas?: number | null
  } = {}
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = []
  if (metrics.length < 3) return anomalies

  const {
    rejectedAdsCount = 0,
    billingStatus = 'ok',
    hasLearningLimited = false,
    lastActivityDate,
    targetCpa,
    targetRoas,
  } = options

  // ── Billing Issues ────────────────────────────────────────
  if (billingStatus === 'critical') {
    anomalies.push({
      type: 'billing_issue',
      severity: 'critical',
      title: 'Billing Issue Detected',
      description: 'Ad account has a critical billing issue that may pause all campaigns.',
      metric_name: 'billing_status',
      metric_value: 0,
      metric_threshold: 1,
      metric_change_pct: -100,
      context_data: { billing_status: billingStatus },
    })
  } else if (billingStatus === 'warning') {
    anomalies.push({
      type: 'billing_issue',
      severity: 'high',
      title: 'Billing Warning',
      description: 'Ad account billing requires attention. Campaigns may be at risk.',
      metric_name: 'billing_status',
      metric_value: 0.5,
      metric_threshold: 1,
      metric_change_pct: -50,
      context_data: { billing_status: billingStatus },
    })
  }

  // ── Rejected Ads ──────────────────────────────────────────
  if (rejectedAdsCount >= 3) {
    anomalies.push({
      type: 'rejected_ads',
      severity: rejectedAdsCount >= 5 ? 'high' : 'medium',
      title: `${rejectedAdsCount} Ads Rejected`,
      description: `${rejectedAdsCount} ads have been rejected by Meta. Review creatives for policy violations.`,
      metric_name: 'rejected_ads_count',
      metric_value: rejectedAdsCount,
      metric_threshold: 2,
      metric_change_pct: 0,
      context_data: { rejected_count: rejectedAdsCount },
    })
  }

  // ── Learning Limited ──────────────────────────────────────
  if (hasLearningLimited) {
    anomalies.push({
      type: 'learning_limited',
      severity: 'medium',
      title: 'Ad Set in Learning Limited',
      description: 'One or more ad sets are in Learning Limited phase. Performance may be suboptimal.',
      metric_name: 'learning_limited',
      metric_value: 1,
      metric_threshold: 0,
      metric_change_pct: 0,
      context_data: { learning_limited: true },
    })
  }

  // ── CPA Increase ──────────────────────────────────────────
  const cpaWindow = getWindow(metrics, 'cpa')
  if (cpaWindow.recent.length > 0 && cpaWindow.baseline.length > 0) {
    const recentCpa = avg(cpaWindow.recent)
    const baselineCpa = avg(cpaWindow.baseline)
    const change = pctChange(recentCpa, baselineCpa)

    if (change > 30) {
      const severity: AlertSeverity = change > 60 ? 'critical' : change > 40 ? 'high' : 'medium'
      anomalies.push({
        type: 'cpa_increase',
        severity,
        title: `CPA Increased by ${change.toFixed(0)}%`,
        description: `Cost per acquisition rose from ₪${baselineCpa.toFixed(2)} to ₪${recentCpa.toFixed(2)} over the last 3 days.`,
        metric_name: 'cpa',
        metric_value: recentCpa,
        metric_threshold: baselineCpa * 1.3,
        metric_change_pct: change,
        context_data: { recent_cpa: recentCpa, baseline_cpa: baselineCpa, target_cpa: targetCpa },
      })
    } else if (targetCpa && recentCpa > targetCpa * 1.5) {
      anomalies.push({
        type: 'cpa_increase',
        severity: 'high',
        title: `CPA 50% Above Target`,
        description: `Current CPA (₪${recentCpa.toFixed(2)}) is significantly above target (₪${targetCpa.toFixed(2)}).`,
        metric_name: 'cpa',
        metric_value: recentCpa,
        metric_threshold: targetCpa,
        metric_change_pct: pctChange(recentCpa, targetCpa),
        context_data: { recent_cpa: recentCpa, target_cpa: targetCpa },
      })
    }
  }

  // ── ROAS Decrease ─────────────────────────────────────────
  const roasWindow = getWindow(metrics, 'roas')
  if (roasWindow.recent.length > 0 && roasWindow.baseline.length > 0) {
    const recentRoas = avg(roasWindow.recent)
    const baselineRoas = avg(roasWindow.baseline)
    const change = pctChange(recentRoas, baselineRoas)

    if (change < -25) {
      const severity: AlertSeverity = change < -50 ? 'critical' : change < -35 ? 'high' : 'medium'
      anomalies.push({
        type: 'roas_decrease',
        severity,
        title: `ROAS Dropped by ${Math.abs(change).toFixed(0)}%`,
        description: `Return on ad spend fell from ${baselineRoas.toFixed(2)}x to ${recentRoas.toFixed(2)}x.`,
        metric_name: 'roas',
        metric_value: recentRoas,
        metric_threshold: baselineRoas * 0.75,
        metric_change_pct: change,
        context_data: { recent_roas: recentRoas, baseline_roas: baselineRoas, target_roas: targetRoas },
      })
    }
  }

  // ── CTR Decrease ──────────────────────────────────────────
  const ctrWindow = getWindow(metrics, 'ctr')
  if (ctrWindow.recent.length > 0 && ctrWindow.baseline.length > 0) {
    const recentCtr = avg(ctrWindow.recent)
    const baselineCtr = avg(ctrWindow.baseline)
    const change = pctChange(recentCtr, baselineCtr)

    if (change < -30) {
      anomalies.push({
        type: 'ctr_decrease',
        severity: change < -50 ? 'high' : 'medium',
        title: `CTR Dropped by ${Math.abs(change).toFixed(0)}%`,
        description: `Click-through rate fell from ${(baselineCtr * 100).toFixed(2)}% to ${(recentCtr * 100).toFixed(2)}%. Possible creative fatigue.`,
        metric_name: 'ctr',
        metric_value: recentCtr,
        metric_threshold: baselineCtr * 0.7,
        metric_change_pct: change,
        context_data: { recent_ctr: recentCtr, baseline_ctr: baselineCtr },
      })
    }
  }

  // ── Frequency Too High ────────────────────────────────────
  const freqWindow = getWindow(metrics, 'frequency')
  if (freqWindow.recent.length > 0) {
    const recentFreq = avg(freqWindow.recent)
    if (recentFreq >= 4.5) {
      anomalies.push({
        type: 'frequency_increase',
        severity: recentFreq >= 6 ? 'high' : 'medium',
        title: `High Ad Frequency: ${recentFreq.toFixed(1)}`,
        description: `Average frequency of ${recentFreq.toFixed(1)} indicates audience saturation. Consider refreshing creatives or expanding audience.`,
        metric_name: 'frequency',
        metric_value: recentFreq,
        metric_threshold: 4,
        metric_change_pct: pctChange(recentFreq, avg(freqWindow.baseline) || 2),
        context_data: { frequency: recentFreq },
      })
    }
  }

  // ── Spend Anomaly ─────────────────────────────────────────
  const spendWindow = getWindow(metrics, 'spend')
  if (spendWindow.recent.length > 0 && spendWindow.baseline.length > 0) {
    const recentSpend = avg(spendWindow.recent)
    const baselineSpend = avg(spendWindow.baseline)
    const change = pctChange(recentSpend, baselineSpend)

    if (Math.abs(change) > 40) {
      anomalies.push({
        type: 'spend_anomaly',
        severity: Math.abs(change) > 70 ? 'high' : 'medium',
        title: `Unusual Spend ${change > 0 ? 'Spike' : 'Drop'}: ${change > 0 ? '+' : ''}${change.toFixed(0)}%`,
        description: `Daily spend ${change > 0 ? 'increased' : 'decreased'} significantly from baseline. Verify budget settings.`,
        metric_name: 'spend',
        metric_value: recentSpend,
        metric_threshold: baselineSpend * (change > 0 ? 1.4 : 0.6),
        metric_change_pct: change,
        context_data: { recent_spend: recentSpend, baseline_spend: baselineSpend },
      })
    }
  }

  // ── Conversion Drop ───────────────────────────────────────
  const convWindow = getWindow(metrics, 'conversions')
  if (convWindow.recent.length > 0 && convWindow.baseline.length > 0) {
    const recentConv = avg(convWindow.recent)
    const baselineConv = avg(convWindow.baseline)
    const change = pctChange(recentConv, baselineConv)

    if (change < -40 && baselineConv > 0) {
      anomalies.push({
        type: 'conversion_drop',
        severity: change < -60 ? 'critical' : 'high',
        title: `Conversions Down ${Math.abs(change).toFixed(0)}%`,
        description: `Conversion volume dropped from ${baselineConv.toFixed(0)} to ${recentConv.toFixed(0)} per day. Check pixel, landing page, and campaign status.`,
        metric_name: 'conversions',
        metric_value: recentConv,
        metric_threshold: baselineConv * 0.6,
        metric_change_pct: change,
        context_data: { recent_conversions: recentConv, baseline_conversions: baselineConv },
      })
    }
  }

  // ── Campaign Inactivity ───────────────────────────────────
  if (lastActivityDate) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceActivity > 7) {
      anomalies.push({
        type: 'campaign_inactive',
        severity: daysSinceActivity > 14 ? 'high' : 'medium',
        title: `No Activity for ${daysSinceActivity} Days`,
        description: `No campaign activity detected in ${daysSinceActivity} days. Verify campaigns are running.`,
        metric_name: 'days_inactive',
        metric_value: daysSinceActivity,
        metric_threshold: 7,
        metric_change_pct: 0,
        context_data: { last_activity: lastActivityDate, days_inactive: daysSinceActivity },
      })
    }
  }

  return anomalies
}
