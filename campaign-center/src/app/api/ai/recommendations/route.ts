import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateJSON, generateText } from '@/lib/gemini/client'
import { buildRecommendationPrompt, buildCreativeAnalysisPrompt } from '@/lib/gemini/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status') || 'pending'

  let query = supabase
    .from('ai_recommendations')
    .select('*')
    .eq('status', status)
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

  const body = await req.json()
  const { type, alert_id, creative_id } = body

  // Creative analysis
  if (type === 'creative_analysis' && creative_id) {
    const { data: creative } = await supabase
      .from('creatives')
      .select('*')
      .eq('id', creative_id)
      .single()

    if (!creative) return NextResponse.json({ error: 'Creative not found' }, { status: 404 })

    const prompt = buildCreativeAnalysisPrompt({
      title: creative.title,
      body: creative.body,
      call_to_action: creative.call_to_action,
      format: creative.format,
    })

    const analysis = await generateJSON(prompt, true)

    await supabase
      .from('creatives')
      .update({ ai_analysis: analysis, ai_analyzed_at: new Date().toISOString() })
      .eq('id', creative_id)

    return NextResponse.json({ analysis })
  }

  // Generate tasks from AI
  if (type === 'generate_tasks') {
    const { data: clients } = await supabase
      .from('client_summary')
      .select('id, name, health_score, open_alerts_count, pending_recommendations_count')
      .eq('is_active', true)
      .lt('health_score', 60)
      .limit(10)

    const { data: openAlerts } = await supabase
      .from('alerts')
      .select('title, description, severity, client:clients(name)')
      .eq('status', 'open')
      .in('severity', ['critical', 'high'])
      .limit(20)

    const prompt = `Based on the following agency data, generate 5-8 actionable tasks for the campaign management team.

LOW HEALTH CLIENTS: ${JSON.stringify(clients, null, 2)}
CRITICAL/HIGH ALERTS: ${JSON.stringify(openAlerts, null, 2)}

Generate tasks as JSON array:
[
  {
    "title": "...",
    "description": "...",
    "priority": "urgent|high|medium|low",
    "client_name": "..."
  }
]`

    const generatedTasks = await generateJSON<Array<{
      title: string; description: string; priority: string; client_name: string
    }>>(prompt, true)

    // Get client IDs
    const clientNames = [...new Set(generatedTasks.map(t => t.client_name))]
    const { data: clientsForTasks } = await supabase
      .from('clients')
      .select('id, name')
      .in('name', clientNames)

    const clientIdMap = new Map(clientsForTasks?.map(c => [c.name, c.id]) ?? [])

    const tasks = generatedTasks.map(t => ({
      title: t.title,
      description: t.description,
      priority: t.priority || 'medium',
      client_id: clientIdMap.get(t.client_name) || null,
      created_by: user.id,
      is_ai_generated: true,
      status: 'todo',
    }))

    const { data: createdTasks, error } = await supabase
      .from('tasks')
      .insert(tasks)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log activity
    await supabase.from('activity_log').insert({
      user_id: user.id,
      activity_type: 'task_created',
      description: `AI generated ${createdTasks?.length || 0} tasks`,
    })

    return NextResponse.json({ tasks: createdTasks })
  }

  // Generate recommendation from alert
  if (!alert_id) {
    return NextResponse.json({ error: 'alert_id required' }, { status: 400 })
  }

  // Check if recommendation already exists for this alert
  const { data: existing } = await supabase
    .from('ai_recommendations')
    .select('id')
    .eq('alert_id', alert_id)
    .eq('status', 'pending')
    .single()

  if (existing) {
    return NextResponse.json({ data: existing, cached: true })
  }

  const { data: alert } = await supabase
    .from('alerts')
    .select('*, client:clients(id, name, target_roas, target_cpa, currency)')
    .eq('id', alert_id)
    .single()

  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 })

  // Get recent performance for context
  const { data: perfData } = await supabase
    .from('performance_metrics')
    .select('spend, conversions, roas, cpa, ctr, date, entity_id')
    .eq('entity_type', 'account')
    .gte('date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(14)

  const context = {
    client: alert.client,
    recent_performance: perfData || [],
    alert_context: alert.context_data,
  }

  const prompt = buildRecommendationPrompt(alert, context)

  let recData: {
    action_type: string
    title: string
    diagnosis: string
    explanation: string
    recommended_action: string
    expected_impact: string
    confidence_score: number
    risk_level: string
    action_params: Record<string, unknown>
  }

  try {
    recData = await generateJSON(prompt, false)
  } catch {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }

  const { data: recommendation, error: recError } = await supabase
    .from('ai_recommendations')
    .insert({
      alert_id,
      client_id: alert.client_id,
      action_type: recData.action_type,
      title: recData.title,
      diagnosis: recData.diagnosis,
      explanation: recData.explanation,
      recommended_action: recData.recommended_action,
      expected_impact: recData.expected_impact,
      confidence_score: Math.min(1, Math.max(0, recData.confidence_score || 0.5)),
      risk_level: recData.risk_level || 'medium',
      action_params: recData.action_params || {},
      requires_second_approval: recData.risk_level === 'high',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (recError) return NextResponse.json({ error: recError.message }, { status: 500 })

  // Log activity
  await supabase.from('activity_log').insert({
    user_id: user.id,
    client_id: alert.client_id,
    activity_type: 'recommendation_created',
    entity_id: recommendation.id,
    description: `AI recommendation created: ${recData.title}`,
  })

  return NextResponse.json({ data: recommendation })
}
