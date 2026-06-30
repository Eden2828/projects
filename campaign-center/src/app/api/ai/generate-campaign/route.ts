import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, AI_MODEL, isAIConfigured } from '@/lib/anthropic/client'
import { CAMPAIGN_SYSTEM_PROMPT, buildCampaignUserPrompt } from '@/lib/adpilot/prompts'
import { generatedCampaignPlanSchema, campaignPlanJsonSchema } from '@/lib/adpilot/campaign-schema'
import { logAudit } from '@/lib/adpilot/audit'
import type { ApBusiness } from '@/lib/adpilot/types'

export const maxDuration = 60

// ============================================================
// POST /api/ai/generate-campaign   (Phase 3)
// Body: { business_id?: string }  — defaults to the caller's business.
// ============================================================
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: 'ה-AI עדיין לא מוגדר. נדרש להוסיף מפתח AI (AI_API_KEY) בהגדרות.' },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  let businessId: string | undefined = body.business_id

  // Resolve the caller's business (RLS guarantees they can only read their own).
  let business: ApBusiness | null = null
  if (businessId) {
    const { data } = await supabase.from('ap_businesses').select('*').eq('id', businessId).single()
    business = data as ApBusiness | null
  } else {
    const { data } = await supabase
      .from('ap_businesses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    business = data as ApBusiness | null
    businessId = business?.id
  }

  if (!business || !businessId) {
    return NextResponse.json(
      { error: 'לא נמצא פרופיל עסק. השלימו קודם את השאלון.' },
      { status: 400 }
    )
  }

  // Latest questionnaire answers for richer context.
  const { data: qa } = await supabase
    .from('ap_questionnaire_answers')
    .select('answers_json')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const answers = (qa?.answers_json as Record<string, unknown>) ?? {}

  // ---- Call Claude with a constrained JSON output shape ----
  let parsedPlan
  try {
    const client = getAnthropic()
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: campaignPlanJsonSchema as any },
      },
      system: CAMPAIGN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildCampaignUserPrompt(business, answers) }],
    } as any)

    // Extract the JSON text block.
    const text = (response.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim()

    const raw = JSON.parse(text)

    // ---- VALIDATE before saving (Phase 3 requirement) ----
    const result = generatedCampaignPlanSchema.safeParse(raw)
    if (!result.success) {
      return NextResponse.json(
        { error: 'תשובת ה-AI לא עברה אימות. נסו שוב.', issues: result.error.issues },
        { status: 422 }
      )
    }
    parsedPlan = result.data
  } catch (e: any) {
    return NextResponse.json(
      { error: 'יצירת הקמפיין נכשלה. נסו שוב בעוד רגע.', detail: e?.message ?? String(e) },
      { status: 502 }
    )
  }

  // ---- Enforce the budget guardrail server-side too (never trust the model) ----
  const monthly = business.monthly_budget ?? 0
  const cap = monthly > 0 ? monthly / 30 : Infinity
  const safeDaily = Math.min(parsedPlan.budget_recommendation.daily_budget, cap)

  // ---- Persist the draft (service role; ownership already verified) ----
  const admin = createAdminClient()
  const { data: draft, error } = await admin
    .from('ap_campaign_drafts')
    .insert({
      business_id: businessId,
      platform: 'meta',
      objective: parsedPlan.recommended_objective,
      campaign_name: parsedPlan.campaign_name,
      budget_type: parsedPlan.budget_recommendation.budget_type,
      daily_budget: safeDaily,
      target_audience_json: { strategy: parsedPlan.audience_strategy },
      ad_sets_json: parsedPlan.ad_sets,
      ads_json: parsedPlan.ads,
      creative_briefs_json: parsedPlan.ads.map((a) => ({ ad_name: a.ad_name, brief: a.creative_brief })),
      plan_json: parsedPlan,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(admin, {
    businessId,
    actorType: 'ai',
    action: 'campaign_draft_generated',
    metadata: { draft_id: draft.id, model: AI_MODEL, capped: safeDaily !== parsedPlan.budget_recommendation.daily_budget },
  })

  return NextResponse.json({ data: draft }, { status: 201 })
}
