'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { AlertCard } from '@/components/alerts/AlertCard'
import type { Alert, AlertSeverity, AlertStatus } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Bell, Filter } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'

const SEVERITY_TABS: Array<{ value: AlertSeverity | 'all'; label: string; color: string }> = [
  { value: 'all', label: 'All', color: '' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
  { value: 'high', label: 'High', color: 'text-orange-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'low', label: 'Low', color: 'text-blue-400' },
]

const STATUS_TABS: Array<{ value: AlertStatus | 'all'; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

export default function AlertsPage() {
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all')
  const [status, setStatus] = useState<AlertStatus | 'all'>('open')
  const supabase = createClient()
  const qc = useQueryClient()

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts', severity, status],
    queryFn: async () => {
      let query = supabase
        .from('alerts')
        .select('*, client:clients(id, name, logo_url)')
        .order('created_at', { ascending: false })
        .limit(200)

      if (severity !== 'all') query = query.eq('severity', severity)
      if (status !== 'all') query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error
      return (data || []) as Alert[]
    },
    refetchInterval: 60 * 1000,
  })

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alert acknowledged')
    },
    onError: () => toast.error('Failed to acknowledge alert'),
  })

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alert resolved')
    },
  })

  const generateRecommendation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      })
      if (!res.ok) throw new Error('Failed to generate recommendation')
      return res.json()
    },
    onSuccess: () => {
      toast.success('AI recommendation generated!')
      qc.invalidateQueries({ queryKey: ['recommendations'] })
    },
    onError: () => toast.error('Failed to generate recommendation'),
  })

  const counts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length,
  }

  const openCount = alerts.filter(a => a.status === 'open').length

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Alert Center"
        subtitle={`${openCount} open alerts requiring attention`}
        alertCount={openCount}
      />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {(['critical', 'high', 'medium', 'low'] as AlertSeverity[]).map(sev => (
            <button
              key={sev}
              onClick={() => setSeverity(severity === sev ? 'all' : sev)}
              className={cn(
                'card p-4 text-left transition-all',
                severity === sev ? 'ring-1 ring-brand-600/50' : 'card-hover'
              )}
            >
              <p className={cn(
                'text-2xl font-bold',
                sev === 'critical' ? 'text-red-400' :
                sev === 'high' ? 'text-orange-400' :
                sev === 'medium' ? 'text-yellow-400' : 'text-blue-400'
              )}>
                {counts[sev]}
              </p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{sev}</p>
            </button>
          ))}
        </div>

        {/* Status / Severity filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value as AlertStatus | 'all')}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-md transition-all',
                  status === tab.value
                    ? 'bg-card shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground ml-auto">
            {alerts.length} alerts
          </div>
        </div>

        {/* Alert list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card p-4 h-24">
                <div className="flex gap-3">
                  <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-3 w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">All clear!</h3>
            <p className="text-muted-foreground">No {status !== 'all' ? status : ''} alerts at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                showClient
                onAcknowledge={id => acknowledge.mutate(id)}
                onResolve={id => resolve.mutate(id)}
                onGenerateRecommendation={id => generateRecommendation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
