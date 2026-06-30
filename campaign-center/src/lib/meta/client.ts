import axios, { AxiosInstance } from 'axios'

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`
export const META_APP_ID = '4457830191115452'

export class MetaAPIClient {
  private client: AxiosInstance
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
    this.client = axios.create({
      baseURL: META_API_BASE,
      timeout: 30000,
    })
    this.client.interceptors.request.use(config => {
      config.params = { ...config.params, access_token: this.accessToken }
      return config
    })
    this.client.interceptors.response.use(
      r => r,
      err => {
        const msg = err.response?.data?.error?.message || err.message
        throw new Error(`Meta API Error: ${msg}`)
      }
    )
  }

  // ── Ad Accounts ────────────────────────────────────────────

  async getAdAccount(accountId: string) {
    const { data } = await this.client.get(`/act_${accountId}`, {
      params: {
        fields: 'id,name,account_status,currency,timezone_name,business_name,amount_spent,balance,spend_cap',
      },
    })
    return data
  }

  async getAdAccounts(businessId?: string) {
    const endpoint = businessId ? `/${businessId}/owned_ad_accounts` : '/me/adaccounts'
    const { data } = await this.client.get(endpoint, {
      params: { fields: 'id,name,account_status,currency,timezone_name,business_name,amount_spent' },
    })
    return data.data || []
  }

  // ── Campaigns ──────────────────────────────────────────────

  async getCampaigns(accountId: string, params: Record<string, string> = {}) {
    const { data } = await this.client.get(`/act_${accountId}/campaigns`, {
      params: {
        fields: 'id,name,status,objective,buying_type,daily_budget,lifetime_budget,start_time,stop_time,created_time',
        limit: 100,
        ...params,
      },
    })
    return data.data || []
  }

  // ── Ad Sets ────────────────────────────────────────────────

  async getAdSets(accountId: string, campaignId?: string, params: Record<string, string> = {}) {
    const endpoint = campaignId ? `/${campaignId}/adsets` : `/act_${accountId}/adsets`
    const { data } = await this.client.get(endpoint, {
      params: {
        fields: 'id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,targeting,start_time,end_time,campaign_id',
        limit: 200,
        ...params,
      },
    })
    return data.data || []
  }

  // ── Ads ────────────────────────────────────────────────────

  async getAds(accountId: string, adSetId?: string, params: Record<string, string> = {}) {
    const endpoint = adSetId ? `/${adSetId}/ads` : `/act_${accountId}/ads`
    const { data } = await this.client.get(endpoint, {
      params: {
        fields: 'id,name,status,creative{id,name,title,body,call_to_action_type,image_url,video_id,thumbnail_url,object_type},adset_id',
        limit: 200,
        ...params,
      },
    })
    return data.data || []
  }

  // ── Insights (Performance) ─────────────────────────────────

  async getInsights(
    entityId: string,
    entityType: 'account' | 'campaign' | 'adset' | 'ad',
    datePreset: string,
    fields?: string[]
  ) {
    const defaultFields = [
      'impressions', 'clicks', 'spend', 'reach', 'frequency',
      'actions', 'action_values', 'cpm', 'cpc', 'ctr',
      'cost_per_action_type', 'purchase_roas',
      'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
    ]
    const prefix = entityType === 'account' ? 'act_' : ''
    const { data } = await this.client.get(`/${prefix}${entityId}/insights`, {
      params: {
        fields: (fields || defaultFields).join(','),
        date_preset: datePreset,
        time_increment: 1,
        level: entityType,
        limit: 500,
      },
    })
    return data.data || []
  }

  async getInsightsByDateRange(
    entityId: string,
    entityType: 'account' | 'campaign' | 'adset' | 'ad',
    since: string,
    until: string
  ) {
    const prefix = entityType === 'account' ? 'act_' : ''
    const { data } = await this.client.get(`/${prefix}${entityId}/insights`, {
      params: {
        fields: 'impressions,clicks,spend,reach,frequency,actions,action_values,cpm,cpc,ctr,cost_per_action_type,purchase_roas',
        time_range: JSON.stringify({ since, until }),
        time_increment: 1,
        level: entityType,
        limit: 500,
      },
    })
    return data.data || []
  }

  // ── Creatives ──────────────────────────────────────────────

  async getCreatives(accountId: string) {
    const { data } = await this.client.get(`/act_${accountId}/adcreatives`, {
      params: {
        fields: 'id,name,title,body,call_to_action_type,image_url,video_id,thumbnail_url,object_type',
        limit: 500,
      },
    })
    return data.data || []
  }

  // ── Actions via Meta API ───────────────────────────────────

  async updateBudget(entityId: string, entityType: 'campaign' | 'adset', dailyBudget: number) {
    const field = entityType === 'campaign' ? 'daily_budget' : 'daily_budget'
    await this.client.post(`/${entityId}`, {
      [field]: Math.round(dailyBudget * 100), // Meta uses cents
    })
  }

  async pauseEntity(entityId: string) {
    await this.client.post(`/${entityId}`, { status: 'PAUSED' })
  }

  async activateEntity(entityId: string) {
    await this.client.post(`/${entityId}`, { status: 'ACTIVE' })
  }

  async duplicateCampaign(campaignId: string, newName: string) {
    const { data } = await this.client.post(`/${campaignId}/copies`, {
      rename_options: { renaming_strategy: 'REPLACE_NAME', rename_to: newName },
    })
    return data
  }

  // ── Billing ────────────────────────────────────────────────

  async getBillingInfo(accountId: string) {
    const { data } = await this.client.get(`/act_${accountId}`, {
      params: { fields: 'funding_source_details,account_status,disable_reason' },
    })
    return data
  }

  // ── Pagination helper ──────────────────────────────────────

  async paginate<T>(url: string, params: Record<string, unknown> = {}): Promise<T[]> {
    const results: T[] = []
    let nextUrl: string | null = url
    let pageParams = params

    while (nextUrl) {
      const { data } = await this.client.get(nextUrl, { params: pageParams })
      results.push(...(data.data || []))
      nextUrl = data.paging?.next || null
      pageParams = {}
    }

    return results
  }
}

// Helper: parse Meta insights into our schema
export function parseInsightMetrics(insight: Record<string, unknown>) {
  const actions = (insight.actions as Array<{ action_type: string; value: string }>) || []
  const actionValues = (insight.action_values as Array<{ action_type: string; value: string }>) || []
  const purchaseRoas = (insight.purchase_roas as Array<{ action_type: string; value: string }>) || []

  const getAction = (type: string) =>
    parseFloat(actions.find(a => a.action_type === type)?.value || '0')

  const getActionValue = (type: string) =>
    parseFloat(actionValues.find(a => a.action_type === type)?.value || '0')

  const conversions = getAction('purchase') || getAction('offsite_conversion.fb_pixel_purchase') || getAction('lead') || getAction('offsite_conversion.fb_pixel_lead')
  const conversionValue = getActionValue('purchase') || getActionValue('offsite_conversion.fb_pixel_purchase')
  const roas = purchaseRoas[0] ? parseFloat(purchaseRoas[0].value) : conversionValue > 0 ? conversionValue / parseFloat(String(insight.spend) || '1') : 0

  const impressions = parseInt(String(insight.impressions) || '0')
  const clicks = parseInt(String(insight.clicks) || '0')
  const spend = parseFloat(String(insight.spend) || '0')
  const reach = parseInt(String(insight.reach) || '0')
  const frequency = parseFloat(String(insight.frequency) || '0')

  return {
    impressions,
    clicks,
    spend,
    conversions: Math.round(conversions),
    conversion_value: conversionValue,
    reach,
    frequency,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas,
    quality_ranking: String(insight.quality_ranking || ''),
    engagement_rate_ranking: String(insight.engagement_rate_ranking || ''),
    conversion_rate_ranking: String(insight.conversion_rate_ranking || ''),
  }
}
