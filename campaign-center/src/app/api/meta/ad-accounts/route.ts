import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMetaConfigured, META_NOT_CONFIGURED_MESSAGE } from '@/lib/meta/services/config'
import { getConnection, getMyBusinessId } from '@/lib/meta/services/connection'
import { listAdAccounts } from '@/lib/meta/services/metaCampaignService'

// GET /api/meta/ad-accounts  (Phase 5)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isMetaConfigured()) {
    return NextResponse.json({ error: META_NOT_CONFIGURED_MESSAGE, configured: false }, { status: 503 })
  }

  const businessId = await getMyBusinessId(supabase, user.id)
  if (!businessId) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const admin = createAdminClient()
  const conn = await getConnection(admin, businessId)
  if (!conn) {
    return NextResponse.json({ error: 'Meta account not connected', connected: false }, { status: 409 })
  }

  try {
    const accounts = await listAdAccounts(conn.accessToken)
    return NextResponse.json({ data: accounts })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch ad accounts' }, { status: 502 })
  }
}
