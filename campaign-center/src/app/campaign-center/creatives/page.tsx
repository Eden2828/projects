'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import type { Creative } from '@/types'
import { formatCurrency, formatPercent, formatRoas, formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import {
  Play, Image as ImageIcon, Sparkles, TrendingUp, Eye, MousePointerClick,
  ShoppingCart, Filter, Grid3x3, List
} from 'lucide-react'
import { DATE_RANGE_PRESETS, getDateRange } from '@/lib/utils/date-ranges'
import type { DateRangePreset } from '@/types'

type SortField = 'spend' | 'ctr' | 'cpa' | 'roas' | 'conversions'

export default function CreativesPage() {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last_30_days')
  const [sortBy, setSortBy] = useState<SortField>('spend')
  const [format, setFormat] = useState<string>('all')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null)
  const supabase = createClient()

  const dateRange = getDateRange(datePreset)

  const { data: creatives = [], isLoading } = useQuery<Creative[]>({
    queryKey: ['creatives', datePreset, selectedClient, format],
    queryFn: async () => {
      let query = supabase
        .from('creatives')
        .select(`
          *,
          ad_account:ad_accounts(client_id, clients(id, name))
        `)
        .limit(200)

      if (selectedClient !== 'all') {
        query = query.eq('ad_account.client_id', selectedClient)
      }

      if (format !== 'all') {
        query = query.eq('format', format)
      }

      const { data, error } = await query
      if (error) throw error

      // Enrich with performance metrics
      const creativeIds = (data || []).map(c => c.id)
      if (creativeIds.length === 0) return []

      const { data: perfData } = await supabase
        .from('performance_metrics')
        .select('entity_id, spend, clicks, impressions, conversions, ctr, cpa, roas')
        .eq('entity_type', 'ad')
        .in('entity_id', creativeIds)
        .gte('date', dateRange.from)
        .lte('date', dateRange.to)

      const perfMap = new Map<string, { spend: number; clicks: number; impressions: number; conversions: number; ctr: number; cpa: number; roas: number }>()
      for (const p of (perfData || [])) {
        const existing = perfMap.get(p.entity_id) || { spend: 0, clicks: 0, impressions: 0, conversions: 0, ctr: 0, cpa: 0, roas: 0 }
        perfMap.set(p.entity_id, {
          spend: existing.spend + (p.spend || 0),
          clicks: existing.clicks + (p.clicks || 0),
          impressions: existing.impressions + (p.impressions || 0),
          conversions: existing.conversions + (p.conversions || 0),
          ctr: 0, cpa: 0, roas: 0,
        })
      }

      // Calculate derived metrics
      perfMap.forEach((perf, id) => {
        perf.ctr = perf.impressions > 0 ? perf.clicks / perf.impressions : 0
        perf.cpa = perf.conversions > 0 ? perf.spend / perf.conversions : 0
        perf.roas = perf.spend > 0 ? (perf.conversions * 50) / perf.spend : 0
      })

      return (data || []).map(c => ({
        ...c,
        performance: perfMap.get(c.id),
      })) as Creative[]
    },
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name').eq('is_active', true)
      return data || []
    },
  })

  const sorted = [...creatives].sort((a, b) => {
    const pa = a.performance
    const pb = b.performance
    if (!pa && !pb) return 0
    if (!pa) return 1
    if (!pb) return -1
    switch (sortBy) {
      case 'spend': return (pb.spend || 0) - (pa.spend || 0)
      case 'ctr': return (pb.ctr || 0) - (pa.ctr || 0)
      case 'cpa': return (pa.cpa || 999999) - (pb.cpa || 999999)
      case 'roas': return (pb.roas || 0) - (pa.roas || 0)
      case 'conversions': return (pb.conversions || 0) - (pa.conversions || 0)
      default: return 0
    }
  })

  const totalSpend = sorted.reduce((s, c) => s + (c.performance?.spend || 0), 0)

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Creative Intelligence" subtitle={`${creatives.length} creatives analyzed`} />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date preset */}
          <select
            value={datePreset}
            onChange={e => setDatePreset(e.target.value as DateRangePreset)}
            className="input h-9 w-auto text-xs cursor-pointer"
          >
            {DATE_RANGE_PRESETS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Client */}
          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            className="input h-9 w-auto text-xs cursor-pointer"
          >
            <option value="all">All Clients</option>
            {clients.map((c: { id: string; name: string }) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Format */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface">
            {['all', 'IMAGE', 'VIDEO', 'CAROUSEL'].map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-md transition-all',
                  format === f ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortField)}
            className="input h-9 w-auto text-xs cursor-pointer"
          >
            <option value="spend">Sort: Spend</option>
            <option value="roas">Sort: ROAS</option>
            <option value="cpa">Sort: CPA</option>
            <option value="ctr">Sort: CTR</option>
            <option value="conversions">Sort: Conversions</option>
          </select>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 p-1 rounded-lg bg-surface ml-auto">
            <button onClick={() => setView('grid')} className={cn('p-1.5 rounded-md', view === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
              <Grid3x3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView('list')} className={cn('p-1.5 rounded-md', view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton aspect-square" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-3 w-2/3" />
                  <div className="skeleton h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sorted.map((creative, idx) => (
              <CreativeCard
                key={creative.id}
                creative={creative}
                rank={idx + 1}
                onClick={() => setSelectedCreative(creative)}
              />
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-4 py-3">Creative</th>
                  <th className="text-right px-4 py-3">Spend</th>
                  <th className="text-right px-4 py-3">CTR</th>
                  <th className="text-right px-4 py-3">CPA</th>
                  <th className="text-right px-4 py-3">ROAS</th>
                  <th className="text-right px-4 py-3">Conversions</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((creative) => (
                  <tr key={creative.id} className="hover:bg-surface/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CreativeThumbnail creative={creative} small />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {creative.name || creative.title || 'Untitled'}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {creative.format?.toLowerCase() || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 text-sm font-medium">
                      {formatCurrency(creative.performance?.spend)}
                    </td>
                    <td className="text-right px-4 py-3 text-sm">
                      {formatPercent(creative.performance?.ctr)}
                    </td>
                    <td className="text-right px-4 py-3 text-sm">
                      {formatCurrency(creative.performance?.cpa)}
                    </td>
                    <td className="text-right px-4 py-3 text-sm text-emerald-400 font-medium">
                      {formatRoas(creative.performance?.roas)}
                    </td>
                    <td className="text-right px-4 py-3 text-sm">
                      {formatNumber(creative.performance?.conversions)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedCreative(creative)}
                        className="btn-ghost text-xs py-1 px-2 opacity-0 group-hover:opacity-100"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creative Detail Modal */}
      {selectedCreative && (
        <CreativeModal creative={selectedCreative} onClose={() => setSelectedCreative(null)} />
      )}
    </div>
  )
}

function CreativeThumbnail({ creative, small }: { creative: Creative; small?: boolean }) {
  const size = small ? 'w-10 h-10' : 'w-full aspect-square'
  const iconSize = small ? 'w-4 h-4' : 'w-8 h-8'

  if (creative.thumbnail_url || creative.image_url) {
    return (
      <img
        src={creative.thumbnail_url || creative.image_url || ''}
        alt={creative.name || 'Creative'}
        className={cn(size, 'object-cover rounded-lg flex-shrink-0')}
      />
    )
  }

  return (
    <div className={cn(size, 'bg-surface rounded-lg flex items-center justify-center flex-shrink-0')}>
      {creative.format === 'VIDEO' ? (
        <Play className={cn(iconSize, 'text-muted-foreground')} />
      ) : (
        <ImageIcon className={cn(iconSize, 'text-muted-foreground')} />
      )}
    </div>
  )
}

function CreativeCard({ creative, rank, onClick }: { creative: Creative; rank: number; onClick: () => void }) {
  const perf = creative.performance
  const isTopPerformer = rank <= 3

  return (
    <div
      onClick={onClick}
      className={cn(
        'card overflow-hidden cursor-pointer group card-hover relative',
        isTopPerformer && 'ring-1 ring-yellow-500/30'
      )}
    >
      {isTopPerformer && (
        <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-white shadow">
          {rank}
        </div>
      )}

      {/* Format badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className="badge bg-black/50 text-white border-0 text-[10px] backdrop-blur-sm">
          {creative.format === 'VIDEO' ? (
            <Play className="w-2.5 h-2.5 mr-0.5" />
          ) : null}
          {creative.format?.toLowerCase() || 'img'}
        </span>
      </div>

      <CreativeThumbnail creative={creative} />

      <div className="p-3 space-y-2">
        <p className="text-xs font-medium truncate">
          {creative.name || creative.title || 'Untitled Creative'}
        </p>

        {perf && (
          <div className="grid grid-cols-2 gap-1">
            <div>
              <p className="text-xs font-semibold">{formatCurrency(perf.spend)}</p>
              <p className="text-[10px] text-muted-foreground">Spend</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-400">{formatRoas(perf.roas)}</p>
              <p className="text-[10px] text-muted-foreground">ROAS</p>
            </div>
          </div>
        )}

        {creative.ai_analysis && (
          <div className={cn(
            'text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1',
            creative.ai_analysis.hook_quality === 'strong'
              ? 'bg-emerald-500/10 text-emerald-400'
              : creative.ai_analysis.hook_quality === 'moderate'
              ? 'bg-yellow-500/10 text-yellow-400'
              : 'bg-red-500/10 text-red-400'
          )}>
            <Sparkles className="w-2.5 h-2.5" />
            {creative.ai_analysis.hook_quality} hook
          </div>
        )}
      </div>
    </div>
  )
}

function CreativeModal({ creative, onClose }: { creative: Creative; onClose: () => void }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(creative.ai_analysis)

  const analyzeCreative = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'creative_analysis', creative_id: creative.id }),
      })
      const data = await res.json()
      if (data.analysis) setAnalysis(data.analysis)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in">
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-semibold">{creative.name || 'Creative Detail'}</h2>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {creative.format?.toLowerCase()} · {creative.object_type}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Preview */}
          <div>
            <CreativeThumbnail creative={creative} />
            {creative.body && (
              <div className="mt-3 p-3 bg-surface rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">Primary Text</p>
                <p className="text-sm">{creative.body}</p>
              </div>
            )}
            {creative.title && (
              <div className="mt-2 p-3 bg-surface rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">Headline</p>
                <p className="text-sm font-medium">{creative.title}</p>
              </div>
            )}
          </div>

          {/* Performance & AI */}
          <div className="space-y-4">
            {/* Performance */}
            {creative.performance && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Performance</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Spend', value: formatCurrency(creative.performance.spend) },
                    { label: 'CTR', value: formatPercent(creative.performance.ctr) },
                    { label: 'CPA', value: formatCurrency(creative.performance.cpa) },
                    { label: 'ROAS', value: formatRoas(creative.performance.roas) },
                    { label: 'Conversions', value: formatNumber(creative.performance.conversions) },
                    { label: 'Impressions', value: formatNumber(creative.performance.impressions) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Analysis */}
            {analysis ? (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  AI Analysis
                </h3>
                <div className="space-y-3 text-sm">
                  <p><span className="text-muted-foreground">Why performing: </span>{analysis.why_performing}</p>
                  {analysis.improvement_suggestions?.length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1">Suggestions:</p>
                      <ul className="space-y-1">
                        {analysis.improvement_suggestions.slice(0, 3).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-brand-400 mt-0.5">→</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={analyzeCreative}
                disabled={analyzing}
                className="btn-primary w-full gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {analyzing ? 'Analyzing...' : 'Analyze with AI'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
