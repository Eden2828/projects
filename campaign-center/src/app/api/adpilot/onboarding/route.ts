import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/adpilot/audit'
import type { ApGoal } from '@/lib/adpilot/types'

const VALID_GOALS: ApGoal[] = ['leads', 'messages', 'sales', 'traffic']

// ============================================================
// POST /api/adpilot/onboarding   (Phase 2)
// Saves/updates the business profile and stores the full questionnaire answers.
// ============================================================
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const businessName = String(body.business_name || '').trim()
  if (!businessName) {
    return NextResponse.json({ error: 'נדרש שם עסק' }, { status: 400 })
  }

  const goal: ApGoal | null = VALID_GOALS.includes(body.goal) ? body.goal : null
  const monthlyBudget =
    body.monthly_budget != null && body.monthly_budget !== ''
      ? Number(body.monthly_budget)
      : null

  const businessFields = {
    user_id: user.id,
    business_name: businessName,
    industry: body.industry || null,
    location: body.location || null,
    website_url: body.website_url || null,
    instagram_url: body.instagram_url || null,
    facebook_page_url: body.facebook_page_url || null,
    whatsapp_number: body.whatsapp_number || null,
    main_offer: body.main_offer || null,
    monthly_budget: Number.isFinite(monthlyBudget as number) ? monthlyBudget : null,
    goal,
  }

  // Find an existing business for this user (1 business per user in the MVP).
  const { data: existing } = await supabase
    .from('ap_businesses')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let businessId = existing?.id as string | undefined
  let error
  if (businessId) {
    ;({ error } = await supabase.from('ap_businesses').update(businessFields).eq('id', businessId))
  } else {
    const ins = await supabase.from('ap_businesses').insert(businessFields).select('id').single()
    error = ins.error
    businessId = ins.data?.id
  }
  if (error || !businessId) {
    return NextResponse.json({ error: 'שמירת פרטי העסק נכשלה. נסו שוב.' }, { status: 500 })
  }

  // Store the complete questionnaire payload (free-form answers) as a snapshot.
  const answers = (body.answers && typeof body.answers === 'object') ? body.answers : body
  const { error: qaError } = await supabase
    .from('ap_questionnaire_answers')
    .insert({ business_id: businessId, answers_json: answers })
  if (qaError) return NextResponse.json({ error: qaError.message }, { status: 500 })

  await logAudit(createAdminClient(), {
    businessId,
    actorType: 'user',
    action: 'onboarding_submitted',
    metadata: { goal, monthly_budget: businessFields.monthly_budget },
  })

  return NextResponse.json({ data: { business_id: businessId } }, { status: 200 })
}
