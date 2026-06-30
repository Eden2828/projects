'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link2 } from 'lucide-react'
import type { ApMetaStatus } from '@/lib/adpilot/types'
import { metaStatusLabel } from '@/components/adpilot/ui'

export function ConnectMeta({ status, configured }: { status: ApMetaStatus; configured: boolean }) {
  const [loading, setLoading] = useState(false)

  const connect = async () => {
    if (!configured) {
      toast.error('אינטגרציית Meta עדיין לא מוגדרת')
      return
    }
    setLoading(true)
    // The route 302-redirects to Meta; navigate the browser there.
    window.location.href = '/api/meta/auth/start'
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">חשבון המודעות של Meta</h3>
          <p className="text-sm text-muted-foreground mt-1">
            חיבור חשבון פייסבוק/אינסטגרם כדי לפרסם ולנטר קמפיינים.
          </p>
          <p className="text-xs mt-2">
            סטטוס: <span className="font-medium">{metaStatusLabel[status]}</span>
          </p>
        </div>
        <button onClick={connect} disabled={loading || status === 'connected'} className="btn-primary px-4 py-2 whitespace-nowrap">
          <Link2 className="w-4 h-4" />
          {status === 'connected' ? 'מחובר' : 'חיבור Meta'}
        </button>
      </div>

      {!configured && (
        <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-700">
          אינטגרציית Meta עדיין לא מוגדרת. הוסיפו את משתני הסביבה של Meta כדי להפעיל חיבור.
        </div>
      )}
    </div>
  )
}
