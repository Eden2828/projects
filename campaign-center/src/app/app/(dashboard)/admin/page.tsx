import { redirect } from 'next/navigation'
import { TrendingUp, Wallet, Building2, Coins } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin, getAdminOverview } from '@/lib/adpilot/data'
import { PageHeader, EmptyState, SeverityBadge, RecoStatusBadge, metaStatusLabel } from '@/components/adpilot/ui'
import { RecommendationActions } from '@/components/adpilot/RecommendationActions'
import type { ApMetaStatus } from '@/lib/adpilot/types'

export const dynamic = 'force-dynamic'

const ils = (n: number) => '₪' + Math.round(n).toLocaleString('he-IL')

export default async function AdminPage() {
  if (!(await isAdmin())) redirect('/app/dashboard')

  const overview = await getAdminOverview()
  const supabase = await createClient()

  // Latest real performance snapshot per business.
  const { data: snaps } = await supabase
    .from('ap_performance_snapshots')
    .select('business_id, spend, impressions, clicks, leads, purchases, revenue, roas, date')
    .order('date', { ascending: false })

  const perf = new Map<string, any>()
  for (const s of snaps ?? []) if (!perf.has(s.business_id)) perf.set(s.business_id, s)

  const totals = (overview ?? []).reduce(
    (a, b) => {
      const p = perf.get(b.business_id)
      return {
        spend: a.spend + (p ? Number(p.spend) : 0),
        revenue: a.revenue + (p ? Number(p.revenue) : 0),
        purchases: a.purchases + (p ? Number(p.purchases) : 0),
      }
    },
    { spend: 0, revenue: 0, purchases: 0 }
  )
  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0

  const { data: pending } = await supabase
    .from('ap_recommendations')
    .select('*, ap_businesses(business_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <>
      <PageHeader title="ניהול סוכנות" subtitle="מבט-על על כל העסקים — נתוני Meta אמיתיים." />

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <Stat label="עסקים" value={String(overview.length)} icon={Building2} />
        <Stat label="הוצאה כוללת (30 ימים)" value={ils(totals.spend)} icon={Wallet} />
        <Stat label="הכנסה כוללת" value={ils(totals.revenue)} icon={Coins} />
        <Stat label="ROAS ממוצע" value={avgRoas.toFixed(2)} icon={TrendingUp} highlight />
      </div>

      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border font-semibold">עסקים וביצועים</div>
        {overview.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">אין עסקים עדיין.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr className="border-b border-border">
                  <Th>עסק</Th><Th>הוצאה</Th><Th>חשיפות</Th><Th>קליקים</Th>
                  <Th>רכישות</Th><Th>ROAS</Th><Th>המלצות</Th><Th>התראות</Th><Th>Meta</Th>
                </tr>
              </thead>
              <tbody>
                {overview.map((b) => {
                  const p = perf.get(b.business_id)
                  return (
                    <tr key={b.business_id} className="border-b border-border/60 hover:bg-surface">
                      <Td className="font-medium">{b.business_name}</Td>
                      <Td>{p ? ils(Number(p.spend)) : '—'}</Td>
                      <Td>{p ? Number(p.impressions).toLocaleString('he-IL') : '—'}</Td>
                      <Td>{p ? Number(p.clicks).toLocaleString('he-IL') : '—'}</Td>
                      <Td>{p ? Number(p.purchases).toLocaleString('he-IL') : '—'}</Td>
                      <Td>{p && Number(p.roas) > 0 ? <span className="badge badge-success">{Number(p.roas).toFixed(2)}</span> : '—'}</Td>
                      <Td>{b.pending_recos}</Td>
                      <Td>{b.open_alerts}</Td>
                      <Td>{metaStatusLabel[(b.meta_status as ApMetaStatus) || 'disconnected']}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 className="font-semibold text-lg mb-3">המלצות ממתינות לאישור</h2>
      {!pending || pending.length === 0 ? (
        <EmptyState title="אין המלצות ממתינות" hint="המלצות נוצרות אוטומטית כשהנתונים מצביעים על הזדמנות או בעיה." />
      ) : (
        <div className="grid gap-3">
          {pending.map((r: any) => (
            <div key={r.id} className="card p-5 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SeverityBadge severity={r.priority} />
                  <RecoStatusBadge status={r.status} />
                  <span className="text-xs text-muted-foreground">{r.ap_businesses?.business_name}</span>
                </div>
                <h3 className="font-semibold mt-2">{r.title}</h3>
                {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
              </div>
              <RecommendationActions id={r.id} status={r.status} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Stat({ label, value, icon: Icon, highlight }: { label: string; value: string; icon: any; highlight?: boolean }) {
  return (
    <div className="card p-5 flex items-center justify-between">
      <div><p className="metric-label">{label}</p><p className={`metric-value mt-1 ${highlight ? 'text-emerald-500' : ''}`}>{value}</p></div>
      <Icon className="w-7 h-7 text-brand-500/40" />
    </div>
  )
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-right font-medium px-4 py-2.5 whitespace-nowrap">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 whitespace-nowrap ${className}`}>{children}</td>
}
