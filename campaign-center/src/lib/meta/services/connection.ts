import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptToken } from '@/lib/adpilot/crypto'

// Loads + decrypts the Meta access token for a business. Use the service-role
// (admin) client — the encrypted token column is never exposed to the browser.
export async function getConnection(admin: SupabaseClient, businessId: string) {
  const { data } = await admin
    .from('ap_meta_connections')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle()
  if (!data || data.status !== 'connected' || !data.access_token_encrypted) return null
  let accessToken: string
  try {
    accessToken = decryptToken(data.access_token_encrypted)
  } catch {
    return null
  }
  return { ...data, accessToken }
}

// Resolves the caller's business id from a user-scoped (RLS) client.
export async function getMyBusinessId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('ap_businesses')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}
