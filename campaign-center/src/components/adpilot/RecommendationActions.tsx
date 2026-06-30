'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Check, X } from 'lucide-react'
import type { ApRecoStatus } from '@/lib/adpilot/types'

export function RecommendationActions({ id, status }: { id: string; status: ApRecoStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (status !== 'pending') return null

  const act = async (next: ApRecoStatus) => {
    setBusy(true)
    const res = await fetch(`/api/adpilot/recommendations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setBusy(false)
    if (!res.ok) { toast.error('הפעולה נכשלה'); return }
    toast.success(next === 'approved' ? 'אושר' : 'נדחה')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => act('approved')} disabled={busy} className="btn-secondary px-3 py-1.5 text-xs">
        <Check className="w-3.5 h-3.5" /> אישור
      </button>
      <button onClick={() => act('rejected')} disabled={busy} className="btn-ghost px-3 py-1.5 text-xs">
        <X className="w-3.5 h-3.5" /> דחייה
      </button>
    </div>
  )
}
