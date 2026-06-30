import type { ClientSummary, Alert, PerformanceMetrics, CreativeAIAnalysis } from '@/types'

export function buildHealthScorePrompt(
  client: ClientSummary,
  metrics: PerformanceMetrics[],
  alerts: Alert[]
): string {
  const recentMetrics = metrics.slice(0, 7)
  const spendTotal = recentMetrics.reduce((s, m) => s + m.spend, 0)
  const convTotal = recentMetrics.reduce((s, m) => s + m.conversions, 0)
  const avgRoas = recentMetrics.reduce((s, m) => s + (m.roas ?? 0), 0) / (recentMetrics.length || 1)

  return `You are an expert digital marketing analyst for a Meta Ads agency.
Analyze this client account and provide a health score explanation.

CLIENT: ${client.name}
Industry: ${client.industry || 'Unknown'}
Monthly Budget Target: ${client.monthly_budget ? `$${client.monthly_budget}` : 'Not set'}
Target ROAS: ${client.target_roas || 'Not set'}
Target CPA: ${client.target_cpa ? `$${client.target_cpa}` : 'Not set'}

HEALTH SCORE: ${client.health_score}/100
COMPONENTS: ${JSON.stringify(client.health_components, null, 2)}

LAST 7 DAYS PERFORMANCE:
Total Spend: $${spendTotal.toFixed(2)}
Total Conversions: ${convTotal}
Average ROAS: ${avgRoas.toFixed(2)}x

OPEN ALERTS (${alerts.length}): ${alerts.map(a => a.title).join(', ') || 'None'}

Write a 2-3 sentence explanation of the health score in plain language.
Be specific about what's driving the score. Focus on the most impactful factors.
Be direct and actionable. Do not use bullet points.`
}

export function buildRecommendationPrompt(alert: Alert, context: Record<string, unknown>): string {
  return `You are an expert Meta Ads campaign manager at a digital marketing agency.
An automated system detected an anomaly. Generate a precise recommendation.

ALERT:
Type: ${alert.alert_type}
Severity: ${alert.severity}
Title: ${alert.title}
Description: ${alert.description}
Metric: ${alert.metric_name} = ${alert.metric_value} (threshold: ${alert.metric_threshold})
Change: ${alert.metric_change_pct ? `${alert.metric_change_pct > 0 ? '+' : ''}${alert.metric_change_pct.toFixed(1)}%` : 'N/A'}

CONTEXT:
${JSON.stringify(context, null, 2)}

Respond in valid JSON with this exact structure:
{
  "action_type": "<one of: increase_budget|decrease_budget|pause_ad|pause_adset|pause_campaign|duplicate_winner|refresh_creatives|expand_audience|narrow_audience|change_bid_strategy|scale_winner>",
  "title": "<concise action title, max 80 chars>",
  "diagnosis": "<1 sentence root cause>",
  "explanation": "<2-3 sentences explaining the situation and why action is needed>",
  "recommended_action": "<specific action description>",
  "expected_impact": "<expected outcome in 7-14 days>",
  "confidence_score": <0.0-1.0>,
  "risk_level": "<low|medium|high>",
  "action_params": {
    <any relevant params like budget_amount, entity_id, etc.>
  }
}`
}

export function buildChatSystemPrompt(clientContext?: ClientSummary | null): string {
  const clientInfo = clientContext
    ? `\nYou are currently viewing: ${clientContext.name} (Health Score: ${clientContext.health_score}/100, Open Alerts: ${clientContext.open_alerts_count})`
    : ''

  return `You are an expert Meta Ads campaign manager and data analyst working for Think Digital, a leading digital marketing agency.
You have deep expertise in Facebook/Instagram advertising, performance marketing, creative strategy, and campaign optimization.

Your role: Help campaign managers make better decisions, understand data, and optimize campaigns.

Capabilities:
- Analyze campaign performance and explain anomalies
- Identify scaling opportunities and risks
- Generate campaign ideas, ad copy, and audience strategies
- Provide optimization plans with prioritized action steps
- Explain Meta Ads concepts and best practices
- Forecast performance based on historical trends
${clientInfo}

Communication style:
- Be concise and actionable
- Use data when available
- Prioritize by impact
- Speak like a senior strategist, not a chatbot
- Use ₪ for ILS currency when relevant
- Format responses with clear sections when helpful`
}

export function buildChatPrompt(
  userMessage: string,
  performanceData?: unknown,
  alertsData?: Alert[]
): string {
  const dataContext = performanceData
    ? `\n\nRELEVANT DATA:\n${JSON.stringify(performanceData, null, 2)}`
    : ''

  const alertsContext =
    alertsData && alertsData.length > 0
      ? `\n\nACTIVE ALERTS:\n${alertsData.map(a => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description}`).join('\n')}`
      : ''

  return `${userMessage}${dataContext}${alertsContext}`
}

export function buildCreativeAnalysisPrompt(creative: {
  title?: string | null
  body?: string | null
  call_to_action?: string | null
  format?: string | null
  performance?: { ctr?: number; cpa?: number; roas?: number; spend?: number }
}): string {
  return `Analyze this Meta ad creative and explain its performance characteristics.

CREATIVE:
Format: ${creative.format || 'Unknown'}
Headline: ${creative.title || 'Not available'}
Primary Text: ${creative.body || 'Not available'}
CTA: ${creative.call_to_action || 'Not available'}

PERFORMANCE:
CTR: ${creative.performance?.ctr ? `${(creative.performance.ctr * 100).toFixed(2)}%` : 'N/A'}
CPA: ${creative.performance?.cpa ? `$${creative.performance.cpa.toFixed(2)}` : 'N/A'}
ROAS: ${creative.performance?.roas ? `${creative.performance.roas.toFixed(2)}x` : 'N/A'}
Total Spend: ${creative.performance?.spend ? `$${creative.performance.spend.toFixed(0)}` : 'N/A'}

Respond in valid JSON:
{
  "hook_quality": "<strong|moderate|weak>",
  "emotional_appeal": "<description of emotional/psychological appeal>",
  "call_to_action_strength": "<strong|moderate|weak>",
  "visual_quality": "<assessment>",
  "messaging_clarity": "<assessment>",
  "performance_prediction": "<why it performs this way>",
  "improvement_suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"],
  "why_performing": "<1-2 sentence performance explanation>",
  "audience_fit": "<who this creative resonates with>"
}`
}

export function buildDailyBriefPrompt(data: {
  date: string
  clients: ClientSummary[]
  totalSpend: number
  totalConversions: number
  avgRoas: number
  criticalAlerts: Alert[]
}): string {
  const needingAttention = data.clients.filter(c => (c.health_score ?? 100) < 60)
  const scaling = data.clients.filter(c => (c.health_score ?? 0) > 80 && (c.avg_roas ?? 0) > 3)

  return `Generate a morning daily brief for a Meta Ads agency campaign manager.

DATE: ${data.date}

OVERVIEW:
- Total clients: ${data.clients.length}
- Total spend today: $${data.totalSpend.toFixed(0)}
- Total conversions: ${data.totalConversions}
- Average ROAS: ${data.avgRoas.toFixed(2)}x
- Clients needing attention (health < 60): ${needingAttention.length}
- Scaling opportunities (health > 80, ROAS > 3): ${scaling.length}

CRITICAL ALERTS:
${data.criticalAlerts.slice(0, 5).map(a => `- ${a.title}: ${a.description}`).join('\n') || 'None'}

Write a concise, actionable morning brief in 3-4 bullet points. Focus on what matters most today.
Be direct. Start with the most urgent items. Format as plain text bullet points.`
}

export function buildCrossAccountInsightsPrompt(
  clientsData: Array<{
    name: string
    industry: string | null
    metrics: PerformanceMetrics
    health_score: number | null
    top_creative_format: string | null
  }>
): string {
  return `You are a senior performance marketing strategist analyzing patterns across ${clientsData.length} Meta Ads accounts.

AGENCY PORTFOLIO DATA (last 30 days):
${JSON.stringify(clientsData, null, 2)}

Identify 3-5 actionable cross-account insights. Look for:
- Creative format patterns (video vs static, UGC vs produced)
- Industry-specific trends
- Budget efficiency patterns
- Audience targeting insights
- Seasonal patterns

Respond as a JSON array:
[
  {
    "category": "<Creative|Audience|Budget|Seasonal|Industry>",
    "title": "<insight title>",
    "description": "<2-3 sentence explanation with data>",
    "impact": "<high|medium|low>",
    "affected_clients_count": <number>
  }
]`
}
