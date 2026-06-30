'use client'

import { useState } from 'react'
import {
  AlertTriangle, CreditCard, XCircle, TrendingDown, TrendingUp,
  Activity, Clock, CheckCircle, ChevronDown, Sparkles, Eye
} from 'lucide-react'
import type { Alert, AlertSeverity, AlertType } from '@/types'
import { formatRelativeTime, formatPercent, formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; class: string; ring: string }> = {
  critical: { label: 'Critical', class: 'badge-critical', ring: 'ring-red-500/30 bg-red-500/5' },
  high: { label: 'High', class: 'badge-high', ring: 'ring-orange-500/30 bg-orange-500/5' },
  medium: { label: 'Medium', class: 'badge-medium', ring: 'ring-yellow-500/30 bg-yellow-500/5' },
  low: { label: 'Low', class: 'badge-low', ring: 'ring-blue-500/30 bg-blue-500/5' },
}

const TYPE_ICON: Record<AlertType, React.ComponentType<{ className?: string }>> = {
  billing_issue: CreditCard,
  rejected_ads: XCircle,
  learning_limited: Activity,
  cpa_increase: TrendingUp,
  roas_decrease: TrendingDown,
  ctr_decrease: TrendingDown,
  frequency_increase: TrendingUp,
  spend_anomaly: Activity,
  conversion_drop: TrendingDown,
  campaign_inactive: Clock,
  budget_pacing: Activity,
  ad_fatigue: Eye,
}

const TYPE_LABEL: Record<AlertType, string> = {
  billing_issue: 'Billing Issue',
  rejected_ads: 'Rejected Ads',
  learning_limited: 'Learning Limited',
  cpa_increase: 'CPA Increase',
  roas_decrease: 'ROAS Decrease',
  ctr_decrease: 'CTR Decrease',
  frequency_increase: 'Frequency High',
  spend_anomaly: 'Spend Anomaly',
  conversion_drop: 'Conversion Drop',
  campaign_inactive: 'Campaign Inactive',
  budget_pacing: 'Budget Pacing',
  ad_fatigue: 'Ad Fatigue',
}

interface AlertCardProps {
  alert: Alert
  onAcknowledge?: (id: string) => void
  onResolve?: (id: string) => void
  onGenerateRecommendation?: (id: string) => void
  showClient?: boolean
}

export function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  onGenerateRecommendation,
  showClient = true,
}: AlertCardProps) {
  const [expanded, setExpanded] = useState(false)
  const config = SEVERITY_CONFIG[alert.severity]
  const Icon = TYPE_ICON[alert.alert_type] || AlertTriangle

  return (
    <div className={cn(
      'card ring-1 transition-all duration-200',
      config.ring,
      alert.status === 'resolved' && 'opacity-60'
    )}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5',
            alert.severity === 'critical' ? 'bg-red-500/15 text-red-400' :
            alert.severity === 'high' ? 'bg-orange-500/15 text-orange-400' :
            alert.severity === 'medium' ? 'bg-yellow-500/15 text-yellow-400' :
            'bg-blue-500/15 text-blue-400'
          )}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('badge', config.class)}>
                  {config.label}
                </span>
                <span className="badge bg-surface text-muted-foreground border-border">
                  {TYPE_LABEL[alert.alert_type]}
                </span>
                {showClient && alert.client && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {alert.client.name}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatRelativeTime(alert.created_at)}
              </span>
            </div>

            <h4 className="text-sm font-semibold mb-1">{alert.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{alert.description}</p>

            {/* Metric change */}
            {alert.metric_change_pct !== null && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs text-muted-foreground">{alert.metric_name}:</span>
                <span className={cn(
                  'text-xs font-semibold',
                  alert.metric_change_pct > 0 && alert.alert_type !== 'roas_increase' ? 'text-red-400' : 'text-emerald-400'
                )}>
                  {alert.metric_change_pct > 0 ? '+' : ''}{alert.metric_change_pct.toFixed(1)}%
                </span>
                {alert.metric_value !== null && (
                  <span className="text-xs text-muted-foreground">
                    ({formatCurrency(alert.metric_value)})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Expand */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-ghost p-1.5 flex-shrink-0"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>

        {/* Expanded context */}
        {expanded && alert.context_data && Object.keys(alert.context_data).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(alert.context_data).slice(0, 6).map(([key, val]) => (
                <div key={key} className="bg-surface rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm font-medium">
                    {typeof val === 'number' ? val.toFixed(2) : String(val)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {alert.status === 'open' && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            {onGenerateRecommendation && (
              <button
                onClick={() => onGenerateRecommendation(alert.id)}
                className="btn-primary text-xs py-1.5 px-3 gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Get AI Fix
              </button>
            )}
            {onAcknowledge && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                Acknowledge
              </button>
            )}
            {onResolve && (
              <button
                onClick={() => onResolve(alert.id)}
                className="btn-ghost text-xs py-1.5 px-3 gap-1.5 text-emerald-400 hover:text-emerald-400 hover:bg-emerald-500/10"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Resolve
              </button>
            )}
          </div>
        )}

        {alert.status === 'acknowledged' && alert.acknowledged_at && (
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
            Acknowledged {formatRelativeTime(alert.acknowledged_at)}
          </p>
        )}
      </div>
    </div>
  )
}
