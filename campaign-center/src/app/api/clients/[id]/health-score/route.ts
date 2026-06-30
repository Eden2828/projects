import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateHealthScore } from '@/lib/utils/health-score'
import { generateText } from '@/lib/gemini/client'
import { buildHealthScorePrompt } from '@/lib/gemini/prompts'
import type { PerformanceMetrics, Client, ClientSummary } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get client
  const { data: client } = await admin
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Get ad accounts
  const { data: accounts } = await admin
    .from('ad_accounts')
    .select('*')
    .eq('client_id', id)
    .eq('is_active', true)

  const accountIds = (accounts || []).map((a: { id: string }) => a.id)

  // Get last 30 days metrics
  const { data: metricsRaw } = await admin
    .from('performance_metrics')
    .select('*')
    .eq('entity_type', 'account')
    .in('entity_id', accountIds.length > 0 ? accountIds : ['none'])
    .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date', { ascending: false })

  const metrics = (metricsRaw || []) as PerformanceMetrics[]

  // Get open alerts
  const { data: alerts } = await admin
    .from('alerts')
    .select('alert_type, severity')
    .eq('client_id', id)
    .eq('status', 'open')

  // Get rejected ads count
  const { count: rejectedCount } = await admin
    .from('ads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'DISAPPROVED')
    .in('ad_set_id',
      (await admin.from('ad_sets').select('id')
        .in('campaign_id',
          (await admin.from('campaigns').select('id')
            .in('ad_account_id', accountIds.length > 0 ? accountIds : ['none'])
          ).data?.map((c: { id: string }) => c.id) || []
        )
      ).data?.map((as: { id: string }) => as.id) || []
    )

  const billingStatus = (accounts || []).some((a: { account_status: number }) => a.account_status === 3) ? 'critical' :
    (accounts || []).some((a: { account_status: number }) => a.account_status === 2) ? 'warning' : 'ok'

  // Get previous score for trend
  const { data: prevScore } = await admin
    .from('health_scores')
    .select('score')
    .eq('client_id', id)
    .order('date', { ascending: false })
    .limit(2)

  const previousScore = prevScore && prevScore.length > 1 ? prevScore[1].score : undefined

  const { score, components, trend } = calculateHealthScore({
    client: client as Client,
    metrics,
    alerts: (alerts || []) as Array<{ alert_type: string; severity: string }>,
    rejectedAdsCount: rejectedCount || 0,
    billingStatus,
    previousScore,
  })

  // Generate AI explanation
  const clientSummary: ClientSummary = {
    ...client as Client,
    health_score: score,
    health_trend: trend,
    health_explanation: null,
    health_components: components,
    health_calculated_at: new Date().toISOString(),
    open_alerts_count: (alerts || []).length,
    critical_alerts_count: (alerts || []).filter((a: { severity: string }) => a.severity === 'critical').length,
    pending_recommendations_count: 0,
    active_accounts_count: (accounts || []).length,
  }

  let explanation = ''
  try {
    const prompt = buildHealthScorePrompt(clientSummary, metrics, (alerts || []) as Example[])
    explanation = await generateText(prompt, true)
  } catch {
    explanation = `Health score of ${score}/100 based on recent campaign performance metrics.`
  }

  // Upsert health score
  const today = new Date().toISOString().split('T')[0]
  const { data: healthScore, error } = await admin
    .from('health_scores')
    .upsert(
      {
        client_id: id,
        score,
        components,
        explanation,
        trend,
        previous_score: previousScore ?? null,
        calculated_at: new Date().toISOString(),
        date: today,
      },
      { onConflict: 'client_id,date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: healthScore })
}

type Example = { alert_type: string; severity: string }
