import Link from 'next/link'
import { getMyBusiness, getMyDrafts } from '@/lib/adpilot/data'
import { PageHeader, EmptyState, DraftStatusBadge } from '@/components/adpilot/ui'
import { GenerateDraftButton } from '@/components/adpilot/GenerateDraftButton'

export const dynamic = 'force-dynamic'

export default async function DraftsPage() {
  const business = await getMyBusiness()
  const drafts = business ? await getMyDrafts() : []

  return (
    <>
      <PageHeader
        title="קמפיינים"
        subtitle="טיוטות קמפיין שנוצרו על ידי ה-AI."
        action={business ? <GenerateDraftButton /> : undefined}
      />

      {!business ? (
        <EmptyState title="צריך פרופיל עסק" hint="מלאו את השאלון כדי ליצור קמפיין."
          action={<Link href="/app/onboarding" className="btn-primary px-5 py-2.5">למילוי השאלון</Link>} />
      ) : drafts.length === 0 ? (
        <EmptyState title="אין עדיין קמפיינים" hint="לחצו על 'צור קמפיין עם AI' כדי להתחיל." action={<GenerateDraftButton />} />
      ) : (
        <div className="grid gap-3">
          {drafts.map((d) => (
            <Link key={d.id} href={`/app/drafts/${d.id}`} className="card card-hover p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{d.campaign_name || 'קמפיין ללא שם'}</h3>
                  <DraftStatusBadge status={d.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {d.objective} · {Array.isArray(d.ad_sets_json) ? d.ad_sets_json.length : 0} סטים · {Array.isArray(d.ads_json) ? d.ads_json.length : 0} מודעות
                </p>
              </div>
              <div className="text-left">
                <p className="metric-value text-lg">₪{d.daily_budget}</p>
                <p className="metric-label">ליום</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
