'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Rocket } from 'lucide-react'

// MVP: triggers a dry-run publish. Live publishing is disabled server-side.
export function PublishDraftButton({ draftId }: { draftId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const publish = async () => {
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/meta/publish-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_id: draftId, ad_account_id: 'act_DEMO' }),
    })
    const j = await res.json()
    setLoading(false)
    if (!res.ok) {
      // 503 → Meta not configured; 409 → not connected.
      toast.error(j.error || 'הפרסום נכשל')
      setResult(j.error || null)
      return
    }
    toast.success('הרצת בדיקה (dry-run) הושלמה')
    setResult(j.data?.message || 'בדיקה הושלמה')
  }

  return (
    <div>
      <button onClick={publish} disabled={loading} className="btn-secondary px-4 py-2">
        <Rocket className="w-4 h-4" />
        {loading ? 'בודק...' : 'פרסום (בדיקה)'}
      </button>
      {result && <p className="text-xs text-muted-foreground mt-2 max-w-md">{result}</p>}
    </div>
  )
}
