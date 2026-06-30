'use client'

import { useState, useEffect } from 'react'
import { Sunrise, AlertTriangle, TrendingUp, CreditCard, X, ChevronRight } from 'lucide-react'
import type { DailyBrief as DailyBriefType } from '@/types'
import { formatCurrency } from '@/lib/utils/format'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface DailyBriefProps {
  brief: DailyBriefType
  onDismiss?: () => void
}

export function DailyBrief({ brief, onDismiss }: DailyBriefProps) {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    onDismiss?.()
  }

  return (
    <div className="relative card p-4 border-brand-600/30 bg-brand-gradient-subtle animate-in">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
          <Sunrise className="w-4 h-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold">Morning Brief</h3>
            <span className="text-xs text-muted-foreground">{new Date(brief.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <BriefStat
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              label="Need Attention"
              value={brief.clients_needing_attention}
              color="text-red-400"
              href="/campaign-center"
            />
            <BriefStat
              icon={<CreditCard className="w-3.5 h-3.5" />}
              label="Billing Issues"
              value={brief.billing_issues}
              color="text-orange-400"
              href="/campaign-center/alerts"
            />
            <BriefStat
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              label="Critical Alerts"
              value={brief.critical_alerts}
              color="text-red-400"
              href="/campaign-center/alerts"
            />
            <BriefStat
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label="Scale Opportunities"
              value={brief.scaling_opportunities}
              color="text-emerald-400"
              href="/campaign-center"
            />
          </div>

          {brief.action_items.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Priority: </span>
              {brief.action_items.slice(0, 2).map((item, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  <span className={cn(
                    item.priority === 'urgent' && 'text-red-400',
                    item.priority === 'high' && 'text-orange-400',
                  )}>
                    {item.client_name} — {item.title}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        <button onClick={dismiss} className="btn-ghost p-1.5 rounded-md flex-shrink-0" title="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function BriefStat({
  icon, label, value, color, href,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  href: string
}) {
  return (
    <Link href={href} className="flex items-center gap-1.5 group hover:opacity-80 transition-opacity">
      <span className={cn('flex-shrink-0', color)}>{icon}</span>
      <div>
        <p className={cn('text-sm font-bold leading-tight', color)}>{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
    </Link>
  )
}
