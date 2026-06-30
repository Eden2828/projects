'use client'

import { TrendingUp, DollarSign, Users, Zap, AlertTriangle } from 'lucide-react'
import type { ClientSummary } from '@/types'
import { formatCurrency, formatNumber, formatRoas } from '@/lib/utils/format'

interface SummaryMetricsProps {
  clients: ClientSummary[]
}

export function SummaryMetrics({ clients }: SummaryMetricsProps) {
  const activeClients = clients.filter(c => c.is_active)
  const totalSpend = activeClients.reduce((s, c) => s + (c.total_spend || 0), 0)
  const totalConversions = activeClients.reduce((s, c) => s + (c.total_conversions || 0), 0)
  const avgHealthScore = activeClients.length
    ? Math.round(activeClients.reduce((s, c) => s + (c.health_score || 0), 0) / activeClients.length)
    : 0
  const totalOpenAlerts = activeClients.reduce((s, c) => s + c.open_alerts_count, 0)
  const criticalAlerts = activeClients.reduce((s, c) => s + c.critical_alerts_count, 0)

  const weightedRoas = activeClients.length
    ? activeClients.reduce((s, c) => s + ((c.avg_roas || 0) * (c.total_spend || 1)), 0) /
      (totalSpend || 1)
    : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <MetricCard
        icon={<Users className="w-4 h-4" />}
        label="Active Clients"
        value={String(activeClients.length)}
        sub={`${clients.length} total`}
        color="text-brand-400"
        bg="bg-brand-400/10"
      />
      <MetricCard
        icon={<DollarSign className="w-4 h-4" />}
        label="30d Spend"
        value={formatCurrency(totalSpend)}
        sub="agency total"
        color="text-purple-400"
        bg="bg-purple-400/10"
      />
      <MetricCard
        icon={<TrendingUp className="w-4 h-4" />}
        label="Avg ROAS"
        value={formatRoas(weightedRoas)}
        sub="weighted"
        color="text-emerald-400"
        bg="bg-emerald-400/10"
      />
      <MetricCard
        icon={<Zap className="w-4 h-4" />}
        label="Avg Health"
        value={`${avgHealthScore}`}
        sub="out of 100"
        color={avgHealthScore >= 70 ? 'text-emerald-400' : avgHealthScore >= 50 ? 'text-yellow-400' : 'text-red-400'}
        bg={avgHealthScore >= 70 ? 'bg-emerald-400/10' : avgHealthScore >= 50 ? 'bg-yellow-400/10' : 'bg-red-400/10'}
      />
      <MetricCard
        icon={<AlertTriangle className="w-4 h-4" />}
        label="Open Alerts"
        value={String(totalOpenAlerts)}
        sub={criticalAlerts > 0 ? `${criticalAlerts} critical` : 'no critical'}
        color={criticalAlerts > 0 ? 'text-red-400' : totalOpenAlerts > 0 ? 'text-yellow-400' : 'text-muted-foreground'}
        bg={criticalAlerts > 0 ? 'bg-red-400/10' : 'bg-surface'}
        urgent={criticalAlerts > 0}
      />
    </div>
  )
}

function MetricCard({
  icon, label, value, sub, color, bg, urgent
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
  bg: string
  urgent?: boolean
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {urgent && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>
    </div>
  )
}
