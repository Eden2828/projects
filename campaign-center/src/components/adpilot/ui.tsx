import { cn } from '@/lib/utils/cn'
import type { ApAlertSeverity, ApDraftStatus, ApRecoStatus, ApMetaStatus } from '@/lib/adpilot/types'

// Reusable, RTL-friendly presentational components for AdPilot. Server-safe.

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

const severityLabel: Record<ApAlertSeverity, string> = {
  critical: 'קריטי', high: 'גבוה', medium: 'בינוני', low: 'נמוך', info: 'מידע',
}
const severityClass: Record<ApAlertSeverity, string> = {
  critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low', info: 'badge-low',
}
export function SeverityBadge({ severity }: { severity: ApAlertSeverity }) {
  return <span className={cn('badge', severityClass[severity])}>{severityLabel[severity]}</span>
}

const draftStatusLabel: Record<ApDraftStatus, string> = {
  draft: 'טיוטה', approved: 'מאושר', published: 'פורסם', archived: 'בארכיון',
}
export function DraftStatusBadge({ status }: { status: ApDraftStatus }) {
  const cls = status === 'published' ? 'badge-success' : status === 'approved' ? 'badge-low' : status === 'archived' ? 'badge-medium' : 'badge'
  return <span className={cn('badge', cls, status === 'draft' && 'bg-surface text-muted-foreground')}>{draftStatusLabel[status]}</span>
}

const recoStatusLabel: Record<ApRecoStatus, string> = {
  pending: 'ממתין', approved: 'אושר', rejected: 'נדחה', applied: 'הוחל',
}
export function RecoStatusBadge({ status }: { status: ApRecoStatus }) {
  const cls = status === 'approved' || status === 'applied' ? 'badge-success' : status === 'rejected' ? 'badge-critical' : 'badge-medium'
  return <span className={cn('badge', cls)}>{recoStatusLabel[status]}</span>
}

export const metaStatusLabel: Record<ApMetaStatus, string> = {
  disconnected: 'לא מחובר', pending: 'ממתין', connected: 'מחובר', expired: 'פג תוקף', error: 'שגיאה',
}

export const goalLabel: Record<string, string> = {
  leads: 'לידים', messages: 'הודעות', sales: 'מכירות', traffic: 'תנועה',
}
