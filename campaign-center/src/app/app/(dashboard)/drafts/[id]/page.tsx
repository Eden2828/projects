import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Target, Wallet, Users, AlertTriangle, CalendarClock, ExternalLink } from 'lucide-react'
import { getDraft } from '@/lib/adpilot/data'
import { PageHeader, DraftStatusBadge } from '@/components/adpilot/ui'
import { PublishDraftButton } from '@/components/adpilot/PublishDraftButton'
import { generatedCampaignPlanSchema } from '@/lib/adpilot/campaign-schema'

export const dynamic = 'force-dynamic'

export default async function DraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const draft = await getDraft(id)
  if (!draft) notFound()

  const parsed = generatedCampaignPlanSchema.safeParse(draft.plan_json)
  const plan = parsed.success ? parsed.data : null

  return (
    <>
      <Link href="/app/drafts" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> חזרה לקמפיינים
      </Link>

      <PageHeader
        title={draft.campaign_name || 'קמפיין'}
        subtitle={`${draft.platform.toUpperCase()} · ${draft.objective ?? ''}`}
        action={<div className="flex items-center gap-3"><DraftStatusBadge status={draft.status} /><PublishDraftButton draftId={draft.id} /></div>}
      />

      {!plan ? (
        <div className="card p-6 text-sm text-muted-foreground">לא ניתן להציג את התוכנית. נסו לייצר קמפיין מחדש.</div>
      ) : (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <InfoCard icon={Target} label="מטרה מומלצת" value={plan.recommended_objective} />
            <InfoCard icon={Wallet} label="תקציב יומי" value={`${plan.budget_recommendation.currency} ${draft.daily_budget}`} />
            <InfoCard icon={Users} label="סטים / מודעות" value={`${plan.ad_sets.length} / ${plan.ads.length}`} />
          </div>

          <Section title="אסטרטגיית קהל">
            <p className="text-sm leading-relaxed">{plan.audience_strategy}</p>
            <p className="text-xs text-muted-foreground mt-2">{plan.budget_recommendation.rationale}</p>
          </Section>

          <Section title="סטים של מודעות (Ad Sets)">
            <div className="grid gap-3">
              {plan.ad_sets.map((s, i) => (
                <div key={i} className="rounded-lg border border-border p-4">
                  <p className="font-medium">{s.ad_set_name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{s.audience_summary}</p>
                  <div className="flex flex-wrap gap-2 mt-3 text-xs">
                    <Chip>גילאים {s.age_min}-{s.age_max}</Chip>
                    <Chip>{s.genders}</Chip>
                    {s.locations.map((l, j) => <Chip key={'l' + j}>{l}</Chip>)}
                    {s.interests.slice(0, 6).map((it, j) => <Chip key={'i' + j}>{it}</Chip>)}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="מודעות (Ads)">
            <div className="grid gap-3">
              {plan.ads.map((a, i) => (
                <div key={i} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{a.ad_name}</p>
                    <span className="badge badge-low">{a.cta}</span>
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{a.primary_text}</p>
                  <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">כותרת: </span>{a.headline}</div>
                    <div><span className="text-muted-foreground">תיאור: </span>{a.description}</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3"><span className="font-medium">בריף יצירתי: </span>{a.creative_brief}</p>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid lg:grid-cols-2 gap-5">
            <Section title="המלצת דף נחיתה">
              <p className="text-sm flex items-start gap-2"><ExternalLink className="w-4 h-4 mt-0.5 text-muted-foreground" />{plan.landing_page_recommendation}</p>
            </Section>

            <Section title="סיכונים והנחות">
              <ul className="space-y-2 text-sm">
                {plan.risks_and_assumptions.map((r, i) => (
                  <li key={i} className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500" />{r}</li>
                ))}
              </ul>
            </Section>
          </div>

          <Section title="תוכנית אופטימיזציה ל-14 ימים">
            <div className="grid gap-2">
              {plan.optimization_plan_14_days.map((p, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="badge bg-surface text-muted-foreground whitespace-nowrap"><CalendarClock className="w-3 h-3 ml-1" />{p.day_range}</span>
                  <span>{p.action}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </>
  )
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <Icon className="w-7 h-7 text-brand-500/50" />
      <div><p className="metric-label">{label}</p><p className="font-semibold mt-0.5">{value}</p></div>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-5"><h3 className="font-semibold mb-3">{title}</h3>{children}</div>
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="badge bg-surface text-foreground">{children}</span>
}
