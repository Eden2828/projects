'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { ApBusiness, ApGoal } from '@/lib/adpilot/types'

interface Props {
  business: ApBusiness | null
  answers: Record<string, any>
}

const goals: { value: ApGoal; label: string }[] = [
  { value: 'leads', label: 'לידים (פניות)' },
  { value: 'messages', label: 'הודעות / וואטסאפ' },
  { value: 'sales', label: 'מכירות' },
  { value: 'traffic', label: 'תנועה לאתר' },
]

export function OnboardingForm({ business, answers }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [f, setF] = useState({
    business_name: business?.business_name ?? '',
    industry: business?.industry ?? '',
    what_you_sell: answers.what_you_sell ?? '',
    location: business?.location ?? '',
    main_offer: business?.main_offer ?? '',
    goal: (business?.goal ?? 'leads') as ApGoal,
    monthly_budget: business?.monthly_budget?.toString() ?? '',
    target_audience: answers.target_audience ?? '',
    service_area: answers.service_area ?? '',
    website_url: business?.website_url ?? '',
    instagram_url: business?.instagram_url ?? '',
    facebook_page_url: business?.facebook_page_url ?? '',
    whatsapp_number: business?.whatsapp_number ?? '',
    tone_of_voice: answers.tone_of_voice ?? '',
    promotions: answers.promotions ?? '',
    competitors: answers.competitors ?? '',
    creative_assets: answers.creative_assets ?? '',
  })

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.business_name.trim()) { toast.error('נדרש שם עסק'); return }
    setSaving(true)

    const payload = {
      business_name: f.business_name,
      industry: f.industry,
      location: f.location,
      main_offer: f.main_offer,
      goal: f.goal,
      monthly_budget: f.monthly_budget,
      website_url: f.website_url,
      instagram_url: f.instagram_url,
      facebook_page_url: f.facebook_page_url,
      whatsapp_number: f.whatsapp_number,
      // full questionnaire snapshot (incl. the free-form answers)
      answers: { ...f },
    }

    const res = await fetch('/api/adpilot/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error || 'שמירה נכשלה')
      return
    }
    toast.success('הפרופיל נשמר!')
    router.push('/app/dashboard')
    router.refresh()
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="card p-6 space-y-4">
        <h2 className="font-semibold text-lg">פרטי העסק</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="מה העסק שלך? *"><input className="input" value={f.business_name} onChange={set('business_name')} placeholder="לדוגמה: מספרה, מסעדה, קליניקה" required /></Field>
          <Field label="תחום / ענף"><input className="input" value={f.industry} onChange={set('industry')} placeholder="יופי, מזון, בריאות..." /></Field>
          <Field label="מה אתם מוכרים?"><input className="input" value={f.what_you_sell} onChange={set('what_you_sell')} placeholder="מוצרים / שירותים" /></Field>
          <Field label="היכן אתם פועלים?"><input className="input" value={f.location} onChange={set('location')} placeholder="עיר / אזור" /></Field>
          <Field label="אזור שירות"><input className="input" value={f.service_area} onChange={set('service_area')} placeholder="רדיוס / ערים" /></Field>
          <Field label="ההצעה המרכזית"><input className="input" value={f.main_offer} onChange={set('main_offer')} placeholder="מה ההצעה שתמשוך לקוחות?" /></Field>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="font-semibold text-lg">יעד ותקציב</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="מה המטרה שלך?">
            <select className="input" value={f.goal} onChange={set('goal')}>
              {goals.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </Field>
          <Field label="תקציב פרסום חודשי (₪)"><input className="input" type="number" min="0" value={f.monthly_budget} onChange={set('monthly_budget')} placeholder="2000" dir="ltr" /></Field>
          <Field label="קהל יעד"><input className="input" value={f.target_audience} onChange={set('target_audience')} placeholder="גיל, מגדר, תחומי עניין" /></Field>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="font-semibold text-lg">נוכחות דיגיטלית</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="אתר אינטרנט"><input className="input" value={f.website_url} onChange={set('website_url')} placeholder="https://..." dir="ltr" /></Field>
          <Field label="אינסטגרם"><input className="input" value={f.instagram_url} onChange={set('instagram_url')} placeholder="https://instagram.com/..." dir="ltr" /></Field>
          <Field label="עמוד פייסבוק"><input className="input" value={f.facebook_page_url} onChange={set('facebook_page_url')} placeholder="https://facebook.com/..." dir="ltr" /></Field>
          <Field label="מספר וואטסאפ"><input className="input" value={f.whatsapp_number} onChange={set('whatsapp_number')} placeholder="+9725..." dir="ltr" /></Field>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="font-semibold text-lg">מיתוג ותוכן</h2>
        <div className="grid gap-4">
          <Field label="טון הדיבור של המותג"><input className="input" value={f.tone_of_voice} onChange={set('tone_of_voice')} placeholder="ידידותי, מקצועי, יוקרתי..." /></Field>
          <Field label="מבצעים / הטבות"><textarea className="input min-h-[80px]" value={f.promotions} onChange={set('promotions')} placeholder="מבצעים נוכחיים, הנחות, הטבות" /></Field>
          <Field label="מתחרים"><input className="input" value={f.competitors} onChange={set('competitors')} placeholder="שמות / קישורים של מתחרים" /></Field>
          <Field label="חומרים גרפיים קיימים"><textarea className="input min-h-[80px]" value={f.creative_assets} onChange={set('creative_assets')} placeholder="לוגו, תמונות, סרטונים — קישורים או תיאור" /></Field>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="submit" className="btn-primary px-6 py-2.5" disabled={saving}>
          {saving ? 'שומר...' : 'שמירת הפרופיל'}
        </button>
      </div>
    </form>
  )
}
