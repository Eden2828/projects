import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON, generateText } from '@/lib/gemini/client'
import { buildCrossAccountInsightsPrompt, buildDailyBriefPrompt } from '@/lib/gemini/prompts'
import type { DailyBrief, CrossAccountInsight, ClientSummary, Alert } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'cross_account'

  if (type === 'daily_brief') {
    return getDailyBrief(supabase)
  }

  return getCrossAccountInsights(supabase)
}

async function getDailyBrief(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date().toISOString().split('T')[0]

  // Get all active clients with health scores
  const { data: clients } = await supabase
    .from('client_summary')
    .select('*')
    .eq('is_active', true)

  const clientList = (clients || []) as ClientSummary[]

  // Get critical alerts
  const { data: criticalAlerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('status', 'open')
    .in('severity', ['critical', 'high'])
    .order('created_at', { ascending: false })
    .limit(10)

  const alertList = (criticalAlerts || []) as Alert[]

  // Get aggregated today's performance
  const { data: todayPerf } = await supabase
    .from('performance_metrics')
    .select('spend, conversions, roas')
    .eq('entity_type', 'account')
    .eq('date', today)

  const totalSpend = (todayPerf || []).reduce((s, m) => s + (m.spend || 0), 0)
  const totalConversions = (todayPerf || []).reduce((s, m) => s + (m.conversions || 0), 0)
  const avgRoas = (todayPerf || []).filter(m => m.roas).reduce((s, m) => s + m.roas, 0) /
    ((todayPerf || []).filter(m => m.roas).length || 1)

  const needingAttention = clientList.filter(c => (c.health_score ?? 100) < 60)
  const scalingOpps = clientList.filter(c => (c.health_score ?? 0) > 80)
  const billingIssues = alertList.filter(a => a.alert_type === 'billing_issue')
  const criticalCount = alertList.filter(a => a.severity === 'critical').length
  const highCount = alertList.filter(a => a.severity === 'high').length

  const topPerformers = clientList
    .filter(c => c.avg_roas !== undefined && c.avg_roas > 0)
    .sort((a, b) => (b.avg_roas || 0) - (a.avg_roas || 0))
    .slice(0, 3)
    .map(c => ({ client_id: c.id, client_name: c.name, roas: c.avg_roas || 0 }))

  const worstPerformers = clientList
    .filter(c => c.health_score !== null)
    .sort((a, b) => (a.health_score || 100) - (b.health_score || 100))
    .slice(0, 3)
    .map(c => ({ client_id: c.id, client_name: c.name, health_score: c.health_score || 0 }))

  const brief: DailyBrief = {
    date: today,
    total_clients: clientList.length,
    clients_needing_attention: needingAttention.length,
    billing_issues: billingIssues.length,
    critical_alerts: criticalCount,
    high_alerts: highCount,
    scaling_opportunities: scalingOpps.length,
    top_performers: topPerformers,
    worst_performers: worstPerformers,
    total_spend: totalSpend,
    total_conversions: totalConversions,
    total_roas: avgRoas,
    action_items: needingAttention.slice(0, 5).map(c => ({
      priority: c.critical_alerts_count > 0 ? 'urgent' as const : 'high' as const,
      title: `Review ${c.name}`,
      client_name: c.name,
    })),
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json({ data: brief })
}

async function getCrossAccountInsights(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: clients } = await supabase
    .from('client_summary')
    .select('id, name, industry, health_score')
    .eq('is_active', true)
    .limit(50)

  if (!clients?.length) {
    return NextResponse.json({ insights: [], generated_at: new Date().toISOString() })
  }

  const { data: creativeStats } = await supabase
    .from('performance_metrics')
    .select('entity_id, spend, ctr, roas, conversions')
    .eq('entity_type', 'ad')
    .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .limit(500)

  // Group by entity (ad) to get top format
  const adPerf = (creativeStats || []).reduce<Record<string, { spend: number; roas: number }>>((acc, m) => {
    if (!acc[m.entity_id]) acc[m.entity_id] = { spend: 0, roas: 0 }
    acc[m.entity_id].spend += m.spend || 0
    acc[m.entity_id].roas += m.roas || 0
    return acc
  }, {})

  const enrichedClients = clients.map(c => ({
    name: c.name,
    industry: c.industry,
    health_score: c.health_score,
    metrics: {
      avg_roas: Object.values(adPerf).reduce((s, v) => s + v.roas, 0) / (Object.keys(adPerf).length || 1),
      avg_spend: Object.values(adPerf).reduce((s, v) => s + v.spend, 0) / (Object.keys(adPerf).length || 1),
    },
    top_creative_format: 'VIDEO', // Would come from creative join
  }))

  const prompt = buildCrossAccountInsightsPrompt(enrichedClients)

  let rawInsights: Array<{
    category: string; title: string; description: string;
    impact: string; affected_clients_count: number
  }>

  try {
    rawInsights = await generateJSON(prompt, false)
  } catch {
    return NextResponse.json({
      insights: [],
      generated_at: new Date().toISOString(),
      error: 'AI generation unavailable',
    })
  }

  const insights: CrossAccountInsight[] = rawInsights.map((ins, i) => ({
    id: `insight-${i}-${Date.now()}`,
    category: ins.category,
    title: ins.title,
    description: ins.description,
    impact: (ins.impact as 'high' | 'medium' | 'low') || 'medium',
    affected_clients: [],
    data_points: { affected_count: ins.affected_clients_count },
    generated_at: new Date().toISOString(),
  }))

  return NextResponse.json({ insights, generated_at: new Date().toISOString() })
}
