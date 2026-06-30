import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const assignedTo = searchParams.get('assigned_to')
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('tasks')
    .select(`
      *,
      client:clients(id, name, logo_url),
      assignee:profiles!assigned_to(id, full_name, avatar_url)
    `)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
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
  const { title, description, priority, status, assigned_to, due_date, client_id, labels } = body

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title,
      description: description || null,
      priority: priority || 'medium',
      status: status || 'todo',
      assigned_to: assigned_to || null,
      due_date: due_date || null,
      client_id: client_id || null,
      labels: labels || [],
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    user_id: user.id,
    client_id: client_id || null,
    activity_type: 'task_created',
    entity_id: data.id,
    description: `Task created: ${title}`,
  })

  return NextResponse.json({ data }, { status: 201 })
}
