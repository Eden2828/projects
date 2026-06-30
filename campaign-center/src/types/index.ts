// ============================================================
// Core Domain Types — Think Digital Campaign Operations Platform
// ============================================================

export type UserRole = 'admin' | 'team_lead' | 'campaign_manager' | 'viewer'
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertType =
  | 'billing_issue' | 'rejected_ads' | 'learning_limited'
  | 'cpa_increase' | 'roas_decrease' | 'ctr_decrease'
  | 'frequency_increase' | 'spend_anomaly' | 'conversion_drop'
  | 'campaign_inactive' | 'budget_pacing' | 'ad_fatigue'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'ignored'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'
export type EntityType = 'campaign' | 'adset' | 'ad' | 'account'
export type RecommendationAction =
  | 'increase_budget' | 'decrease_budget' | 'pause_ad' | 'pause_adset'
  | 'pause_campaign' | 'duplicate_winner' | 'refresh_creatives'
  | 'expand_audience' | 'narrow_audience' | 'change_bid_strategy'
  | 'add_negative_keywords' | 'scale_winner'
export type SyncStatus = 'pending' | 'running' | 'success' | 'failed'
export type HealthTrend = 'up' | 'down' | 'stable'

// ============================================================
// User / Profile
// ============================================================

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  preferences: UserPreferences
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system'
  notifications: { email: boolean; browser: boolean }
  dashboard: { sort: string; view: 'grid' | 'list' }
  ai_preferences: string[]
}

// ============================================================
// Client
// ============================================================

export interface Client {
  id: string
  name: string
  slug: string
  logo_url: string | null
  industry: string | null
  website: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  currency: string
  timezone: string
  monthly_budget: number | null
  target_roas: number | null
  target_cpa: number | null
  notes: string | null
  tags: string[]
  assigned_managers: string[]
  is_active: boolean
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export interface ClientSummary extends Client {
  health_score: number | null
  health_trend: HealthTrend | null
  health_explanation: string | null
  health_components: HealthScoreComponents | null
  health_calculated_at: string | null
  open_alerts_count: number
  critical_alerts_count: number
  pending_recommendations_count: number
  active_accounts_count: number
  // Aggregated from performance
  total_spend?: number
  total_impressions?: number
  total_clicks?: number
  total_conversions?: number
  avg_roas?: number
  avg_cpa?: number
  avg_ctr?: number
}

// ============================================================
// Health Score
// ============================================================

export interface HealthScoreComponents {
  cpa: { score: number; weight: number; value: number; target: number | null }
  ctr: { score: number; weight: number; value: number }
  cpm: { score: number; weight: number; value: number }
  roas: { score: number; weight: number; value: number; target: number | null }
  frequency: { score: number; weight: number; value: number }
  billing: { score: number; weight: number; status: string }
  rejected_ads: { score: number; weight: number; count: number }
  budget_pacing: { score: number; weight: number; pacing_ratio: number }
  trend: { score: number; weight: number; direction: HealthTrend }
}

export interface HealthScore {
  id: string
  client_id: string
  score: number
  components: HealthScoreComponents
  explanation: string | null
  trend: HealthTrend | null
  previous_score: number | null
  calculated_at: string
  date: string
}

// ============================================================
// Ad Account
// ============================================================

export interface AdAccount {
  id: string
  client_id: string
  meta_account_id: string
  account_name: string
  account_status: number | null
  currency: string
  timezone_name: string | null
  business_name: string | null
  daily_budget_limit: number | null
  total_spent: number
  last_synced_at: string | null
  sync_status: SyncStatus
  sync_error: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================
// Campaign / AdSet / Ad
// ============================================================

export interface Campaign {
  id: string
  ad_account_id: string
  meta_campaign_id: string
  name: string
  status: string | null
  objective: string | null
  buying_type: string | null
  daily_budget: number | null
  lifetime_budget: number | null
  start_time: string | null
  stop_time: string | null
  created_at: string
  updated_at: string
}

export interface AdSet {
  id: string
  campaign_id: string
  meta_adset_id: string
  name: string
  status: string | null
  daily_budget: number | null
  lifetime_budget: number | null
  optimization_goal: string | null
  billing_event: string | null
  bid_amount: number | null
  targeting: Record<string, unknown> | null
  start_time: string | null
  end_time: string | null
  created_at: string
  updated_at: string
}

export interface Ad {
  id: string
  ad_set_id: string
  meta_ad_id: string
  name: string
  status: string | null
  creative_id: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Creative
// ============================================================

export interface Creative {
  id: string
  ad_account_id: string
  meta_creative_id: string
  name: string | null
  title: string | null
  body: string | null
  call_to_action: string | null
  image_url: string | null
  video_url: string | null
  thumbnail_url: string | null
  format: string | null
  object_type: string | null
  ai_analysis: CreativeAIAnalysis | null
  ai_analyzed_at: string | null
  created_at: string
  updated_at: string
  // From joins
  performance?: PerformanceMetrics
}

export interface CreativeAIAnalysis {
  hook_quality: 'strong' | 'moderate' | 'weak'
  emotional_appeal: string
  call_to_action_strength: 'strong' | 'moderate' | 'weak'
  visual_quality: string
  messaging_clarity: string
  performance_prediction: string
  improvement_suggestions: string[]
  why_performing: string
  audience_fit: string
}

// ============================================================
// Performance Metrics
// ============================================================

export interface PerformanceMetrics {
  id: string
  entity_type: EntityType
  entity_id: string
  date: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  reach: number
  frequency: number
  cpm: number | null
  cpc: number | null
  ctr: number | null
  cpa: number | null
  roas: number | null
  quality_ranking: string | null
  engagement_rate_ranking: string | null
  conversion_rate_ranking: string | null
}

// ============================================================
// Alert
// ============================================================

export interface Alert {
  id: string
  client_id: string
  ad_account_id: string | null
  entity_type: EntityType | null
  entity_id: string | null
  entity_name: string | null
  alert_type: AlertType
  severity: AlertSeverity
  status: AlertStatus
  title: string
  description: string
  metric_name: string | null
  metric_value: number | null
  metric_threshold: number | null
  metric_change_pct: number | null
  context_data: Record<string, unknown>
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_by: string | null
  resolved_at: string | null
  auto_resolved: boolean
  snoozed_until: string | null
  created_at: string
  updated_at: string
  // Joins
  client?: Pick<Client, 'id' | 'name' | 'logo_url'>
}

// ============================================================
// AI Recommendation
// ============================================================

export interface AIRecommendation {
  id: string
  alert_id: string | null
  client_id: string
  ad_account_id: string | null
  entity_type: EntityType | null
  entity_id: string | null
  entity_name: string | null
  action_type: RecommendationAction
  title: string
  diagnosis: string
  explanation: string
  recommended_action: string
  expected_impact: string
  confidence_score: number
  risk_level: 'low' | 'medium' | 'high' | null
  action_params: Record<string, unknown>
  status: ApprovalStatus
  requires_second_approval: boolean
  first_approved_by: string | null
  first_approved_at: string | null
  second_approved_by: string | null
  second_approved_at: string | null
  rejected_by: string | null
  rejection_reason: string | null
  executed_at: string | null
  execution_result: Record<string, unknown> | null
  expires_at: string | null
  created_at: string
  updated_at: string
  // Joins
  client?: Pick<Client, 'id' | 'name' | 'logo_url'>
  alert?: Alert
}

// ============================================================
// AI Conversation
// ============================================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  metadata?: Record<string, unknown>
}

export interface AIConversation {
  id: string
  user_id: string
  client_id: string | null
  title: string | null
  messages: ChatMessage[]
  context: Record<string, unknown>
  token_count: number
  created_at: string
  updated_at: string
}

// ============================================================
// Task
// ============================================================

export interface Task {
  id: string
  client_id: string | null
  campaign_id: string | null
  recommendation_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigned_to: string | null
  created_by: string
  due_date: string | null
  completed_at: string | null
  labels: string[]
  attachments: TaskAttachment[]
  is_ai_generated: boolean
  parent_task_id: string | null
  created_at: string
  updated_at: string
  // Joins
  client?: Pick<Client, 'id' | 'name' | 'logo_url'>
  assignee?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
  comments?: TaskComment[]
}

export interface TaskAttachment {
  name: string
  url: string
  size: number
  type: string
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  user?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

// ============================================================
// Report
// ============================================================

export interface Report {
  id: string
  client_id: string
  created_by: string
  title: string
  type: 'weekly' | 'monthly' | 'custom' | 'daily_brief'
  format: 'pdf' | 'pptx' | 'xlsx'
  date_from: string
  date_to: string
  content: ReportContent
  file_url: string | null
  file_size: number | null
  status: 'generating' | 'ready' | 'failed'
  error: string | null
  generated_at: string | null
  created_at: string
}

export interface ReportContent {
  kpis?: Record<string, unknown>
  charts?: unknown[]
  insights?: string[]
  recommendations?: string[]
  top_creatives?: unknown[]
  problems?: string[]
  opportunities?: string[]
  summary?: string
}

// ============================================================
// Date Range
// ============================================================

export type DateRangePreset =
  | 'today' | 'yesterday' | 'last_7_days' | 'last_14_days'
  | 'last_30_days' | 'this_month' | 'last_month' | 'custom'

export interface DateRange {
  preset: DateRangePreset
  from: string // ISO date
  to: string   // ISO date
  label: string
}

// ============================================================
// Cross-Account Insights
// ============================================================

export interface CrossAccountInsight {
  id: string
  category: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  affected_clients: string[]
  data_points: Record<string, unknown>
  generated_at: string
}

// ============================================================
// Daily Brief
// ============================================================

export interface DailyBrief {
  date: string
  total_clients: number
  clients_needing_attention: number
  billing_issues: number
  critical_alerts: number
  high_alerts: number
  scaling_opportunities: number
  top_performers: Array<{ client_id: string; client_name: string; roas: number }>
  worst_performers: Array<{ client_id: string; client_name: string; health_score: number }>
  total_spend: number
  total_conversions: number
  total_roas: number
  action_items: Array<{ priority: TaskPriority; title: string; client_name: string }>
  generated_at: string
}

// ============================================================
// Meta API
// ============================================================

export interface MetaAdAccount {
  id: string
  name: string
  account_status: number
  currency: string
  timezone_name: string
  business_name?: string
  amount_spent?: string
  balance?: string
}

export interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  buying_type?: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
}

// ============================================================
// API Responses
// ============================================================

export interface ApiResponse<T> {
  data: T
  error: string | null
  meta?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ============================================================
// Filter / Sort
// ============================================================

export interface ClientFilters {
  search: string
  health_status: ('critical' | 'warning' | 'good' | 'excellent' | 'all')
  has_alerts: boolean | null
  has_recommendations: boolean | null
  tags: string[]
  assigned_to: string | null
  sort_by: 'health_score' | 'name' | 'spend' | 'alerts' | 'updated_at'
  sort_dir: 'asc' | 'desc'
}

export interface AlertFilters {
  severity: AlertSeverity[]
  type: AlertType[]
  status: AlertStatus[]
  client_id: string | null
  date_from: string | null
  date_to: string | null
}
