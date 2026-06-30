'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { AlertCard } from '@/components/alerts/AlertCard'
import { createClient } from '@/lib/supabase/client'
import type { Client, Alert, AIRecommendation, AdAccount, PerformanceMetrics } from '@/types'
import { getHealthColor, getHealthBg, getHealthLabel } from '@/lib/utils/health-score'
import { formatCurrency, formatPercent, formatRoas, formatNumber, formatDate, formatRelativeTime } from '@/lib/utils/format'
import { DATE_RANGE_PRESETS, getDateRange } from '@/lib/utils/date-ranges'
import type { DateRangePreset } from '@/types'
import { cn } from '@/lib/utils/cn'
import {
  TrendingUp, TrendingDown, Minus, Sparkles, CheckCircle2, XCircle,
  AlertTriangle, Activity, RefreshCw, ExternalLink, Zap, ChevronRight
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import toast from 'react-hot-toast'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last_30_days')
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'alerts' | 'recommendations'>('overview')
  const [syncing, setSyncing] = useState(false)
  const supabase = createClient()
  const qc = useQueryClient()
  const dateRange = getDateRange(datePreset)

  const { data: client } = useQuery<Client>({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Client
    },
  })

  const { data: healthScore } = useQuery({
    queryKey: ['health-score', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('health_scores')
        .select('*')
        .eq('client_id', id)
        .order('date', { ascending: false })
        .limit(1)
        .single()
      return data
    },
  })

  const { data: accounts = [] } = useQuery<AdAccount[]>({
    queryKey: ['accounts', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('client_id', id)
        .eq('is_active', true)
      return (data || []) as AdAccount[]
    },
  })

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['alerts', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('client_id', id)
        .eq('status', 'open')
        .order('severity', { ascending: true })
        .order('created_at', { ascending: false })
      return (data || []) as Alert[]
    },
  })

  const { data: recommendations = [] } = useQuery<AIRecommendation[]>({
    queryKey: ['recommendations', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('client_id', id)
        .eq('status', 'pending')
        .order('confidence_score', { ascending: false })
      return (data || []) as AIRecommendation[]
    },
  })

  const { data: metricsHistory = [] } = useQuery<Array<{
    date: string; spend: number; conversions: number; roas: number; cpa: number; ctr: number
  }>>({
    queryKey: ['metrics-history', id, dateRange.from, dateRange.to],
    queryFn: async () => {
      const accountIds = accounts.map(a => a.id)
      if (accountIds.length === 0) return []

      const { data } = await supabase
        .from('performance_metrics')
        .select('date, spend, conversions, roas, cpa, ctr')
        .eq('entity_type', 'account')
        .in('entity_id', accountIds)
        .gte('date', dateRange.from)
        .lte('date', dateRange.to)
        .order('date', { ascending: true })

      return (data || []).map(d => ({
        date: d.date,
        spend: d.spend || 0,
        conversions: d.conversions || 0,
        roas: d.roas || 0,
        cpa: d.cpa || 0,
        ctr: (d.ctr || 0) * 100,
      }))
    },
    enabled: accounts.length > 0,
  })

  const approveRecommendation = useMutation({
    mutationFn: async (recId: string) => {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendation_id: recId, action: 'approve' }),
      })
      if (!res.ok) throw new Error('Failed to approve')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recommendations', id] })
      toast.success('Recommendation approved and queued for execution')
    },
    onError: () => toast.error('Failed to approve recommendation'),
  })

  const syncAccount = async () => {
    if (!accounts[0]) return
    setSyncing(true)
    try {
      await fetch('/api/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accounts[0].id }),
      })
      toast.success('Sync started')
      qc.invalidateQueries({ queryKey: ['accounts', id] })
    } finally {
      setSyncing(false)
    }
  }

  const score = healthScore?.score ?? 0
  const healthColor = getHealthColor(score)

  // Aggregate totals
  const totalSpend = metricsHistory.reduce((s, m) => s + m.spend, 0)
  const totalConversions = metricsHistory.reduce((s, m) => s + m.conversions, 0)
  const avgRoas = metricsHistory.filter(m => m.roas > 0).reduce((s, m) => s + m.roas, 0) /
    (metricsHistory.filter(m => m.roas > 0).length || 1)
  const avgCpa = metricsHistory.filter(m => m.cpa > 0).reduce((s, m) => s + m.cpa, 0) /
    (metricsHistory.filter(m => m.cpa > 0).length || 1)

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading client...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={client.name}
        subtitle={client.industry || 'Digital Marketing'}
        lastSyncedAt={accounts[0]?.last_synced_at}
        onSync={syncAccount}
        syncing={syncing}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Client header card */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {client.logo_url ? (
                <img src={client.logo_url} alt={client.name}
                  className="w-16 h-16 rounded-xl object-cover border border-border" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-brand-gradient flex items-center justify-center text-white text-2xl font-bold">
                  {client.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">{client.name}</h1>
                <p className="text-muted-foreground">{client.industry}</p>
                {client.website && (
                  <a href={client.website} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand-400 flex items-center gap-1 mt-1 hover:underline">
                    {client.website} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Health Score */}
            <div className="flex flex-col items-center">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor"
                    strokeWidth="5" className="text-muted opacity-20" />
                  <circle
                    cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="5"
                    strokeLinecap="round" className={cn(healthColor, 'health-ring transition-all')}
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * (1 - score / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn('text-xl font-bold', healthColor)}>{score}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              <span className={cn(
                'mt-1 text-xs font-medium px-2 py-0.5 rounded-full',
                score >= 80 ? 'bg-emerald-500/10 text-emerald-500' :
                score >= 60 ? 'bg-yellow-500/10 text-yellow-500' :
                score >= 40 ? 'bg-orange-500/10 text-orange-500' : 'bg-red-500/10 text-red-500'
              )}>
                {getHealthLabel(score)}
              </span>
            </div>
          </div>

          {/* Health explanation */}
          {healthScore?.explanation && (
            <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border leading-relaxed">
              {healthScore.explanation}
            </p>
          )}
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface">
            {DATE_RANGE_PRESETS.slice(0, 6).map(p => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-md transition-all',
                  datePreset === p.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Spend', value: formatCurrency(totalSpend, client.currency), icon: '₪' },
            { label: 'Conversions', value: formatNumber(totalConversions), icon: '🎯' },
            { label: 'Avg ROAS', value: formatRoas(avgRoas), icon: '📈', highlight: client.target_roas ? avgRoas >= client.target_roas : false },
            { label: 'Avg CPA', value: formatCurrency(avgCpa, client.currency), icon: '💰', highlight: client.target_cpa ? avgCpa <= client.target_cpa : false },
          ].map(({ label, value, icon, highlight }) => (
            <div key={label} className={cn('card p-4', highlight && 'border-emerald-500/30')}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Performance Chart */}
        {metricsHistory.length > 0 && (
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Spend Over Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={metricsHistory}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₪${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: number) => [`₪${val.toFixed(0)}`, 'Spend']}
                />
                <Area type="monotone" dataKey="spend" stroke="#2563eb" fill="url(#spendGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabs */}
        <div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface mb-4">
            {(['overview', 'alerts', 'recommendations'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-md transition-all capitalize flex items-center gap-1.5',
                  activeTab === tab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab}
                {tab === 'alerts' && alerts.length > 0 && (
                  <span className="badge badge-critical text-[10px] px-1 py-0">{alerts.length}</span>
                )}
                {tab === 'recommendations' && recommendations.length > 0 && (
                  <span className="badge badge-low text-[10px] px-1 py-0">{recommendations.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Alerts tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No open alerts ✓</div>
              ) : (
                alerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} showClient={false}
                    onGenerateRecommendation={async (id) => {
                      await fetch('/api/ai/recommendations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ alert_id: id }),
                      })
                      toast.success('AI recommendation generated!')
                      qc.invalidateQueries({ queryKey: ['recommendations', client.id] })
                    }}
                  />
                ))
              )}
            </div>
          )}

          {/* Recommendations tab */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              {recommendations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No pending recommendations</div>
              ) : (
                recommendations.map(rec => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    onApprove={() => approveRecommendation.mutate(rec.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Health score components */}
              {healthScore?.components && (
                <div className="card p-5">
                  <h3 className="font-semibold mb-4">Health Score Breakdown</h3>
                  <div className="space-y-3">
                    {Object.entries(healthScore.components).map(([key, comp]) => {
                      const c = comp as { score: number; weight: number }
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-28 flex-shrink-0 capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-700',
                                c.score >= 80 ? 'bg-emerald-500' :
                                c.score >= 60 ? 'bg-yellow-500' :
                                c.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                              )}
                              style={{ width: `${c.score}%` }}
                            />
                          </div>
                          <span className={cn('text-xs font-semibold w-8 text-right flex-shrink-0', getHealthColor(c.score))}>
                            {c.score}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Connected accounts */}
              <div className="card p-5">
                <h3 className="font-semibold mb-4">Ad Accounts</h3>
                <div className="space-y-2">
                  {accounts.map(acc => (
                    <div key={acc.id} className="flex items-center gap-3 p-3 bg-surface rounded-lg">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        acc.sync_status === 'success' ? 'bg-emerald-400' :
                        acc.sync_status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{acc.account_name}</p>
                        <p className="text-xs text-muted-foreground">
                          act_{acc.meta_account_id} ·{' '}
                          {acc.last_synced_at ? `Synced ${formatRelativeTime(acc.last_synced_at)}` : 'Not synced'}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{acc.currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({ rec, onApprove }: { rec: AIRecommendation; onApprove: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const riskColor = rec.risk_level === 'high' ? 'text-red-400' :
    rec.risk_level === 'medium' ? 'text-yellow-400' : 'text-emerald-400'

  return (
    <div className="card p-5 border-brand-600/20">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge bg-brand-600/10 text-brand-400 border-brand-600/20 text-xs capitalize">
              {rec.action_type.replace(/_/g, ' ')}
            </span>
            <span className={cn('text-xs', riskColor)}>{rec.risk_level} risk</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {Math.round(rec.confidence_score * 100)}% confidence
            </span>
          </div>

          <h4 className="text-sm font-semibold mb-1">{rec.title}</h4>
          <p className="text-sm text-muted-foreground">{rec.diagnosis}</p>

          {expanded && (
            <div className="mt-3 space-y-2 text-sm">
              <div className="p-3 bg-surface rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Explanation</p>
                <p>{rec.explanation}</p>
              </div>
              <div className="p-3 bg-surface rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Action</p>
                <p>{rec.recommended_action}</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <p className="text-xs text-emerald-400 mb-1">Expected Impact</p>
                <p className="text-emerald-300">{rec.expected_impact}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <button onClick={() => setExpanded(!expanded)} className="btn-ghost text-xs py-1.5 gap-1">
              {expanded ? 'Less' : 'Details'}
              <ChevronRight className={cn('w-3 h-3 transition-transform', expanded && 'rotate-90')} />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button className="btn-secondary text-xs py-1.5 gap-1">
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
              <button onClick={onApprove} className="btn-primary text-xs py-1.5 gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
