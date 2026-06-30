import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Alert, AlertSeverity, AlertStatus } from '@/types'

export function useAlerts(options: {
  clientId?: string
  severity?: AlertSeverity
  status?: AlertStatus | 'all'
} = {}) {
  const supabase = createClient()
  const { clientId, severity, status = 'open' } = options

  return useQuery<Alert[]>({
    queryKey: ['alerts', clientId, severity, status],
    queryFn: async () => {
      let query = supabase
        .from('alerts')
        .select('*, client:clients(id, name, logo_url)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (clientId) query = query.eq('client_id', clientId)
      if (severity) query = query.eq('severity', severity)
      if (status !== 'all') query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error
      return (data || []) as Alert[]
    },
    refetchInterval: 60 * 1000,
  })
}

export function useAlertCount() {
  const supabase = createClient()

  return useQuery<number>({
    queryKey: ['alerts-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
      return count || 0
    },
    refetchInterval: 30 * 1000,
  })
}

export function useAlertActions() {
  const qc = useQueryClient()
  const supabase = createClient()

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  return { acknowledge, resolve }
}
