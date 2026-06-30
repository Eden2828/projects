import { createClient } from '@/lib/supabase/server'
import type {
  ApUser, ApBusiness, ApCampaignDraft, ApRecommendation, ApAlert,
} from './types'

// Server-side data access for AdPilot pages. All reads go through the user's
// session client, so RLS guarantees a user only ever sees their own data
// (admins additionally have read-all policies).

export async function getApUser(): Promise<ApUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('ap_users').select('*').eq('id', user.id).maybeSingle()
  if (data) return data as ApUser
  // Fallback if the signup trigger hasn't populated ap_users yet.
  return { id: user.id, email: user.email ?? '', name: null, role: 'user', created_at: new Date().toISOString() }
}

export async function isAdmin(): Promise<boolean> {
  const u = await getApUser()
  return u?.role === 'admin'
}

export async function getMyBusiness(): Promise<ApBusiness | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('ap_businesses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as ApBusiness) ?? null
}

export async function getMyDrafts(): Promise<ApCampaignDraft[]> {
  const biz = await getMyBusiness()
  if (!biz) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('ap_campaign_drafts')
    .select('*')
    .eq('business_id', biz.id)
    .order('created_at', { ascending: false })
  return (data as ApCampaignDraft[]) ?? []
}

export async function getDraft(id: string): Promise<ApCampaignDraft | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('ap_campaign_drafts').select('*').eq('id', id).maybeSingle()
  return (data as ApCampaignDraft) ?? null
}

export async function getMyRecommendations(): Promise<ApRecommendation[]> {
  const biz = await getMyBusiness()
  if (!biz) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('ap_recommendations')
    .select('*')
    .eq('business_id', biz.id)
    .order('created_at', { ascending: false })
  return (data as ApRecommendation[]) ?? []
}

export async function getMyAlerts(): Promise<ApAlert[]> {
  const biz = await getMyBusiness()
  if (!biz) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('ap_alerts')
    .select('*')
    .eq('business_id', biz.id)
    .order('created_at', { ascending: false })
  return (data as ApAlert[]) ?? []
}

export interface AdminOverviewRow {
  business_id: string
  business_name: string
  industry: string | null
  goal: string | null
  monthly_budget: number | null
  owner_email: string
  owner_name: string | null
  created_at: string
  drafts_count: number
  pending_recos: number
  open_alerts: number
  meta_status: string | null
}

export async function getAdminOverview(): Promise<AdminOverviewRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ap_admin_business_overview')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as AdminOverviewRow[]) ?? []
}
