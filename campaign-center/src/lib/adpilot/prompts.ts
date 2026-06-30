import type { ApBusiness } from './types'

// Builds the system + user prompt for campaign generation.
// All free-form answers from the questionnaire are passed through so the model
// has full context. Output shape is enforced separately via output_config.format.

export const CAMPAIGN_SYSTEM_PROMPT = `You are a senior Meta (Facebook & Instagram) Ads strategist building agency-grade
campaigns for business owners who manage their own advertising.
You design realistic, compliant, high-performing campaign plans.

Hard rules:
- Recommend a Meta campaign objective from: OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_AWARENESS.
- The recommended daily budget must NEVER exceed (monthly_budget / 30). Stay within the business's means.
- Produce 2-3 ad sets and 3-5 ads total.
- Write all ad copy in the SAME language the business uses (match the questionnaire answers' language — usually Hebrew for Israeli businesses).
- Be concrete and specific to THIS business. No generic filler.
- Every claim must be honest; do not invent discounts, awards, or guarantees the business did not state.
- Include realistic risks/assumptions and a practical 14-day optimization plan.

Return ONLY the structured campaign plan in the required format.`

export function buildCampaignUserPrompt(
  business: ApBusiness,
  answers: Record<string, unknown>
): string {
  const monthly = business.monthly_budget ?? 0
  const suggestedDaily = monthly > 0 ? Math.floor((monthly / 30) * 100) / 100 : 0

  return [
    'Generate an agency-grade Meta Ads campaign plan for the following business.',
    '',
    '## Business profile',
    `- Business name: ${business.business_name}`,
    `- Industry: ${business.industry ?? 'N/A'}`,
    `- Location / operating area: ${business.location ?? 'N/A'}`,
    `- Main offer: ${business.main_offer ?? 'N/A'}`,
    `- Primary goal: ${business.goal ?? 'N/A'}`,
    `- Monthly ad budget: ${monthly} (so daily budget must be <= ${suggestedDaily})`,
    `- Website: ${business.website_url ?? 'N/A'}`,
    `- Instagram: ${business.instagram_url ?? 'N/A'}`,
    `- Facebook page: ${business.facebook_page_url ?? 'N/A'}`,
    `- WhatsApp: ${business.whatsapp_number ?? 'N/A'}`,
    '',
    '## Questionnaire answers (verbatim)',
    '```json',
    JSON.stringify(answers, null, 2),
    '```',
    '',
    'Design the full campaign now. Keep the daily budget within the stated limit.',
  ].join('\n')
}
