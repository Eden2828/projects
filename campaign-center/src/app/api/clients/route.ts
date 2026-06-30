import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateHealthScore } from '@/lib/utils/health-score'
import { generateText } from '@/lib/gemini/client'
import { buildHealthScorePrompt } from '@/lib/gemini/prompts'
import type { PerformanceMetrics } from '@/types'
import { slugify } from '@/lib/utils/format'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('client_summary')
    .select('*')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: data?.length || 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin/team_lead only
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'team_lead'].includes(profile?.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const { name, industry, website, monthly_budget, target_roas, target_cpa, currency, ...rest } = body

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: client, error } = await admin
    .from('clients')
    .insert({
      name,
      slug: slugify(name),
      industry: industry || null,
      website: website || null,
      monthly_budget: monthly_budget || null,
      target_roas: target_roas || null,
      target_cpa: target_cpa || null,
      currency: currency || 'ILS',
      ...rest,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    user_id: user.id,
    client_id: client.id,
    activity_type: 'user_action',
    description: `Client created: ${name}`,
  })

  return NextResponse.json({ data: client }, { status: 201 })
}
