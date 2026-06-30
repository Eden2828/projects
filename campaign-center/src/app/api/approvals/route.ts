import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recommendation_id, action, notes } = await req.json()

  if (!recommendation_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Get recommendation
  const { data: rec } = await supabase
    .from('ai_recommendations')
    .select('*')
    .eq('id', recommendation_id)
    .single()

  if (!rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
  if (rec.status !== 'pending') {
    return NextResponse.json({ error: `Cannot ${action} a ${rec.status} recommendation` }, { status: 400 })
  }

  // Check role for high-risk actions
  if (rec.requires_second_approval || rec.risk_level === 'high') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['admin', 'team_lead'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'High-risk actions require Team Lead or Admin approval' }, { status: 403 })
    }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  if (action === 'reject') {
    await admin
      .from('ai_recommendations')
      .update({
        status: 'rejected',
        rejected_by: user.id,
        rejection_reason: notes || null,
        updated_at: now,
      })
      .eq('id', recommendation_id)

    await admin.from('approval_log').insert({
      recommendation_id,
      user_id: user.id,
      action: 'rejected',
      approval_level: 1,
      notes: notes || null,
    })

    await admin.from('activity_log').insert({
      user_id: user.id,
      client_id: rec.client_id,
      activity_type: 'recommendation_rejected',
      entity_id: recommendation_id,
      description: `AI recommendation rejected: ${rec.title}`,
      metadata: { reason: notes },
    })

    return NextResponse.json({ success: true, status: 'rejected' })
  }

  // Approve
  let newStatus: string
  let updateData: Record<string, unknown>

  if (!rec.first_approved_by) {
    // First approval
    if (rec.requires_second_approval) {
      newStatus = 'approved' // But still needs second approval for execution
      updateData = {
        first_approved_by: user.id,
        first_approved_at: now,
        status: 'approved',
        updated_at: now,
      }
    } else {
      newStatus = 'approved'
      updateData = {
        first_approved_by: user.id,
        first_approved_at: now,
        status: 'approved',
        updated_at: now,
      }
    }
  } else {
    // Second approval
    newStatus = 'approved'
    updateData = {
      second_approved_by: user.id,
      second_approved_at: now,
      status: 'approved',
      updated_at: now,
    }
  }

  await admin
    .from('ai_recommendations')
    .update(updateData)
    .eq('id', recommendation_id)

  await admin.from('approval_log').insert({
    recommendation_id,
    user_id: user.id,
    action: 'approved',
    approval_level: rec.first_approved_by ? 2 : 1,
    notes: notes || null,
  })

  await admin.from('activity_log').insert({
    user_id: user.id,
    client_id: rec.client_id,
    activity_type: 'recommendation_approved',
    entity_id: recommendation_id,
    description: `AI recommendation approved: ${rec.title}`,
  })

  // Auto-execute if fully approved
  if (newStatus === 'approved' && (!rec.requires_second_approval || updateData.second_approved_by)) {
    // Queue for execution
    const execUrl = `${process.env.NEXTAUTH_URL || ''}/api/meta/actions`
    fetch(execUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass auth via service token for background execution
      },
      body: JSON.stringify({ recommendation_id }),
    }).catch(err => console.error('Auto-execution failed:', err))
  }

  return NextResponse.json({ success: true, status: newStatus })
}
