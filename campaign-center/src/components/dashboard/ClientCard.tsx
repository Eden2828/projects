'use client'

import { memo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Sparkles, Activity } from 'lucide-react'
import type { ClientSummary } from '@/types'
import { formatCurrency, formatPercent, formatRoas } from '@/lib/utils/format'
import { getHealthColor, getHealthBg, getHealthLabel } from '@/lib/utils/health-score'
import { cn } from '@/lib/utils/cn'

interface ClientCardProps {
  client: ClientSummary
}

export const ClientCard = memo(function ClientCard({ client }: ClientCardProps) {
  const score = client.health_score ?? 0
  const healthColor = getHealthColor(score)
  const healthBg = getHealthBg(score)

  const circumference = 2 * Math.PI * 20
  const dashOffset = circumference - (score / 100) * circumference

  const TrendIcon = client.health_trend === 'up'
    ? TrendingUp
    : client.health_trend === 'down'
    ? TrendingDown
    : Minus

  const trendColor = client.health_trend === 'up'
    ? 'text-emerald-500'
    : client.health_trend === 'down'
    ? 'text-red-500'
    : 'text-muted-foreground'

  const hasCritical = client.critical_alerts_count > 0

  return (
    <Link href={`/campaign-center/clients/${client.id}`}>
      <div className={cn(
        'card card-hover p-5 h-full cursor-pointer group relative overflow-hidden',
        hasCritical && 'border-red-500/30'
      )}>
        {/* Subtle gradient top accent */}
        <div className={cn(
          'absolute top-0 left-0 right-0 h-0.5 rounded-t-xl',
          score >= 80 ? 'bg-emerald-500' :
          score >= 60 ? 'bg-yellow-500' :
          score >= 40 ? 'bg-orange-500' : 'bg-red-500'
        )} />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={client.name}
                className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-border"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-brand-gradient flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                {client.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate group-hover:text-brand-500 transition-colors">
                {client.name}
              </h3>
              {client.industry && (
                <p className="text-xs text-muted-foreground truncate">{client.industry}</p>
              )}
            </div>
          </div>

          {/* Health Score Ring */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor"
                  strokeWidth="3" className="text-muted opacity-20" />
                <circle
                  cx="24" cy="24" r="20" fill="none"
                  stroke="currentColor" strokeWidth="3"
                  strokeLinecap="round"
                  className={cn(healthColor, 'health-ring transition-all duration-700')}
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-xs font-bold', healthColor)}>{score}</span>
              </div>
            </div>
            <div className={cn('flex items-center gap-0.5 mt-0.5', trendColor)}>
              <TrendIcon className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <KpiCell
            label="Spend"
            value={formatCurrency(client.total_spend, client.currency)}
          />
          <KpiCell
            label="ROAS"
            value={formatRoas(client.avg_roas)}
            highlight={client.avg_roas !== undefined && client.target_roas !== null && client.avg_roas >= (client.target_roas || 0)}
          />
          <KpiCell
            label="CPA"
            value={formatCurrency(client.avg_cpa, client.currency)}
            lowIsBetter
            highlight={client.avg_cpa !== undefined && client.target_cpa !== null && client.avg_cpa <= (client.target_cpa || Infinity)}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 pt-3 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span>{client.active_accounts_count} account{client.active_accounts_count !== 1 ? 's' : ''}</span>
          </div>

          {client.open_alerts_count > 0 && (
            <div className={cn(
              'flex items-center gap-1 ml-auto',
              hasCritical ? 'text-red-400' : 'text-yellow-400'
            )}>
              <AlertTriangle className="w-3 h-3" />
              <span>{client.open_alerts_count} alert{client.open_alerts_count !== 1 ? 's' : ''}</span>
            </div>
          )}

          {client.pending_recommendations_count > 0 && (
            <div className="flex items-center gap-1 text-brand-400 ml-auto">
              <Sparkles className="w-3 h-3" />
              <span>{client.pending_recommendations_count}</span>
            </div>
          )}

          {/* Health label */}
          <span className={cn(
            'ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full',
            score >= 80 ? 'bg-emerald-500/10 text-emerald-500' :
            score >= 60 ? 'bg-yellow-500/10 text-yellow-500' :
            score >= 40 ? 'bg-orange-500/10 text-orange-500' : 'bg-red-500/10 text-red-500'
          )}>
            {getHealthLabel(score)}
          </span>
        </div>
      </div>
    </Link>
  )
})

function KpiCell({ label, value, highlight, lowIsBetter }: {
  label: string
  value: string
  highlight?: boolean
  lowIsBetter?: boolean
}) {
  return (
    <div className="text-center">
      <p className={cn(
        'text-sm font-semibold',
        highlight && 'text-emerald-500'
      )}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}
