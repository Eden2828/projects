import { createAdminClient } from '@/lib/supabase/admin'
import { MetaAPIClient, parseInsightMetrics } from './client'
import type { AdAccount } from '@/types'

export async function syncAdAccount(account: AdAccount): Promise<void> {
  const supabase = createAdminClient()
  const meta = new MetaAPIClient(account.access_token!)

  await supabase
    .from('sync_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('ad_account_id', account.id)
    .eq('status', 'pending')

  try {
    let recordsSynced = 0

    // 1. Sync campaigns
    const campaigns = await meta.getCampaigns(account.meta_account_id)
    for (const c of campaigns) {
      await supabase.from('campaigns').upsert(
        {
          ad_account_id: account.id,
          meta_campaign_id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          buying_type: c.buying_type,
          daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
          lifetime_budget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
          start_time: c.start_time || null,
          stop_time: c.stop_time || null,
        },
        { onConflict: 'ad_account_id,meta_campaign_id', ignoreDuplicates: false }
      )
      recordsSynced++
    }

    // 2. Sync ad sets
    const adSets = await meta.getAdSets(account.meta_account_id)
    const { data: dbCampaigns } = await supabase
      .from('campaigns')
      .select('id, meta_campaign_id')
      .eq('ad_account_id', account.id)

    const campaignIdMap = new Map(dbCampaigns?.map(c => [c.meta_campaign_id, c.id]) ?? [])

    for (const as of adSets) {
      const dbCampaignId = campaignIdMap.get(as.campaign_id)
      if (!dbCampaignId) continue
      await supabase.from('ad_sets').upsert(
        {
          campaign_id: dbCampaignId,
          meta_adset_id: as.id,
          name: as.name,
          status: as.status,
          daily_budget: as.daily_budget ? parseFloat(as.daily_budget) / 100 : null,
          lifetime_budget: as.lifetime_budget ? parseFloat(as.lifetime_budget) / 100 : null,
          optimization_goal: as.optimization_goal || null,
          billing_event: as.billing_event || null,
          bid_amount: as.bid_amount ? parseFloat(as.bid_amount) / 100 : null,
          targeting: as.targeting || null,
          start_time: as.start_time || null,
          end_time: as.end_time || null,
        },
        { onConflict: 'campaign_id,meta_adset_id', ignoreDuplicates: false }
      )
      recordsSynced++
    }

    // 3. Sync performance metrics (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const until = new Date().toISOString().split('T')[0]

    const insights = await meta.getInsightsByDateRange(
      account.meta_account_id, 'account', since, until
    )

    for (const insight of insights) {
      const metrics = parseInsightMetrics(insight as Record<string, unknown>)
      await supabase.from('performance_metrics').upsert(
        {
          entity_type: 'account',
          entity_id: account.id,
          date: insight.date_start as string,
          ...metrics,
          raw_data: insight,
        },
        { onConflict: 'entity_type,entity_id,date', ignoreDuplicates: false }
      )
      recordsSynced++
    }

    // 4. Campaign-level insights
    for (const c of campaigns.slice(0, 20)) { // limit to avoid rate limits
      const dbCampaignId = campaignIdMap.get(c.id)
      if (!dbCampaignId) continue
      const campaignInsights = await meta.getInsightsByDateRange(c.id, 'campaign', since, until)
      for (const insight of campaignInsights) {
        const metrics = parseInsightMetrics(insight as Record<string, unknown>)
        await supabase.from('performance_metrics').upsert(
          {
            entity_type: 'campaign',
            entity_id: dbCampaignId,
            date: insight.date_start as string,
            ...metrics,
            raw_data: insight,
          },
          { onConflict: 'entity_type,entity_id,date', ignoreDuplicates: false }
        )
        recordsSynced++
      }
    }

    // 5. Update account status
    await supabase
      .from('ad_accounts')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        sync_error: null,
      })
      .eq('id', account.id)

    await supabase
      .from('sync_jobs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        records_synced: recordsSynced,
      })
      .eq('ad_account_id', account.id)
      .eq('status', 'running')

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'

    await supabase
      .from('ad_accounts')
      .update({ sync_status: 'failed', sync_error: errorMessage })
      .eq('id', account.id)

    await supabase
      .from('sync_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq('ad_account_id', account.id)
      .eq('status', 'running')

    throw error
  }
}

export async function syncAllAccounts(): Promise<void> {
  const supabase = createAdminClient()
  const { data: accounts } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('is_active', true)
    .not('access_token', 'is', null)

  if (!accounts?.length) return

  // Process accounts in parallel with concurrency limit
  const batchSize = 5
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize)
    await Promise.allSettled(batch.map(account => syncAdAccount(account as AdAccount)))
  }
}
