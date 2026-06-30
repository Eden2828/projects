import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectAnomalies } from '@/lib/anomaly/detector'
import type { PerformanceMetrics } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  const severity = searchParams.get('severity')
  const status = searchParams.get('status') || 'open'
  const limit = parseInt(searchParams.get('limit') || '100')

  let query = supabase
    .from('alerts')
    .select('*, client:clients(id, name, logo_url)')
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (clientId) query = query.eq('client_id', clientId)
  if (severity) query = query.eq('severity', severity)
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: data?.length || 0 })
}

export async function POST(req: NextRequest) {
  // Run anomaly detection for a client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { client_id } = await req.json()
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Get client info
  const { data: client } = await admin
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Get ad accounts
  const { data: accounts } = await admin
    .from('ad_accounts')
    .select('*')
    .eq('client_id', client_id)
    .eq('is_active', true)

  if (!accounts?.length) {
    return NextResponse.json({ data: [], message: 'No active accounts' })
  }

  const accountIds = accounts.map(a => a.id)

  // Get last 30 days of performance metrics
  const { data: metricsRaw } = await admin
    .from('performance_metrics')
    .select('*')
    .eq('entity_type', 'account')
    .in('entity_id', accountIds)
    .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date', { ascending: false })

  const metrics = (metricsRaw || []) as PerformanceMetrics[]

  // Get rejected ads count
  const { count: rejectedCount } = await admin
    .from('ads')
    .select('id', { count: 'exact', head: true })
    .in('ad_set_id', (await admin
      .from('ad_sets')
      .select('id')
      .in('campaign_id', (await admin
        .from('campaigns')
        .select('id')
        .in('ad_account_id', accountIds)
      ).data?.map((c: { id: string }) => c.id) || [])
    ).data?.map((as: { id: string }) => as.id) || [])
    .eq('status', 'DISAPPROVED')

  // Get billing status from account_status
  const billingStatus = accounts.some(a => a.account_status === 2) ? 'warning' :
    accounts.some(a => a.account_status === 3) ? 'critical' : 'ok'

  const lastActivity = metrics[0]?.date || null

  const anomalies = detectAnomalies(metrics, {
    rejectedAdsCount: rejectedCount || 0,
    billingStatus,
    targetCpa: client.target_cpa,
    targetRoas: client.target_roas,
    lastActivityDate: lastActivity,
  })

  // Create alerts for new anomalies
  const createdAlerts = []
  for (const anomaly of anomalies) {
    // Check if similar alert already exists
    const { data: existing } = await admin
      .from('alerts')
      .select('id')
      .eq('client_id', client_id)
      .eq('alert_type', anomaly.type)
      .eq('status', 'open')
      .single()

    if (existing) continue

    const { data: newAlert } = await admin
      .from('alerts')
      .insert({
        client_id,
        alert_type: anomaly.type,
        severity: anomaly.severity,
        status: 'open',
        title: anomaly.title,
        description: anomaly.description,
        metric_name: anomaly.metric_name,
        metric_value: anomaly.metric_value,
        metric_threshold: anomaly.metric_threshold,
        metric_change_pct: anomaly.metric_change_pct,
        context_data: anomaly.context_data,
      })
      .select()
      .single()

    if (newAlert) {
      createdAlerts.push(newAlert)

      // Log activity
      await admin.from('activity_log').insert({
        client_id,
        activity_type: 'alert_created',
        entity_id: newAlert.id,
        description: `Alert created: ${anomaly.title}`,
        metadata: { severity: anomaly.severity, type: anomaly.type },
      })
    }
  }

  return NextResponse.json({ data: createdAlerts, total: createdAlerts.length })
}
