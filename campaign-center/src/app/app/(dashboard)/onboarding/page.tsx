import { createClient } from '@/lib/supabase/server'
import { getMyBusiness } from '@/lib/adpilot/data'
import { PageHeader } from '@/components/adpilot/ui'
import { OnboardingForm } from '@/components/adpilot/OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const business = await getMyBusiness()

  let answers: Record<string, any> = {}
  if (business) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('ap_questionnaire_answers')
      .select('answers_json')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    answers = (data?.answers_json as Record<string, any>) ?? {}
  }

  return (
    <>
      <PageHeader
        title="פרופיל העסק"
        subtitle="ככל שתספרו לנו יותר, כך ה-AI ייצר קמפיין מדויק יותר."
      />
      <OnboardingForm business={business} answers={answers} />
    </>
  )
}
