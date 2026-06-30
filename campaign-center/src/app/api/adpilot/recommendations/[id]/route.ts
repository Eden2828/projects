import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/adpilot/audit'
import type { ApRecoStatus } from '@/lib/adpilot/types'

const VALID: ApRecoStatus[] = ['pending', 'approved', 'rejected', 'applied']

// PATCH /api/adpilot/recommendations/:id   (Phase 7)
// Body: { status }. Allowed for the owning user OR an admin.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const status = body.status as ApRecoStatus
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load the recommendation + owning business.
  const { data: reco } = await admin
    .from('ap_recommendations')
    .select('id, business_id, recommendation_type, ap_businesses!inner(user_id)')
    .eq('id', id)
    .maybeSingle()
  if (!reco) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Authorize: owner or admin.
  const { data: me } = await admin.from('ap_users').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = me?.role === 'admin'
  const ownerId = (reco as any).ap_businesses?.user_id
  if (!isAdmin && ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: updated, error } = await admin
    .from('ap_recommendations')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(admin, {
    businessId: reco.business_id,
    actorType: isAdmin ? 'admin' : 'user',
    action: `recommendation_${status}`,
    metadata: { recommendation_id: id, type: reco.recommendation_type },
  })

  // NOTE (Phase 4): approving a recommendation does NOT auto-execute any Meta
  // change in the MVP — execution is gated behind live publishing, which is
  // disabled until credentials + app review are in place.
  return NextResponse.json({ data: updated })
}
