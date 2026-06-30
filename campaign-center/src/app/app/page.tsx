import Link from 'next/link'
import { Sparkles, Target, ShieldCheck, LineChart, MessageSquareText } from 'lucide-react'

// Public landing / entry page for AdPilot (RTL Hebrew).
export const metadata = {
  title: 'AdPilot — ניהול הפרסום הממומן שלך, ברמת סוכנות',
  description: 'פלטפורמת AI שמתכננת, מנהלת, מנטרת ומשפרת את הקמפיינים שלך בפייסבוק ואינסטגרם — בשליטה מלאה ובשקיפות.',
}

const features = [
  { icon: MessageSquareText, title: 'שאלון פשוט', desc: 'עונים על כמה שאלות על העסק — וה-AI מכיר אתכם.' },
  { icon: Sparkles, title: 'אסטרטגיה ברמת מומחה', desc: 'בונה אסטרטגיה, קהלים ומודעות מוכנות — כמו צוות פרסום מקצועי.' },
  { icon: ShieldCheck, title: 'שליטה ובטיחות מלאה', desc: 'החשבון שלך, הנתונים שלך. לא חורגים מהתקציב, וכל פעולה רגישה דורשת אישור.' },
  { icon: LineChart, title: 'ניטור ואופטימיזציה 24/7', desc: 'מעקב יומי אחר ביצועים והמלצות לשיפור — אוטומטית.' },
]

export default function AdpilotLanding() {
  return (
    <div dir="rtl" lang="he" className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand-gradient">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">AdPilot</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/app/login" className="btn-ghost">כניסה</Link>
          <Link href="/app/signup" className="btn-primary">התחלה חינם</Link>
        </div>
      </header>

      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 badge bg-brand-600/10 text-brand-500 mb-6">
          <Target className="w-3.5 h-3.5" /> סוכנות הפרסום החכמה שלך
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-balance">
          הפרסום שלך ב<span className="gradient-text">פייסבוק ואינסטגרם</span> — מנוהל ברמת סוכנות, בשליטה שלך
        </h1>
        <p className="text-lg text-muted-foreground mt-5 max-w-2xl mx-auto">
          AI מתכנן, יוצר, מנטר ומשפר עבורך קמפיינים מקצועיים. אתה שומר על שליטה מלאה, שקיפות ובעלות על החשבון — בלי התחייבות ובלי עלויות מיותרות.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link href="/app/signup" className="btn-primary px-6 py-3 text-base">בואו נתחיל</Link>
          <Link href="/app/login" className="btn-secondary px-6 py-3 text-base">כבר יש לי חשבון</Link>
        </div>
      </section>

      <section className="px-6 pb-24 max-w-5xl mx-auto grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => {
          const Icon = f.icon
          return (
            <div key={f.title} className="card card-hover p-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-600/10 text-brand-500 mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          )
        })}
      </section>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        AdPilot — מופעל על ידי Think Digital
      </footer>
    </div>
  )
}
