// Shared Meta API configuration + readiness check for AdPilot's Meta services.

export const META_API_VERSION = process.env.META_API_VERSION || 'v21.0'
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`
export const META_OAUTH_DIALOG = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`

// Permissions requested during OAuth (per spec).
export const META_SCOPES = ['ads_read', 'ads_management']

export interface MetaConfig {
  appId: string
  appSecret: string
  redirectUri: string
}

/**
 * Returns the Meta config if every required env var is present, otherwise null.
 * Callers MUST handle the null case by returning the
 * "Meta integration is not configured yet" message.
 */
export function getMetaConfig(): MetaConfig | null {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  const redirectUri = process.env.META_REDIRECT_URI
  if (!appId || !appSecret || !redirectUri) return null
  return { appId, appSecret, redirectUri }
}

export const META_NOT_CONFIGURED_MESSAGE = 'Meta integration is not configured yet.'

export function isMetaConfigured(): boolean {
  return getMetaConfig() !== null
}
