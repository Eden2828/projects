import Link from 'next/link'
import { Megaphone, Lightbulb, Bell, ClipboardList, ArrowLeft } from 'lucide-react'
import { getApUser, getMyBusiness, getMyDrafts, getMyRecommendations, getMyAlerts } from '@/lib/adpilot/data'
import { PageHeader, EmptyState, goalLabel } from '@/components/adpilot/ui'
import { GenerateDraftButton } from '@/components/adpilot/GenerateDraftButton'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [user, business, drafts, recos, alerts] = await Promise.all([
    getApUser(), getMyBusiness(), getMyDrafts(), getMyRecommendations(), getMyAlerts(),
  ])

  const pendingRecos = recos.filter((r) => r.status === 'pending').length
  const openAlerts = alerts.filter((a) => a.status === 'open').length

  if (!business) {
    return (
      <>
        <PageHeader title={`שלום${user?.name ? ', ' + user.name : ''}`} subtitle="בואו נתחיל בהקמת פרופיל העסק שלכם." />
        <EmptyState
          title="עדיין לא מילאתם את פרופיל העסק"
          hint="מילוי השאלון לוקח 2 דקות ומאפשר ל-AI לבנות עבורכם קמפיין."
          action={<Link href="/app/onboarding" className="btn-primary px-5 py-2.5">למילוי השאלון</Link>}
        />
      </>
    )
  }

  const stats = [
    { label: 'קמפיינים', value: drafts.length, href: '/app/drafts', icon: Megaphone },
    { label: 'המלצות ממתינות', value: pendingRecos, href: '/app/recommendations', icon: Lightbulb },
    { label: 'התראות פתוחות', value: openAlerts, href: '/app/alerts', icon: Bell },
  ]

  return (
    <>
      <PageHeader
        title={`שלום${user?.name ? ', ' + user.name : ''}`}
        subtitle={business.business_name}
        action={<GenerateDraftButton />}
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href} className="card card-hover p-5 flex items-center justify-between">
              <div>
                <p className="metric-label">{s.label}</p>
                <p className="metric-value mt-1">{s.value}</p>
              </div>
              <Icon className="w-8 h-8 text-brand-500/40" />
            </Link>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">פרופיל העסק</h3>
          </div>
          <dl className="text-sm space-y-2">
            <Row label="ענף" value={business.industry} />
            <Row label="מיקום" value={business.location} />
            <Row label="מטרה" value={business.goal ? goalLabel[business.goal] : null} />
            <Row label="תקציב חודשי" value={business.monthly_budget ? `₪${business.monthly_budget}` : null} />
            <Row label="הצעה מרכזית" value={business.main_offer} />
          </dl>
          <Link href="/app/onboarding" className="btn-ghost px-0 mt-3 text-sm text-brand-500">
            עריכת הפרופיל <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-3">קמפיינים אחרונים</h3>
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">עדיין אין קמפיינים. צרו אחד עם AI.</p>
          ) : (
            <ul className="space-y-2">
              {drafts.slice(0, 4).map((d) => (
                <li key={d.id}>
                  <Link href={`/app/drafts/${d.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface text-sm">
                    <span className="font-medium truncate">{d.campaign_name || 'קמפיין ללא שם'}</span>
                    <span className="text-muted-foreground text-xs">₪{d.daily_budget}/יום</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-left">{value || '—'}</dd>
    </div>
  )
}
