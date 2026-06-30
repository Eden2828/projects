import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncAdAccount } from '@/lib/meta/sync'
import type { AdAccount } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'team_lead', 'campaign_manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { account_id, sync_all = false } = await req.json()
  const admin = createAdminClient()

  if (sync_all) {
    // Sync all active accounts
    const { data: accounts } = await admin
      .from('ad_accounts')
      .select('*')
      .eq('is_active', true)
      .not('access_token', 'is', null)

    if (!accounts?.length) {
      return NextResponse.json({ message: 'No accounts to sync' })
    }

    // Create sync jobs
    for (const account of accounts) {
      await admin.from('sync_jobs').insert({
        ad_account_id: account.id,
        status: 'pending',
        triggered_by: user.id,
      })

      // Update account status
      await admin.from('ad_accounts').update({ sync_status: 'running' }).eq('id', account.id)
    }

    // Process in background
    Promise.allSettled(
      accounts.map(account => syncAdAccount(account as AdAccount))
    ).then(results => {
      console.log(`Sync complete: ${results.filter(r => r.status === 'fulfilled').length}/${results.length} succeeded`)
    })

    return NextResponse.json({ message: `Started sync for ${accounts.length} accounts`, accounts: accounts.length })
  }

  if (!account_id) {
    return NextResponse.json({ error: 'account_id required' }, { status: 400 })
  }

  const { data: account } = await admin
    .from('ad_accounts')
    .select('*')
    .eq('id', account_id)
    .single()

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Create sync job
  await admin.from('sync_jobs').insert({
    ad_account_id: account_id,
    status: 'pending',
    triggered_by: user.id,
  })

  // Update account status
  await admin.from('ad_accounts').update({ sync_status: 'running' }).eq('id', account_id)

  // Start sync in background
  syncAdAccount(account as AdAccount).catch(err => {
    console.error(`Sync failed for account ${account_id}:`, err)
  })

  // Log activity
  await supabase.from('activity_log').insert({
    user_id: user.id,
    client_id: account.client_id,
    activity_type: 'sync_completed',
    description: `Manual sync started for ${account.account_name}`,
  })

  return NextResponse.json({ message: 'Sync started', account_id })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('account_id')

  let query = supabase
    .from('sync_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (accountId) query = query.eq('ad_account_id', accountId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
