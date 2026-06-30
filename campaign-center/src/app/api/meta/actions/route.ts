import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MetaAPIClient } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recommendation_id } = await req.json()
  if (!recommendation_id) {
    return NextResponse.json({ error: 'recommendation_id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get recommendation with full approval chain
  const { data: rec } = await admin
    .from('ai_recommendations')
    .select('*, client:clients(*)')
    .eq('id', recommendation_id)
    .single()

  if (!rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })

  // Verify approval status
  if (rec.status !== 'approved') {
    return NextResponse.json({ error: 'Recommendation must be approved before execution' }, { status: 400 })
  }

  // Check if second approval is required
  if (rec.requires_second_approval && !rec.second_approved_by) {
    return NextResponse.json({ error: 'Second approval required' }, { status: 400 })
  }

  // Get account access token
  const { data: account } = await admin
    .from('ad_accounts')
    .select('*')
    .eq('client_id', rec.client_id)
    .eq('is_active', true)
    .single()

  if (!account?.access_token) {
    return NextResponse.json({ error: 'No valid access token for account' }, { status: 400 })
  }

  const meta = new MetaAPIClient(account.access_token)
  const params = rec.action_params || {}

  try {
    let result: unknown

    switch (rec.action_type) {
      case 'pause_campaign':
      case 'pause_adset':
      case 'pause_ad':
        if (!params.entity_id) throw new Error('entity_id required')
        await meta.pauseEntity(params.entity_id as string)
        result = { action: 'paused', entity_id: params.entity_id }
        break

      case 'increase_budget':
      case 'decrease_budget':
        if (!params.entity_id || !params.new_budget) throw new Error('entity_id and new_budget required')
        await meta.updateBudget(
          params.entity_id as string,
          params.entity_type as 'campaign' | 'adset' || 'campaign',
          params.new_budget as number
        )
        result = { action: 'budget_updated', new_budget: params.new_budget }
        break

      case 'duplicate_winner':
      case 'scale_winner':
        if (!params.entity_id) throw new Error('entity_id required')
        const newName = `${params.entity_name || 'Campaign'} - Scale ${new Date().toLocaleDateString()}`
        result = await meta.duplicateCampaign(params.entity_id as string, newName)
        break

      default:
        // For actions that can't be auto-executed, mark as requiring manual execution
        result = { action: rec.action_type, status: 'manual_required', params }
    }

    // Update recommendation status
    await admin
      .from('ai_recommendations')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        execution_result: result as Record<string, unknown>,
      })
      .eq('id', recommendation_id)

    // Log in approval log
    await admin.from('approval_log').insert({
      recommendation_id,
      user_id: user.id,
      action: 'executed',
      approval_level: 1,
    })

    // Log activity
    await admin.from('activity_log').insert({
      user_id: user.id,
      client_id: rec.client_id,
      activity_type: 'action_executed',
      entity_id: recommendation_id,
      description: `AI action executed: ${rec.title}`,
      metadata: { action_type: rec.action_type, result },
    })

    return NextResponse.json({ success: true, result })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Execution failed'

    await admin
      .from('ai_recommendations')
      .update({ status: 'failed', execution_result: { error: errorMsg } })
      .eq('id', recommendation_id)

    await admin.from('activity_log').insert({
      user_id: user.id,
      client_id: rec.client_id,
      activity_type: 'action_failed',
      entity_id: recommendation_id,
      description: `AI action failed: ${rec.title} — ${errorMsg}`,
    })

    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
