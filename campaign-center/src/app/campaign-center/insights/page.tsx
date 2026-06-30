'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import type { CrossAccountInsight } from '@/types'
import { cn } from '@/lib/utils/cn'
import { Lightbulb, TrendingUp, Sparkles, RefreshCw, Users, Palette, DollarSign } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils/format'

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Creative: Palette,
  Audience: Users,
  Budget: DollarSign,
  Seasonal: TrendingUp,
  Industry: Lightbulb,
}

export default function InsightsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: insights, isLoading, refetch, dataUpdatedAt } = useQuery<{
    insights: CrossAccountInsight[]
    generated_at: string
  }>({
    queryKey: ['cross-account-insights'],
    queryFn: async () => {
      const res = await fetch('/api/ai/insights?type=cross_account')
      if (!res.ok) throw new Error('Failed to fetch insights')
      return res.json()
    },
    staleTime: 60 * 60 * 1000,
  })

  const refresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  const insightList = insights?.insights || []

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Cross-Account Insights"
        subtitle="AI-powered patterns across all agency accounts"
        lastSyncedAt={insights?.generated_at || null}
        onSync={refresh}
        syncing={isRefreshing}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Header */}
        <div className="card p-6 bg-brand-gradient-subtle border-brand-600/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">Agency Intelligence</h2>
              <p className="text-xs text-muted-foreground">
                Gemini AI analyzes patterns across all {'{'}clients.length{'}'} client accounts
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            These insights identify trends, patterns, and opportunities that span multiple accounts.
            Use them to inform strategy decisions and share learnings across your team.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-6 space-y-3">
                <div className="flex gap-3">
                  <div className="skeleton w-8 h-8 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-3 w-1/4" />
                  </div>
                </div>
                <div className="skeleton h-16" />
              </div>
            ))}
          </div>
        ) : insightList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mb-4">
              <Lightbulb className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No insights yet</h3>
            <p className="text-muted-foreground mb-4">
              Insights are generated when enough data is available across accounts.
            </p>
            <button onClick={refresh} className="btn-primary gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Insights Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insightList.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}

        {insights?.generated_at && (
          <p className="text-xs text-muted-foreground text-center">
            Last generated {formatRelativeTime(insights.generated_at)} · Updates every 24 hours
          </p>
        )}
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: CrossAccountInsight }) {
  const Icon = CATEGORY_ICONS[insight.category] || Lightbulb

  return (
    <div className={cn(
      'card p-5 card-hover',
      insight.impact === 'high' && 'border-brand-600/30'
    )}>
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          insight.impact === 'high' ? 'bg-brand-600/15 text-brand-400' :
          insight.impact === 'medium' ? 'bg-yellow-500/15 text-yellow-400' :
          'bg-surface text-muted-foreground'
        )}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">{insight.category}</span>
            <span className={cn(
              'badge text-[10px]',
              insight.impact === 'high' ? 'badge-critical' :
              insight.impact === 'medium' ? 'badge-medium' : 'badge-low'
            )}>
              {insight.impact} impact
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-snug">{insight.title}</h3>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>

      {insight.affected_clients && insight.affected_clients.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Affects {insight.affected_clients.length} client{insight.affected_clients.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
