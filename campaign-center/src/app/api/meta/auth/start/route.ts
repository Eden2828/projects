import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMetaConfigured, META_NOT_CONFIGURED_MESSAGE } from '@/lib/meta/services/config'
import { buildAuthUrl } from '@/lib/meta/services/metaAuthService'

// GET /api/meta/auth/start  (Phase 5) — begins the Meta OAuth flow.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isMetaConfigured()) {
    return NextResponse.json({ error: META_NOT_CONFIGURED_MESSAGE, configured: false }, { status: 503 })
  }

  // Resolve the caller's business so we can attach the connection to it.
  const { data: business } = await supabase
    .from('ap_businesses')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'Complete onboarding before connecting Meta.' }, { status: 400 })
  }

  // State carries the business id + user id (verified on callback).
  const state = Buffer.from(JSON.stringify({ b: business.id, u: user.id })).toString('base64url')
  return NextResponse.redirect(buildAuthUrl(state))
}
