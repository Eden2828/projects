import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'think-digital-webhook'

// Meta webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Process webhook events
export async function POST(req: NextRequest) {
  const body = await req.json()
  const admin = createAdminClient()

  try {
    // Process Meta webhook events
    if (body.object === 'ad_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          await processAccountChange(admin, change, entry.id)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Webhook processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

async function processAccountChange(
  admin: ReturnType<typeof createAdminClient>,
  change: { field: string; value: Record<string, unknown> },
  accountId: string
) {
  const { field, value } = change

  // Find the account in our database
  const { data: account } = await admin
    .from('ad_accounts')
    .select('id, client_id')
    .eq('meta_account_id', accountId)
    .single()

  if (!account) return

  switch (field) {
    case 'account_update':
      // Account status changed (e.g., billing issue, disabled)
      if (value.account_status) {
        await admin
          .from('ad_accounts')
          .update({ account_status: value.account_status })
          .eq('id', account.id)

        if (value.account_status === 3) { // Disabled
          await admin.from('alerts').insert({
            client_id: account.client_id,
            ad_account_id: account.id,
            alert_type: 'billing_issue',
            severity: 'critical',
            status: 'open',
            title: 'Ad Account Disabled',
            description: 'Your Meta ad account has been disabled. This may be due to billing issues or policy violations.',
            context_data: { account_id: accountId, account_status: value.account_status },
          })
        }
      }
      break

    case 'ads_review':
      // Ad reviewed (approved/rejected)
      if (value.review_feedback && value.ad_id) {
        const { data: ad } = await admin
          .from('ads')
          .select('id, ad_set_id')
          .eq('meta_ad_id', value.ad_id)
          .single()

        if (ad && value.review_status === 'DISAPPROVED') {
          // Update ad status
          await admin
            .from('ads')
            .update({ status: 'DISAPPROVED' })
            .eq('id', ad.id)

          // Create alert if multiple rejections
          const { count } = await admin
            .from('ads')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'DISAPPROVED')

          if ((count || 0) >= 3) {
            await admin.from('alerts').insert({
              client_id: account.client_id,
              ad_account_id: account.id,
              alert_type: 'rejected_ads',
              severity: 'medium',
              status: 'open',
              title: `${count} Ads Rejected`,
              description: 'Multiple ads have been rejected by Meta. Review your creatives for policy compliance.',
              context_data: { rejected_count: count, latest_ad_id: value.ad_id },
            })
          }
        }
      }
      break
  }
}
