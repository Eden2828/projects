'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import {
  Send, Sparkles, Plus, MessageSquare, Trash2, User, Bot,
  TrendingUp, AlertTriangle, Lightbulb, Target, PenTool
} from 'lucide-react'
import type { AIConversation, ChatMessage } from '@/types'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/contexts/AuthContext'
import { v4 as uuid } from 'crypto'
import toast from 'react-hot-toast'

const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, text: 'Which accounts should I scale today?', category: 'Strategy' },
  { icon: AlertTriangle, text: 'Which clients need attention right now?', category: 'Alerts' },
  { icon: Target, text: 'What are the best performing creatives this month?', category: 'Creatives' },
  { icon: Lightbulb, text: 'Generate 5 ad copy ideas for e-commerce', category: 'Copy' },
  { icon: PenTool, text: 'Why did CPA increase across multiple accounts?', category: 'Analysis' },
  { icon: Sparkles, text: 'Create an optimization plan for my top client', category: 'Planning' },
]

export default function ChatPage() {
  const [input, setInput] = useState('')
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: conversations = [] } = useQuery<AIConversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(30)
      return (data || []) as AIConversation[]
    },
  })

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, streamingText, scrollToBottom])

  const sendMessage = async () => {
    if (!input.trim() || streaming) return

    const userMsg: ChatMessage = {
      id: Math.random().toString(36),
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          conversation_id: currentConvId,
          history: messages.slice(-10).map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: m.content,
          })),
        }),
      })

      if (!res.ok) throw new Error('AI request failed')
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let newConvId = currentConvId

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'chunk') {
                fullText += data.text
                setStreamingText(fullText)
              } else if (data.type === 'done') {
                newConvId = data.conversation_id || currentConvId
                if (newConvId !== currentConvId) {
                  setCurrentConvId(newConvId)
                  qc.invalidateQueries({ queryKey: ['conversations'] })
                }
              }
            } catch {}
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36),
        role: 'assistant',
        content: fullText,
        created_at: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMsg])
      setStreamingText('')
    } catch (err) {
      toast.error('AI response failed. Please try again.')
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
    } finally {
      setStreaming(false)
    }
  }

  const newConversation = () => {
    setCurrentConvId(null)
    setMessages([])
    setStreamingText('')
  }

  const loadConversation = async (id: string) => {
    const { data } = await supabase
      .from('ai_conversations')
      .select('messages')
      .eq('id', id)
      .single()

    if (data) {
      setCurrentConvId(id)
      setMessages(data.messages as ChatMessage[])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-card hidden lg:flex">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Conversations</h2>
          <button onClick={newConversation} className="btn-ghost p-1.5" title="New conversation">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={cn(
                'w-full text-left p-2.5 rounded-lg text-xs transition-colors',
                currentConvId === conv.id
                  ? 'bg-brand-600/10 text-brand-400'
                  : 'hover:bg-surface text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-3 h-3 flex-shrink-0" />
                <span className="truncate font-medium">{conv.title || 'New conversation'}</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                {formatRelativeTime(conv.updated_at)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col h-full">
        <TopBar title="AI Assistant" subtitle="Ask about campaigns, creatives, strategy" />

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full py-16 space-y-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-semibold mb-2">AI Campaign Assistant</h2>
                <p className="text-muted-foreground max-w-md">
                  Ask me anything about your campaigns, creatives, or strategy. I have access to all account data.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
                {SUGGESTED_PROMPTS.map((p, i) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={i}
                      onClick={() => { setInput(p.text); inputRef.current?.focus() }}
                      className="card card-hover p-4 text-left group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-md bg-brand-gradient flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs text-muted-foreground">{p.category}</span>
                      </div>
                      <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                        {p.text}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {streaming && streamingText && (
            <MessageBubble
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingText,
                created_at: new Date().toISOString(),
              }}
              streaming
            />
          )}

          {streaming && !streamingText && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="card p-3 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about campaigns, request analysis, generate copy..."
                className="input resize-none min-h-[44px] max-h-[200px] py-3 pr-12"
                rows={1}
                style={{ height: 'auto', overflowY: 'hidden' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = `${Math.min(el.scrollHeight, 200)}px`
                }}
                disabled={streaming}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="btn-primary h-[44px] w-[44px] p-0 flex-shrink-0 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-surface border border-border' : 'bg-brand-gradient'
      )}>
        {isUser ? <User className="w-4 h-4 text-muted-foreground" /> : <Bot className="w-4 h-4 text-white" />}
      </div>

      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-brand-600 text-white rounded-tr-sm'
          : 'card rounded-tl-sm',
        streaming && 'after:content-["▋"] after:animate-pulse after:ml-0.5'
      )}>
        {formatMessageContent(message.content)}
      </div>
    </div>
  )
}

function formatMessageContent(content: string): React.ReactNode {
  // Simple markdown-like formatting
  const lines = content.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return <h3 key={i} className="font-semibold mt-3 mb-1 first:mt-0">{line.slice(3)}</h3>
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      return <strong key={i}>{line.slice(2, -2)}</strong>
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-60" />
          <span>{line.slice(2)}</span>
        </div>
      )
    }
    if (line === '') return <br key={i} />
    return <p key={i} className="mb-1 last:mb-0">{line}</p>
  })
}
