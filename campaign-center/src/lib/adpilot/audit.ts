import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApActorType } from './types'

// Append-only audit logging. Pass a service-role (admin) client so writes always
// succeed regardless of RLS. Every recommendation and every action should call this.
export async function logAudit(
  admin: SupabaseClient,
  entry: {
    businessId: string | null
    actorType: ApActorType
    action: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await admin.from('ap_audit_logs').insert({
    business_id: entry.businessId,
    actor_type: entry.actorType,
    action: entry.action,
    metadata_json: entry.metadata ?? {},
  })
}
