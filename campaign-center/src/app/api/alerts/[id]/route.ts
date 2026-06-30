import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { status, snoozed_until } = body

  const updateData: Record<string, unknown> = {}

  if (status === 'acknowledged') {
    updateData.status = 'acknowledged'
    updateData.acknowledged_by = user.id
    updateData.acknowledged_at = new Date().toISOString()
  } else if (status === 'resolved') {
    updateData.status = 'resolved'
    updateData.resolved_by = user.id
    updateData.resolved_at = new Date().toISOString()
  } else if (status === 'ignored') {
    updateData.status = 'ignored'
  }

  if (snoozed_until) {
    updateData.snoozed_until = snoozed_until
  }

  const { data, error } = await supabase
    .from('alerts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (status === 'resolved') {
    await supabase.from('activity_log').insert({
      user_id: user.id,
      client_id: data.client_id,
      activity_type: 'alert_resolved',
      entity_id: id,
      description: `Alert resolved: ${data.title}`,
    })
  }

  return NextResponse.json({ data })
}
