'use client'

import { useQuery } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import {
  Sparkles, CheckCircle2, XCircle, Play, AlertTriangle,
  LogIn, MessageSquare, FileText, User, RefreshCw
} from 'lucide-react'

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  recommendation_created: Sparkles,
  recommendation_approved: CheckCircle2,
  recommendation_rejected: XCircle,
  action_executed: Play,
  action_failed: XCircle,
  user_login: LogIn,
  user_action: User,
  alert_created: AlertTriangle,
  alert_resolved: CheckCircle2,
  sync_completed: RefreshCw,
  task_created: CheckCircle2,
  task_updated: CheckCircle2,
  report_generated: FileText,
  ai_conversation: MessageSquare,
}

const ACTIVITY_COLORS: Record<string, string> = {
  recommendation_created: 'text-brand-400 bg-brand-400/10',
  recommendation_approved: 'text-emerald-400 bg-emerald-400/10',
  recommendation_rejected: 'text-red-400 bg-red-400/10',
  action_executed: 'text-emerald-400 bg-emerald-400/10',
  action_failed: 'text-red-400 bg-red-400/10',
  user_login: 'text-blue-400 bg-blue-400/10',
  alert_created: 'text-orange-400 bg-orange-400/10',
  alert_resolved: 'text-emerald-400 bg-emerald-400/10',
  sync_completed: 'text-cyan-400 bg-cyan-400/10',
  task_created: 'text-purple-400 bg-purple-400/10',
  report_generated: 'text-indigo-400 bg-indigo-400/10',
  ai_conversation: 'text-brand-400 bg-brand-400/10',
  user_action: 'text-muted-foreground bg-surface',
}

interface ActivityLog {
  id: string
  user_id: string | null
  client_id: string | null
  activity_type: string
  entity_type: string | null
  entity_name: string | null
  description: string
  metadata: Record<string, unknown>
  created_at: string
  user?: { full_name: string; avatar_url: string | null }
  client?: { name: string }
}

export default function ActivityPage() {
  const supabase = createClient()

  const { data: activities = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ['activity-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select(`
          *,
          user:profiles(full_name, avatar_url),
          client:clients(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data || []) as ActivityLog[]
    },
    refetchInterval: 30 * 1000,
  })

  // Group by date
  const grouped = activities.reduce<Record<string, ActivityLog[]>>((acc, activity) => {
    const date = new Date(activity.created_at).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(activity)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Activity Log" subtitle="Complete audit trail of all platform actions" />

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8 max-w-3xl">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  {date}
                </h3>
                <div className="space-y-1">
                  {items.map(activity => {
                    const Icon = ACTIVITY_ICONS[activity.activity_type] || User
                    const colorClass = ACTIVITY_COLORS[activity.activity_type] || 'text-muted-foreground bg-surface'

                    return (
                      <div key={activity.id} className="flex items-start gap-3 py-2 group hover:bg-surface/50 rounded-lg px-2 -mx-2 transition-colors">
                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', colorClass)}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{activity.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {activity.user && (
                              <span className="text-xs text-muted-foreground">{activity.user.full_name}</span>
                            )}
                            {activity.client && (
                              <>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">{activity.client.name}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <span className="text-xs text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatRelativeTime(activity.created_at)}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 group-hover:hidden">
                          {new Date(activity.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {activities.length === 0 && (
              <div className="text-center py-20">
                <p className="text-muted-foreground">No activity recorded yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
