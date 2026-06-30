import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGeminiModel } from '@/lib/gemini/client'
import { buildChatSystemPrompt } from '@/lib/gemini/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, conversation_id, history = [], client_id } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  // Fetch client context if provided
  let clientContext = null
  if (client_id) {
    const { data } = await supabase
      .from('client_summary')
      .select('*')
      .eq('id', client_id)
      .single()
    clientContext = data
  }

  const systemPrompt = buildChatSystemPrompt(clientContext)

  // Fetch relevant performance data for context
  let performanceContext = null
  try {
    const { data: recentPerf } = await supabase
      .from('performance_metrics')
      .select('spend, conversions, roas, cpa, ctr, date')
      .eq('entity_type', 'account')
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(50)

    if (recentPerf && recentPerf.length > 0) {
      const totalSpend = recentPerf.reduce((s, m) => s + (m.spend || 0), 0)
      const totalConv = recentPerf.reduce((s, m) => s + (m.conversions || 0), 0)
      const avgRoas = recentPerf.filter(m => m.roas).reduce((s, m) => s + m.roas, 0) / recentPerf.filter(m => m.roas).length

      performanceContext = { total_spend_7d: totalSpend, total_conversions_7d: totalConv, avg_roas: avgRoas }
    }
  } catch {}

  // Build streaming response
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const model = getGeminiModel({ temperature: 0.8 })

  const chatHistory = [
    { role: 'user' as const, parts: [{ text: systemPrompt }] },
    { role: 'model' as const, parts: [{ text: 'Understood. I\'m ready to help with campaign analysis and optimization.' }] },
    ...history.map((h: { role: string; parts: string }) => ({
      role: h.role as 'user' | 'model',
      parts: [{ text: h.parts }],
    })),
  ]

  const chat = model.startChat({ history: chatHistory })

  const contextualMessage = performanceContext
    ? `${message}\n\n[Context: Last 7 days — Spend: ₪${performanceContext.total_spend_7d.toFixed(0)}, Conversions: ${performanceContext.total_conversions_7d}, Avg ROAS: ${performanceContext.avg_roas?.toFixed(2)}x]`
    : message

  ;(async () => {
    try {
      const result = await chat.sendMessageStream(contextualMessage)
      let fullText = ''

      for await (const chunk of result.stream) {
        const text = chunk.text()
        fullText += text
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`))
      }

      // Save conversation
      let convId = conversation_id
      if (!convId) {
        const title = message.slice(0, 60) + (message.length > 60 ? '...' : '')
        const { data: conv } = await supabase
          .from('ai_conversations')
          .insert({
            user_id: user.id,
            client_id: client_id || null,
            title,
            messages: [],
            token_count: 0,
          })
          .select('id')
          .single()
        convId = conv?.id
      }

      if (convId) {
        const { data: existing } = await supabase
          .from('ai_conversations')
          .select('messages')
          .eq('id', convId)
          .single()

        const messages = Array.isArray(existing?.messages) ? existing.messages : []
        messages.push(
          { id: Date.now().toString(), role: 'user', content: message, created_at: new Date().toISOString() },
          { id: (Date.now() + 1).toString(), role: 'assistant', content: fullText, created_at: new Date().toISOString() }
        )

        await supabase
          .from('ai_conversations')
          .update({ messages, updated_at: new Date().toISOString() })
          .eq('id', convId)
      }

      // Log activity
      await supabase.from('activity_log').insert({
        user_id: user.id,
        client_id: client_id || null,
        activity_type: 'ai_conversation',
        description: `AI chat: "${message.slice(0, 100)}"`,
      })

      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done', conversation_id: convId })}\n\n`))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI error'
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`))
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
