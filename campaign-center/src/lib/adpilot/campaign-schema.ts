import { z } from 'zod'

// Zod schema used to VALIDATE the AI response before saving it to Supabase.
// The JSON Schema below (sent to Claude via output_config.format) keeps the
// model's output shape aligned with this validator.

export const generatedAdSchema = z.object({
  ad_name: z.string().min(1),
  primary_text: z.string().min(1),
  headline: z.string().min(1),
  description: z.string().min(1),
  cta: z.string().min(1),
  creative_brief: z.string().min(1),
})

export const generatedAdSetSchema = z.object({
  ad_set_name: z.string().min(1),
  audience_summary: z.string().min(1),
  age_min: z.number().int().min(13).max(65),
  age_max: z.number().int().min(13).max(65),
  genders: z.string(),
  locations: z.array(z.string()),
  interests: z.array(z.string()),
  placements: z.array(z.string()),
})

export const generatedCampaignPlanSchema = z.object({
  recommended_objective: z.string().min(1),
  campaign_name: z.string().min(1),
  budget_recommendation: z.object({
    budget_type: z.enum(['daily', 'lifetime']),
    daily_budget: z.number().positive(),
    currency: z.string(),
    rationale: z.string().min(1),
  }),
  audience_strategy: z.string().min(1),
  ad_sets: z.array(generatedAdSetSchema).min(2).max(3),
  ads: z.array(generatedAdSchema).min(3).max(5),
  landing_page_recommendation: z.string().min(1),
  risks_and_assumptions: z.array(z.string()).min(1),
  optimization_plan_14_days: z
    .array(z.object({ day_range: z.string(), action: z.string() }))
    .min(1),
})

export type GeneratedCampaignPlan = z.infer<typeof generatedCampaignPlanSchema>

// JSON Schema mirror — passed to Claude through output_config.format so the
// model is constrained to return exactly this shape. additionalProperties:false
// is required on every object for structured outputs.
export const campaignPlanJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommended_objective: { type: 'string' },
    campaign_name: { type: 'string' },
    budget_recommendation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        budget_type: { type: 'string', enum: ['daily', 'lifetime'] },
        daily_budget: { type: 'number' },
        currency: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['budget_type', 'daily_budget', 'currency', 'rationale'],
    },
    audience_strategy: { type: 'string' },
    ad_sets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ad_set_name: { type: 'string' },
          audience_summary: { type: 'string' },
          age_min: { type: 'integer' },
          age_max: { type: 'integer' },
          genders: { type: 'string' },
          locations: { type: 'array', items: { type: 'string' } },
          interests: { type: 'array', items: { type: 'string' } },
          placements: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'ad_set_name', 'audience_summary', 'age_min', 'age_max',
          'genders', 'locations', 'interests', 'placements',
        ],
      },
    },
    ads: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ad_name: { type: 'string' },
          primary_text: { type: 'string' },
          headline: { type: 'string' },
          description: { type: 'string' },
          cta: { type: 'string' },
          creative_brief: { type: 'string' },
        },
        required: ['ad_name', 'primary_text', 'headline', 'description', 'cta', 'creative_brief'],
      },
    },
    landing_page_recommendation: { type: 'string' },
    risks_and_assumptions: { type: 'array', items: { type: 'string' } },
    optimization_plan_14_days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day_range: { type: 'string' },
          action: { type: 'string' },
        },
        required: ['day_range', 'action'],
      },
    },
  },
  required: [
    'recommended_objective', 'campaign_name', 'budget_recommendation',
    'audience_strategy', 'ad_sets', 'ads', 'landing_page_recommendation',
    'risks_and_assumptions', 'optimization_plan_14_days',
  ],
} as const
