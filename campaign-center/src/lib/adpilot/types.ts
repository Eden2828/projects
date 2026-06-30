// AdPilot — shared domain types (mirror the ap_* Supabase tables).

export type ApRole = 'user' | 'admin'
export type ApGoal = 'leads' | 'messages' | 'sales' | 'traffic'
export type ApBudgetType = 'daily' | 'lifetime'
export type ApDraftStatus = 'draft' | 'approved' | 'published' | 'archived'
export type ApRecoStatus = 'pending' | 'approved' | 'rejected' | 'applied'
export type ApAlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type ApAlertStatus = 'open' | 'resolved'
export type ApActorType = 'user' | 'admin' | 'system' | 'ai'
export type ApMetaStatus = 'disconnected' | 'pending' | 'connected' | 'expired' | 'error'

export interface ApUser {
  id: string
  email: string
  name: string | null
  role: ApRole
  created_at: string
}

export interface ApBusiness {
  id: string
  user_id: string
  business_name: string
  industry: string | null
  location: string | null
  website_url: string | null
  instagram_url: string | null
  facebook_page_url: string | null
  whatsapp_number: string | null
  main_offer: string | null
  monthly_budget: number | null
  goal: ApGoal | null
  created_at: string
  updated_at: string
}

export interface ApQuestionnaireAnswers {
  id: string
  business_id: string
  answers_json: Record<string, unknown>
  created_at: string
}

export interface ApCampaignDraft {
  id: string
  business_id: string
  platform: string
  objective: string | null
  campaign_name: string | null
  budget_type: ApBudgetType | null
  daily_budget: number | null
  target_audience_json: Record<string, unknown>
  ad_sets_json: unknown[]
  ads_json: unknown[]
  creative_briefs_json: unknown[]
  plan_json: GeneratedCampaignPlan | Record<string, unknown>
  status: ApDraftStatus
  created_at: string
  updated_at: string
}

export interface ApRecommendation {
  id: string
  business_id: string
  campaign_draft_id: string | null
  recommendation_type: string
  title: string
  description: string | null
  priority: ApAlertSeverity
  status: ApRecoStatus
  metadata_json: Record<string, unknown>
  created_at: string
}

export interface ApAlert {
  id: string
  business_id: string
  severity: ApAlertSeverity
  title: string
  message: string | null
  status: ApAlertStatus
  created_at: string
}

export interface ApMetaConnection {
  id: string
  business_id: string
  meta_user_id: string | null
  ad_account_id: string | null
  page_id: string | null
  instagram_account_id: string | null
  token_expires_at: string | null
  status: ApMetaStatus
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------
// Structured AI campaign plan (shape returned by /api/ai/generate-campaign)
// Mirrored exactly by the Zod schema in campaign-schema.ts.
// ---------------------------------------------------------------
export interface GeneratedAd {
  ad_name: string
  primary_text: string
  headline: string
  description: string
  cta: string
  creative_brief: string
}

export interface GeneratedAdSet {
  ad_set_name: string
  audience_summary: string
  age_min: number
  age_max: number
  genders: string
  locations: string[]
  interests: string[]
  placements: string[]
}

export interface GeneratedCampaignPlan {
  recommended_objective: string
  campaign_name: string
  budget_recommendation: {
    budget_type: ApBudgetType
    daily_budget: number
    currency: string
    rationale: string
  }
  audience_strategy: string
  ad_sets: GeneratedAdSet[]
  ads: GeneratedAd[]
  landing_page_recommendation: string
  risks_and_assumptions: string[]
  optimization_plan_14_days: { day_range: string; action: string }[]
}
