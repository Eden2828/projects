import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText } from '@/lib/gemini/client'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('reports')
    .select('*, client:clients(id, name)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { client_id, date_from, date_to, format, type } = await req.json()

  if (!client_id || !date_from || !date_to || !format) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get client info
  const { data: client } = await admin
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Create report record
  const title = `${client.name} — ${type === 'weekly' ? 'Weekly' : 'Monthly'} Report`
  const { data: report, error: reportError } = await admin
    .from('reports')
    .insert({
      client_id,
      created_by: user.id,
      title,
      type: type || 'custom',
      format,
      date_from,
      date_to,
      status: 'generating',
      content: {},
    })
    .select()
    .single()

  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 })

  // Generate report in background
  generateReport(admin, report.id, client, date_from, date_to, format).catch(err => {
    console.error('Report generation failed:', err)
    admin.from('reports').update({
      status: 'failed',
      error: err.message || 'Generation failed',
    }).eq('id', report.id)
  })

  await supabase.from('activity_log').insert({
    user_id: user.id,
    client_id,
    activity_type: 'report_generated',
    entity_id: report.id,
    description: `Report generation started: ${title}`,
  })

  return NextResponse.json({ data: report })
}

async function generateReport(
  admin: ReturnType<typeof createAdminClient>,
  reportId: string,
  client: Record<string, unknown>,
  dateFrom: string,
  dateTo: string,
  format: string
) {
  // Get account IDs
  const { data: accounts } = await admin
    .from('ad_accounts')
    .select('id')
    .eq('client_id', client.id)

  const accountIds = (accounts || []).map((a: { id: string }) => a.id)

  // Get performance data
  const { data: metrics } = await admin
    .from('performance_metrics')
    .select('*')
    .eq('entity_type', 'account')
    .in('entity_id', accountIds)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true })

  const totalSpend = (metrics || []).reduce((s, m) => s + (m.spend || 0), 0)
  const totalConversions = (metrics || []).reduce((s, m) => s + (m.conversions || 0), 0)
  const totalImpressions = (metrics || []).reduce((s, m) => s + (m.impressions || 0), 0)
  const totalClicks = (metrics || []).reduce((s, m) => s + (m.clicks || 0), 0)
  const avgRoas = totalSpend > 0
    ? (metrics || []).reduce((s, m) => s + (m.conversion_value || 0), 0) / totalSpend
    : 0
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0

  // Get alerts during period
  const { data: periodAlerts } = await admin
    .from('alerts')
    .select('title, description, severity, alert_type')
    .eq('client_id', client.id)
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`)
    .limit(20)

  // Get top creatives
  const { data: creatives } = await admin
    .from('creatives')
    .select('name, title, format, thumbnail_url')
    .in('ad_account_id', accountIds)
    .limit(5)

  // Generate AI insights
  const insightsPrompt = `Generate a professional performance report summary for ${client.name}.

PERIOD: ${dateFrom} to ${dateTo}
TOTAL SPEND: ₪${totalSpend.toFixed(0)}
TOTAL CONVERSIONS: ${totalConversions}
AVG ROAS: ${avgRoas.toFixed(2)}x
AVG CPA: ₪${avgCpa.toFixed(2)}
AVG CTR: ${(avgCtr * 100).toFixed(2)}%
ALERTS DURING PERIOD: ${(periodAlerts || []).length}

Provide:
1. Executive summary (2-3 sentences)
2. Key wins (2-3 bullets)
3. Key challenges (2-3 bullets)
4. Top recommendations for next period (3-5 bullets)

Be specific and data-driven. Use ₪ for ILS currency.`

  let aiInsights = ''
  try {
    aiInsights = await generateText(insightsPrompt, true)
  } catch {}

  const content = {
    kpis: {
      total_spend: totalSpend,
      total_conversions: totalConversions,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      avg_roas: avgRoas,
      avg_cpa: avgCpa,
      avg_ctr: avgCtr,
    },
    insights: aiInsights ? [aiInsights] : [],
    problems: (periodAlerts || [])
      .filter(a => ['critical', 'high'].includes(a.severity))
      .map(a => a.title),
    opportunities: [],
    top_creatives: (creatives || []).slice(0, 5),
    daily_metrics: metrics || [],
    summary: aiInsights,
  }

  // Update report with content
  await admin.from('reports').update({
    content,
    status: 'ready',
    generated_at: new Date().toISOString(),
  }).eq('id', reportId)
}
