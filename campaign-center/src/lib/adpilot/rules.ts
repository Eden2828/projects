// ============================================================
// AdPilot Safety Rules Engine (Phase 4)
// ============================================================
// Central, testable place for every guardrail. Nothing in the system performs a
// budget/structural change without passing through these checks first. In the
// MVP, any destructive action is *blocked* and turned into a recommendation that
// requires explicit human approval.

export interface BudgetContext {
  monthlyBudget: number | null
  currentDailyBudget: number | null
  proposedDailyBudget: number
}

export interface DataContext {
  // number of days the ad/campaign has been running with delivery
  daysRunning: number
  // total impressions accrued
  impressions: number
  // budget changes already made to this campaign today
  budgetChangesToday: number
}

export interface RuleResult {
  allowed: boolean
  rule: string
  reason: string
}

// Tunable thresholds — single source of truth.
export const RULES_CONFIG = {
  maxDailyIncreasePct: 0.2, // never increase a daily budget by more than 20%
  minDaysBeforePause: 3, // never pause before this many days of delivery
  minImpressionsBeforePause: 1000, // ...or before this much data
  maxBudgetChangesPerDay: 1, // one budget change per campaign per day
} as const

/** Rule: a proposed daily budget must keep monthly spend within the cap. */
export function checkMonthlyBudget(ctx: BudgetContext): RuleResult {
  const rule = 'never_exceed_monthly_budget'
  if (ctx.monthlyBudget == null || ctx.monthlyBudget <= 0) {
    return { allowed: true, rule, reason: 'No monthly budget set; skipping cap check.' }
  }
  const projectedMonthly = ctx.proposedDailyBudget * 30
  if (projectedMonthly > ctx.monthlyBudget) {
    return {
      allowed: false,
      rule,
      reason: `Proposed daily ${ctx.proposedDailyBudget} × 30 = ${projectedMonthly} exceeds monthly budget ${ctx.monthlyBudget}.`,
    }
  }
  return { allowed: true, rule, reason: 'Within monthly budget.' }
}

/** Rule: never increase a daily budget by more than 20% in one step. */
export function checkBudgetIncrease(ctx: BudgetContext): RuleResult {
  const rule = 'max_daily_increase_20pct'
  if (ctx.currentDailyBudget == null || ctx.currentDailyBudget <= 0) {
    return { allowed: true, rule, reason: 'No current daily budget; nothing to compare.' }
  }
  const maxAllowed = ctx.currentDailyBudget * (1 + RULES_CONFIG.maxDailyIncreasePct)
  if (ctx.proposedDailyBudget > maxAllowed) {
    return {
      allowed: false,
      rule,
      reason: `Proposed ${ctx.proposedDailyBudget} exceeds +20% cap of ${maxAllowed.toFixed(2)}.`,
    }
  }
  return { allowed: true, rule, reason: 'Increase within 20% limit.' }
}

/** Rule: never make more than one budget change per campaign per day. */
export function checkBudgetChangeFrequency(ctx: DataContext): RuleResult {
  const rule = 'one_budget_change_per_day'
  if (ctx.budgetChangesToday >= RULES_CONFIG.maxBudgetChangesPerDay) {
    return {
      allowed: false,
      rule,
      reason: `Already made ${ctx.budgetChangesToday} budget change(s) today.`,
    }
  }
  return { allowed: true, rule, reason: 'No budget change yet today.' }
}

/** Rule: never pause an ad before it has gathered enough data. */
export function checkPauseReadiness(ctx: DataContext): RuleResult {
  const rule = 'enough_data_before_pause'
  if (
    ctx.daysRunning < RULES_CONFIG.minDaysBeforePause ||
    ctx.impressions < RULES_CONFIG.minImpressionsBeforePause
  ) {
    return {
      allowed: false,
      rule,
      reason: `Only ${ctx.daysRunning}d / ${ctx.impressions} impressions — below learning threshold (${RULES_CONFIG.minDaysBeforePause}d, ${RULES_CONFIG.minImpressionsBeforePause} impressions).`,
    }
  }
  return { allowed: true, rule, reason: 'Enough data to evaluate.' }
}

export type ActionKind = 'increase_budget' | 'decrease_budget' | 'pause_ad' | 'pause_campaign'

/**
 * Evaluate a proposed action against all relevant rules.
 * `requiresApproval` is always true for destructive actions in the MVP.
 */
export function evaluateAction(
  action: ActionKind,
  opts: { budget?: BudgetContext; data?: DataContext }
): { allowed: boolean; requiresApproval: boolean; results: RuleResult[] } {
  const results: RuleResult[] = []

  if (action === 'increase_budget' && opts.budget) {
    results.push(checkMonthlyBudget(opts.budget))
    results.push(checkBudgetIncrease(opts.budget))
  }
  if ((action === 'increase_budget' || action === 'decrease_budget') && opts.data) {
    results.push(checkBudgetChangeFrequency(opts.data))
  }
  if ((action === 'pause_ad' || action === 'pause_campaign') && opts.data) {
    results.push(checkPauseReadiness(opts.data))
  }

  const allowed = results.every((r) => r.allowed)
  const isDestructive = action === 'pause_ad' || action === 'pause_campaign'

  return {
    allowed,
    // MVP policy: destructive actions ALWAYS require human approval, even if rules pass.
    requiresApproval: isDestructive || !allowed,
    results,
  }
}
