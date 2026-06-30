import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMetaConfigured, META_NOT_CONFIGURED_MESSAGE } from '@/lib/meta/services/config'
import { exchangeCodeForToken, exchangeForLongLivedToken } from '@/lib/meta/services/metaAuthService'
import { encryptToken } from '@/lib/adpilot/crypto'
import { logAudit } from '@/lib/adpilot/audit'

// GET /api/meta/auth/callback  (Phase 5) — Meta redirects here with ?code & ?state.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/app/login', req.url))

  if (!isMetaConfigured()) {
    return NextResponse.json({ error: META_NOT_CONFIGURED_MESSAGE }, { status: 503 })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const settingsUrl = new URL('/app/settings', req.url)

  if (error || !code || !stateRaw) {
    settingsUrl.searchParams.set('meta', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  // Decode + verify state belongs to this user.
  let businessId: string
  try {
    const state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'))
    if (state.u !== user.id) throw new Error('state user mismatch')
    businessId = state.b
  } catch {
    settingsUrl.searchParams.set('meta', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const short = await exchangeCodeForToken(code)
    // Best-effort upgrade to a long-lived token.
    let token = short
    try { token = await exchangeForLongLivedToken(short.accessToken) } catch { /* keep short-lived */ }

    const expiresAt = token.expiresInSeconds
      ? new Date(Date.now() + token.expiresInSeconds * 1000).toISOString()
      : null

    const admin = createAdminClient()
    await admin
      .from('ap_meta_connections')
      .upsert(
        {
          business_id: businessId,
          access_token_encrypted: encryptToken(token.accessToken),
          token_expires_at: expiresAt,
          status: 'connected',
        },
        { onConflict: 'business_id' }
      )

    await logAudit(admin, {
      businessId,
      actorType: 'user',
      action: 'meta_connected',
      metadata: { expires_at: expiresAt },
    })

    settingsUrl.searchParams.set('meta', 'connected')
    return NextResponse.redirect(settingsUrl)
  } catch (e: any) {
    settingsUrl.searchParams.set('meta', 'error')
    return NextResponse.redirect(settingsUrl)
  }
}
