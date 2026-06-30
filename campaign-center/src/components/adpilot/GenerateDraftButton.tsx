'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Sparkles } from 'lucide-react'

export function GenerateDraftButton({ disabled, className }: { disabled?: boolean; className?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    const t = toast.loading('ה-AI בונה קמפיין... זה עשוי לקחת עד דקה')
    try {
      const res = await fetch('/api/ai/generate-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const j = await res.json()
      toast.dismiss(t)
      if (!res.ok) { toast.error(j.error || 'יצירה נכשלה'); setLoading(false); return }
      toast.success('נוצרה טיוטת קמפיין!')
      router.push(`/app/drafts/${j.data.id}`)
      router.refresh()
    } catch (e: any) {
      toast.dismiss(t)
      toast.error('שגיאה ביצירת הקמפיין')
      setLoading(false)
    }
  }

  return (
    <button onClick={generate} disabled={disabled || loading} className={className || 'btn-primary px-5 py-2.5'}>
      <Sparkles className="w-4 h-4" />
      {loading ? 'יוצר...' : 'צור קמפיין עם AI'}
    </button>
  )
}
