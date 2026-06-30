'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { DailyBrief } from '@/components/layout/DailyBrief'
import { ClientCard } from '@/components/dashboard/ClientCard'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { SummaryMetrics } from '@/components/dashboard/SummaryMetrics'
import type { ClientSummary, ClientFilters } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const DEFAULT_FILTERS: ClientFilters = {
  search: '',
  health_status: 'all',
  has_alerts: null,
  has_recommendations: null,
  tags: [],
  assigned_to: null,
  sort_by: 'health_score',
  sort_dir: 'asc',
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<ClientFilters>(DEFAULT_FILTERS)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [briefDismissed, setBriefDismissed] = useState(false)
  const supabase = createClient()

  // Fetch clients with health scores
  const { data: clients = [], isLoading, refetch, dataUpdatedAt } = useQuery<ClientSummary[]>({
    queryKey: ['clients', 'summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_summary')
        .select('*')
        .eq('is_active', true)
        .order('health_score', { ascending: true })

      if (error) throw error

      // Also fetch aggregated performance for each client
      const clientIds = (data || []).map(c => c.id)
      if (clientIds.length === 0) return []

      const { data: perfData } = await supabase
        .from('account_performance_summary')
        .select('client_id, total_spend, total_conversions, avg_ctr, avg_cpa, roas')
        .in('client_id', clientIds)

      const perfMap = new Map(perfData?.map(p => [p.client_id, p]) ?? [])

      return (data || []).map(c => {
        const perf = perfMap.get(c.id)
        return {
          ...c,
          total_spend: perf?.total_spend,
          total_conversions: perf?.total_conversions,
          avg_ctr: perf?.avg_ctr,
          avg_cpa: perf?.avg_cpa,
          avg_roas: perf?.roas,
        }
      }) as ClientSummary[]
    },
    refetchInterval: 5 * 60 * 1000,
  })

  // Fetch daily brief
  const { data: brief } = useQuery({
    queryKey: ['daily-brief'],
    queryFn: async () => {
      const res = await fetch('/api/ai/insights?type=daily_brief')
      if (!res.ok) return null
      const json = await res.json()
      return json.data
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  })

  const updateFilters = (partial: Partial<ClientFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }))
  }

  const filteredClients = useMemo(() => {
    let result = [...clients]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      )
    }

    if (filters.health_status !== 'all') {
      result = result.filter(c => {
        const score = c.health_score ?? 0
        switch (filters.health_status) {
          case 'critical': return score < 40
          case 'warning': return score >= 40 && score < 60
          case 'good': return score >= 60 && score < 80
          case 'excellent': return score >= 80
          default: return true
        }
      })
    }

    if (filters.has_alerts) {
      result = result.filter(c => c.open_alerts_count > 0)
    }

    if (filters.has_recommendations) {
      result = result.filter(c => c.pending_recommendations_count > 0)
    }

    // Sort
    result.sort((a, b) => {
      let valA: number | string = 0
      let valB: number | string = 0

      switch (filters.sort_by) {
        case 'health_score':
          valA = a.health_score ?? 0; valB = b.health_score ?? 0; break
        case 'name':
          valA = a.name; valB = b.name; break
        case 'spend':
          valA = a.total_spend ?? 0; valB = b.total_spend ?? 0; break
        case 'alerts':
          valA = a.open_alerts_count; valB = b.open_alerts_count; break
        case 'updated_at':
          valA = a.health_calculated_at ?? ''; valB = b.health_calculated_at ?? ''; break
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return filters.sort_dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return filters.sort_dir === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number)
    })

    return result
  }, [clients, filters])

  const totalAlerts = clients.reduce((s, c) => s + c.open_alerts_count, 0)

  const lastSynced = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Campaign Dashboard"
        subtitle={`${clients.length} active clients`}
        alertCount={totalAlerts}
        lastSyncedAt={lastSynced}
        onSync={() => refetch()}
        syncing={isLoading}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Daily Brief */}
        {brief && !briefDismissed && (
          <DailyBrief brief={brief} onDismiss={() => setBriefDismissed(true)} />
        )}

        {/* Summary Metrics */}
        {clients.length > 0 && (
          <SummaryMetrics clients={clients} />
        )}

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onChange={updateFilters}
          totalCount={clients.length}
          filteredCount={filteredClients.length}
          view={view}
          onViewChange={setView}
        />

        {/* Client Grid */}
        {isLoading ? (
          <div className={cn(
            view === 'grid'
              ? 'grid grid-auto-fill-card gap-4'
              : 'flex flex-col gap-3'
          )}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="card p-5 h-[200px]">
                <div className="flex items-start gap-3 mb-4">
                  <div className="skeleton w-9 h-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-32" />
                    <div className="skeleton h-3 w-20" />
                  </div>
                  <div className="skeleton w-12 h-12 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="skeleton h-10 rounded" />
                  ))}
                </div>
                <div className="skeleton h-4 w-full" />
              </div>
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No clients found</h3>
            <p className="text-muted-foreground max-w-sm">
              {filters.search || filters.health_status !== 'all' || filters.has_alerts
                ? 'Try adjusting your filters'
                : 'Add your first client to get started'}
            </p>
          </div>
        ) : (
          <div className={cn(
            'animate-in',
            view === 'grid'
              ? 'grid grid-auto-fill-card gap-4'
              : 'flex flex-col gap-3'
          )}>
            {filteredClients.map(client => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
