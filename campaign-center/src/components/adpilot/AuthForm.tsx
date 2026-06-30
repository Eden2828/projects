'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'

// Translate common Supabase auth errors to Hebrew so the UI stays fully Hebrew.
function heAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'אימייל או סיסמה שגויים'
  if (m.includes('already registered') || m.includes('already been registered')) return 'כתובת האימייל כבר רשומה. אפשר להתחבר.'
  if (m.includes('password should be at least')) return 'הסיסמה חייבת להכיל לפחות 6 תווים'
  if (m.includes('email not confirmed')) return 'האימייל עדיין לא אומת. בדקו את תיבת הדואר.'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'כתובת אימייל לא תקינה'
  if (m.includes('rate limit') || m.includes('too many')) return 'יותר מדי ניסיונות. נסו שוב בעוד רגע.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'ההרשמה אינה פעילה כרגע.'
  return 'אירעה שגיאה. נסו שוב.'
}

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/app/dashboard'
  const supabase = createClient()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const isSignup = mode === 'signup'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null); setInfo(null)

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name } },
      })
      if (error) { setError(heAuthError(error.message)); setLoading(false); return }
      // If email confirmation is required there is no active session yet.
      if (!data.session) {
        setInfo('נרשמת! בדקו את האימייל לאישור החשבון, ואז התחברו.')
        setLoading(false)
        return
      }
      router.push('/app/onboarding')
      router.refresh()
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(heAuthError(error.message)); setLoading(false); return }
    router.push(redirect)
    router.refresh()
  }

  return (
    <div dir="rtl" lang="he" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md card p-8 space-y-6 animate-in">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-gradient mb-1">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{isSignup ? 'יצירת חשבון' : 'כניסה'} ל-AdPilot</h1>
          <p className="text-sm text-muted-foreground">ניהול הפרסום הממומן שלך, ברמת סוכנות</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>}
          {info && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-600">{info}</div>}

          {isSignup && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="name">שם מלא</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" required />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="email">אימייל</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.co.il" required autoComplete="email" dir="ltr" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="password">סיסמה</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete={isSignup ? 'new-password' : 'current-password'} dir="ltr" />
          </div>

          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? 'רגע...' : isSignup ? 'יצירת חשבון' : 'כניסה'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>כבר רשומים? <Link href="/app/login" className="text-brand-500 font-medium">לכניסה</Link></>
          ) : (
            <>אין לכם חשבון? <Link href="/app/signup" className="text-brand-500 font-medium">להרשמה</Link></>
          )}
        </p>
      </div>
    </div>
  )
}
