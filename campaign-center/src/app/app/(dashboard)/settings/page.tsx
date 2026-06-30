import { createClient } from '@/lib/supabase/server'
import { getApUser, getMyBusiness } from '@/lib/adpilot/data'
import { isMetaConfigured } from '@/lib/meta/services/config'
import { PageHeader } from '@/components/adpilot/ui'
import { ConnectMeta } from '@/components/adpilot/ConnectMeta'
import type { ApMetaStatus } from '@/lib/adpilot/types'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string }>
}) {
  const { meta } = await searchParams
  const [user, business] = await Promise.all([getApUser(), getMyBusiness()])

  let metaStatus: ApMetaStatus = 'disconnected'
  if (business) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('ap_meta_connections')
      .select('status')
      .eq('business_id', business.id)
      .maybeSingle()
    if (data?.status) metaStatus = data.status as ApMetaStatus
  }

  const configured = isMetaConfigured()

  return (
    <>
      <PageHeader title="הגדרות" subtitle="חשבון והגדרות חיבור." />

      {meta === 'connected' && (
        <div className="card p-4 mb-4 bg-emerald-500/10 border-emerald-500/20 text-emerald-700 text-sm">
          חשבון Meta חובר בהצלחה.
        </div>
      )}
      {meta === 'error' && (
        <div className="card p-4 mb-4 bg-destructive/10 border-destructive/20 text-destructive text-sm">
          חיבור Meta נכשל. נסו שוב.
        </div>
      )}

      <div className="grid gap-4">
        <div className="card p-6">
          <h3 className="font-semibold mb-3">פרטי חשבון</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-muted-foreground">שם</dt><dd className="font-medium">{user?.name || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">אימייל</dt><dd className="font-medium" dir="ltr">{user?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">תפקיד</dt><dd className="font-medium">{user?.role === 'admin' ? 'מנהל' : 'משתמש'}</dd></div>
          </dl>
        </div>

        {business ? (
          <ConnectMeta status={metaStatus} configured={configured} />
        ) : (
          <div className="card p-6 text-sm text-muted-foreground">השלימו את פרופיל העסק כדי לחבר את Meta.</div>
        )}
      </div>
    </>
  )
}
