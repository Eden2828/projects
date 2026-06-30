import { getMetaConfig, META_GRAPH_BASE, META_OAUTH_DIALOG, META_SCOPES } from './config'

// ============================================================
// metaAuthService (Phase 5 — placeholder, dev-mode ready)
// ============================================================
// Implements the OAuth handshake. When credentials are present it produces a
// real Meta authorization URL and exchanges the code for a token. When they are
// absent, callers should short-circuit with the "not configured" message before
// reaching here.

export function buildAuthUrl(state: string): string {
  const cfg = getMetaConfig()
  if (!cfg) throw new Error('META_NOT_CONFIGURED')
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    state,
    scope: META_SCOPES.join(','),
    response_type: 'code',
  })
  return `${META_OAUTH_DIALOG}?${params.toString()}`
}

export interface MetaTokenResult {
  accessToken: string
  expiresInSeconds: number | null
}

/** Exchange the OAuth `code` for a (short-lived) access token. */
export async function exchangeCodeForToken(code: string): Promise<MetaTokenResult> {
  const cfg = getMetaConfig()
  if (!cfg) throw new Error('META_NOT_CONFIGURED')
  const params = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: cfg.redirectUri,
    code,
  })
  const res = await fetch(`${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Meta token exchange failed: ${res.status} ${body}`)
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number }
  return { accessToken: json.access_token, expiresInSeconds: json.expires_in ?? null }
}

/** Upgrade a short-lived token to a long-lived (~60 day) token. */
export async function exchangeForLongLivedToken(shortToken: string): Promise<MetaTokenResult> {
  const cfg = getMetaConfig()
  if (!cfg) throw new Error('META_NOT_CONFIGURED')
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: shortToken,
  })
  const res = await fetch(`${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`)
  if (!res.ok) throw new Error(`Long-lived token exchange failed: ${res.status}`)
  const json = (await res.json()) as { access_token: string; expires_in?: number }
  return { accessToken: json.access_token, expiresInSeconds: json.expires_in ?? null }
}
