import { getMyRecommendations } from '@/lib/adpilot/data'
import { PageHeader, EmptyState, SeverityBadge, RecoStatusBadge } from '@/components/adpilot/ui'
import { RecommendationActions } from '@/components/adpilot/RecommendationActions'

export const dynamic = 'force-dynamic'

export default async function RecommendationsPage() {
  const recos = await getMyRecommendations()

  return (
    <>
      <PageHeader title="המלצות" subtitle="הצעות מ-AI לשיפור הקמפיינים — כל פעולה דורשת את אישורכם." />

      {recos.length === 0 ? (
        <EmptyState title="אין המלצות עדיין" hint="המלצות נוצרות לאחר שהקמפיינים שלכם אוספים נתונים." />
      ) : (
        <div className="grid gap-3">
          {recos.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={r.priority} />
                    <RecoStatusBadge status={r.status} />
                    <span className="text-xs text-muted-foreground">{r.recommendation_type}</span>
                  </div>
                  <h3 className="font-semibold mt-2">{r.title}</h3>
                  {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                </div>
                <RecommendationActions id={r.id} status={r.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
