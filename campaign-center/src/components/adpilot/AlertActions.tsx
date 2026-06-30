'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { ApAlertStatus } from '@/lib/adpilot/types'

// Resolves an alert via the browser client (RLS lets the owner update their own).
export function AlertResolveButton({ id, status }: { id: string; status: ApAlertStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  if (status === 'resolved') return <span className="badge badge-success">טופל</span>

  const resolve = async () => {
    setBusy(true)
    const { error } = await supabase.from('ap_alerts').update({ status: 'resolved' }).eq('id', id)
    setBusy(false)
    if (error) { toast.error('הפעולה נכשלה'); return }
    toast.success('ההתראה סומנה כטופלה')
    router.refresh()
  }

  return (
    <button onClick={resolve} disabled={busy} className="btn-secondary px-3 py-1.5 text-xs">
      סימון כטופל
    </button>
  )
}
