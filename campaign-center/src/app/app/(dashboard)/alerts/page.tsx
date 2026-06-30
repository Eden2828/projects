import { getMyAlerts } from '@/lib/adpilot/data'
import { PageHeader, EmptyState, SeverityBadge } from '@/components/adpilot/ui'
import { AlertResolveButton } from '@/components/adpilot/AlertActions'

export const dynamic = 'force-dynamic'

export default async function AlertsPage() {
  const alerts = await getMyAlerts()

  return (
    <>
      <PageHeader title="התראות" subtitle="בעיות וחריגות שדורשות תשומת לב." />

      {alerts.length === 0 ? (
        <EmptyState title="אין התראות פתוחות" hint="הכל נראה תקין." />
      ) : (
        <div className="grid gap-3">
          {alerts.map((a) => (
            <div key={a.id} className="card p-5 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={a.severity} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
                <h3 className="font-semibold mt-2">{a.title}</h3>
                {a.message && <p className="text-sm text-muted-foreground mt-1">{a.message}</p>}
              </div>
              <AlertResolveButton id={a.id} status={a.status} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
