import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMetaConfigured, META_NOT_CONFIGURED_MESSAGE } from '@/lib/meta/services/config'
import { getConnection, getMyBusinessId } from '@/lib/meta/services/connection'
import { publishCampaign } from '@/lib/meta/services/metaCampaignService'
import { generatedCampaignPlanSchema } from '@/lib/adpilot/campaign-schema'
import { logAudit } from '@/lib/adpilot/audit'

// POST /api/meta/publish-campaign  (Phase 5)
// Body: { draft_id, ad_account_id }
// MVP: dry-run only — publishing live ads is intentionally not enabled.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isMetaConfigured()) {
    return NextResponse.json({ error: META_NOT_CONFIGURED_MESSAGE, configured: false }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const draftId = body.draft_id as string | undefined
  const adAccountId = body.ad_account_id as string | undefined
  if (!draftId || !adAccountId) {
    return NextResponse.json({ error: 'draft_id and ad_account_id are required' }, { status: 400 })
  }

  const businessId = await getMyBusinessId(supabase, user.id)
  if (!businessId) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  // Load the draft (RLS ensures ownership).
  const { data: draft } = await supabase
    .from('ap_campaign_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('business_id', businessId)
    .maybeSingle()
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const plan = generatedCampaignPlanSchema.safeParse(draft.plan_json)
  if (!plan.success) {
    return NextResponse.json({ error: 'Draft plan is invalid; regenerate it.' }, { status: 422 })
  }

  const admin = createAdminClient()
  const conn = await getConnection(admin, businessId)
  if (!conn) {
    return NextResponse.json({ error: 'Meta account not connected', connected: false }, { status: 409 })
  }

  const result = await publishCampaign(conn.accessToken, adAccountId, plan.data)

  await logAudit(admin, {
    businessId,
    actorType: 'user',
    action: 'publish_campaign_dry_run',
    metadata: { draft_id: draftId, ad_account_id: adAccountId, dry_run: result.dryRun },
  })

  return NextResponse.json({ data: result })
}
