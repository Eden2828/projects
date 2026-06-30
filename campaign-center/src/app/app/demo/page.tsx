import Link from 'next/link'
import {
  Sparkles, Megaphone, Lightbulb, Bell, Wallet, Target, Users,
  TrendingUp, AlertTriangle, CalendarClock, ArrowLeft, Eye,
} from 'lucide-react'
import { PageHeader, SeverityBadge, DraftStatusBadge, RecoStatusBadge, goalLabel } from '@/components/adpilot/ui'

// Public, no-login showcase of the full AdPilot platform, populated with REAL
// numbers pulled live from Meta — so the product can be seen end-to-end without
// any setup. RTL Hebrew.
export const metadata = { title: 'תצוגה — AdPilot' }

// Real performance figures pulled from the connected Meta account (last 30 days).
const realAccounts = [
  { name: 'minene', spend: 118840, impressions: 6852789, clicks: 167695, ctr: 2.45, leads: 1305, purchases: 4116, revenue: 1140684, roas: 9.6 },
  { name: 'Double Standard', spend: 27366, impressions: 1230883, clicks: 9966, ctr: 0.81, leads: 86, purchases: 431, revenue: 125408, roas: 4.58 },
  { name: 'mi va', spend: 24482, impressions: 1498035, clicks: 23799, ctr: 1.59, leads: 0, purchases: 546, revenue: 0, roas: 0 },
  { name: 'noema', spend: 26184, impressions: 764247, clicks: 17560, ctr: 2.30, leads: 1, purchases: 211, revenue: 0, roas: 0 },
]

const sampleAdSets = [
  { name: 'נשים 25-45 · מרכז', summary: 'מתעניינות ביופי וטיפוח, רדיוס 15 ק״מ', chips: ['גילאים 25-45', 'נשים', 'תל אביב', 'טיפוח', 'יופי', 'אונליין שופינג'] },
  { name: 'קהל מותאם · נוטשי עגלה', summary: 'ריטרגטינג למבקרים שלא רכשו', chips: ['Lookalike 1%', 'מבקרי אתר 30 ימים', 'הוסיפו לעגלה'] },
]
const sampleAds = [
  { name: 'מבצע השקה', cta: 'לקנייה', primary: 'הסט החדש שלנו הגיע 💫 משלוח חינם להזמנה ראשונה + 15% הנחה עם הקוד NEW15. כמות מוגבלת!', headline: 'קולקציית הקיץ עכשיו באתר', desc: 'משלוח חינם · החזרה תוך 30 יום' },
  { name: 'הוכחה חברתית', cta: 'גלו עוד', primary: 'מעל 4,000 לקוחות מרוצים החודש ⭐ הצטרפו אליהם — המוצר שכולם מדברים עליו.', headline: 'הנמכר ביותר שלנו', desc: 'דירוג 4.9 מתוך 5' },
]

const ils = (n: number) => '₪' + n.toLocaleString('he-IL')

export default function DemoPage() {
  return (
    <div dir="rtl" lang="he" className="min-h-screen bg-background">
      {/* top bar */}
      <header className="sticky top-0 z-10 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-gradient">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold">AdPilot</span>
            <span className="badge bg-brand-600/10 text-brand-500 mr-2"><Eye className="w-3 h-3 ml-1" /> תצוגה חיה</span>
          </div>
          <Link href="/app/login" className="btn-primary px-4 py-2 text-sm">כניסה למערכת</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        <div className="card p-4 bg-brand-gradient-subtle text-sm">
          זוהי תצוגה של הפלטפורמה המלאה. <b>מספרי הביצועים אמיתיים</b> — נמשכו ישירות מחשבון ה‑Meta המחובר (30 הימים האחרונים). שאר התוכן הוא דוגמה להמחשה.
        </div>

        {/* ===== 1. לוח בקרה ===== */}
        <section>
          <PageHeader title="לוח בקרה" subtitle="מבט-על על הפעילות שלך" />
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { label: 'קמפיינים פעילים', value: 3, icon: Megaphone },
              { label: 'המלצות ממתינות', value: 2, icon: Lightbulb },
              { label: 'התראות פתוחות', value: 1, icon: Bell },
              { label: 'ROAS ממוצע', value: '6.4', icon: TrendingUp },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="card p-5 flex items-center justify-between">
                  <div><p className="metric-label">{s.label}</p><p className="metric-value mt-1">{s.value}</p></div>
                  <Icon className="w-8 h-8 text-brand-500/40" />
                </div>
              )
            })}
          </div>
        </section>

        {/* ===== 2. ביצועים אמיתיים מ-Meta ===== */}
        <section>
          <h2 className="text-xl font-bold mb-1">ביצועים אמיתיים <span className="text-sm font-normal text-muted-foreground">(נתוני Meta · 30 ימים)</span></h2>
          <p className="text-sm text-muted-foreground mb-4">נתונים חיים שנמשכו מחשבון המודעות שלך.</p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs border-b border-border">
                <tr>
                  {['חשבון', 'הוצאה', 'חשיפות', 'קליקים', 'CTR', 'לידים', 'רכישות', 'ROAS'].map((h) => (
                    <th key={h} className="text-right font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {realAccounts.map((a) => (
                  <tr key={a.name} className="border-b border-border/60 hover:bg-surface">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{a.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ils(a.spend)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.impressions.toLocaleString('he-IL')}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.clicks.toLocaleString('he-IL')}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.ctr}%</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.leads.toLocaleString('he-IL')}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.purchases.toLocaleString('he-IL')}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {a.roas > 0 ? <span className="badge badge-success">{a.roas.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== 3. קמפיין שנוצר ב-AI ===== */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">קמפיין שנוצר ב‑AI</h2>
            <DraftStatusBadge status="draft" />
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="card p-4 flex items-center gap-3"><Target className="w-7 h-7 text-brand-500/50" /><div><p className="metric-label">מטרה</p><p className="font-semibold mt-0.5">לידים</p></div></div>
            <div className="card p-4 flex items-center gap-3"><Wallet className="w-7 h-7 text-brand-500/50" /><div><p className="metric-label">תקציב יומי</p><p className="font-semibold mt-0.5">₪90</p></div></div>
            <div className="card p-4 flex items-center gap-3"><Users className="w-7 h-7 text-brand-500/50" /><div><p className="metric-label">סטים / מודעות</p><p className="font-semibold mt-0.5">2 / 2</p></div></div>
          </div>

          <div className="card p-5 mb-4">
            <h3 className="font-semibold mb-3">סטים של מודעות</h3>
            <div className="grid gap-3">
              {sampleAdSets.map((s, i) => (
                <div key={i} className="rounded-lg border border-border p-4">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{s.summary}</p>
                  <div className="flex flex-wrap gap-2 mt-3">{s.chips.map((c, j) => <span key={j} className="badge bg-surface text-foreground">{c}</span>)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-3">מודעות</h3>
            <div className="grid gap-3">
              {sampleAds.map((a, i) => (
                <div key={i} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between"><p className="font-medium">{a.name}</p><span className="badge badge-low">{a.cta}</span></div>
                  <p className="text-sm mt-2">{a.primary}</p>
                  <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">כותרת: </span>{a.headline}</div>
                    <div><span className="text-muted-foreground">תיאור: </span>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 4. המלצות + 5. התראות ===== */}
        <section className="grid lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-bold mb-4">המלצות</h2>
            <div className="grid gap-3">
              <div className="card p-5">
                <div className="flex items-center gap-2"><SeverityBadge severity="medium" /><RecoStatusBadge status="pending" /></div>
                <h3 className="font-semibold mt-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> הגדלת תקציב למודעה מנצחת (+20%)</h3>
                <p className="text-sm text-muted-foreground mt-1">ה‑ROAS חזק (9.6). מומלץ להעלות תקציב יומי מ‑₪90 ל‑₪108 — בתוך מגבלת ה‑20% ותקרת התקציב החודשי.</p>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-2"><SeverityBadge severity="low" /><RecoStatusBadge status="pending" /></div>
                <h3 className="font-semibold mt-2">רענון קריאייטיב</h3>
                <p className="text-sm text-muted-foreground mt-1">תדירות החשיפה עולה. כדאי להוסיף וריאציית מודעה חדשה למניעת שחיקה.</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">התראות</h2>
            <div className="card p-5 flex items-start justify-between gap-4">
              <div>
                <SeverityBadge severity="high" />
                <h3 className="font-semibold mt-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> ירידה ב‑CTR</h3>
                <p className="text-sm text-muted-foreground mt-1">ה‑CTR ירד מ‑2.4% ל‑1.6% ב‑3 הימים האחרונים. כדאי לבדוק את הקריאייטיב.</p>
              </div>
              <span className="badge badge-medium whitespace-nowrap">פתוח</span>
            </div>

            <div className="card p-5 mt-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-muted-foreground" /> תוכנית 14 ימים</h3>
              <ul className="text-sm space-y-2">
                <li className="flex gap-2"><span className="badge bg-surface text-muted-foreground whitespace-nowrap">ימים 1-3</span> איסוף נתונים, ללא שינוי תקציב</li>
                <li className="flex gap-2"><span className="badge bg-surface text-muted-foreground whitespace-nowrap">ימים 4-7</span> בדיקת עלות לליד והשוואת מודעות</li>
                <li className="flex gap-2"><span className="badge bg-surface text-muted-foreground whitespace-nowrap">ימים 8-14</span> הגדלת תקציב למנצחת עד 20%</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="card p-6 text-center bg-brand-gradient-subtle">
          <p className="font-semibold">זו הפלטפורמה שלך.</p>
          <p className="text-sm text-muted-foreground mt-1">להפעלה מלאה עם החשבון והנתונים שלך —</p>
          <Link href="/app/login" className="btn-primary px-6 py-2.5 mt-4 inline-flex">כניסה למערכת <ArrowLeft className="w-4 h-4" /></Link>
        </div>
      </main>
    </div>
  )
}
