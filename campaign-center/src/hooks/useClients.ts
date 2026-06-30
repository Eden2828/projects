import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ClientSummary } from '@/types'

export function useClients() {
  const supabase = createClient()

  return useQuery<ClientSummary[]>({
    queryKey: ['clients', 'summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_summary')
        .select('*')
        .eq('is_active', true)
      if (error) throw error
      return (data || []) as ClientSummary[]
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

export function useClient(id: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}
