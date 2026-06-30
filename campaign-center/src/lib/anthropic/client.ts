import Anthropic from '@anthropic-ai/sdk'

// Server-side only. The key is read from AI_API_KEY (per the project spec) and
// MUST never be imported into a client component — keep this file out of any
// 'use client' module.

let cached: Anthropic | null = null

export function isAIConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY)
}

export function getAnthropic(): Anthropic {
  if (!process.env.AI_API_KEY) {
    throw new Error('AI_API_KEY is not configured')
  }
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.AI_API_KEY })
  }
  return cached
}

export const AI_MODEL = process.env.AI_MODEL || 'claude-opus-4-8'
