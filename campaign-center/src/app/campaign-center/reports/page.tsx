'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import type { Report } from '@/types'
import { formatDate, formatRelativeTime } from '@/lib/utils/format'
import { DATE_RANGE_PRESETS, getDateRange } from '@/lib/utils/date-ranges'
import type { DateRangePreset } from '@/types'
import { cn } from '@/lib/utils/cn'
import {
  FileText, Download, Plus, Loader2, CheckCircle2, XCircle,
  FileBarChart, Presentation, Table2, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'

const FORMAT_ICONS = {
  pdf: FileText,
  pptx: Presentation,
  xlsx: Table2,
}

export default function ReportsPage() {
  const [showGenerate, setShowGenerate] = useState(false)
  const supabase = createClient()
  const qc = useQueryClient()

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*, client:clients(id, name)')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data || []) as Report[]
    },
    refetchInterval: 10 * 1000,
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name').eq('is_active', true)
      return data || []
    },
  })

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Report Generator" subtitle="Generate PDF, PowerPoint and Excel reports" />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Header action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="card p-4 flex-1">
              <p className="text-2xl font-bold">{reports.filter(r => r.status === 'ready').length}</p>
              <p className="text-xs text-muted-foreground">Reports Ready</p>
            </div>
          </div>
          <button
            onClick={() => setShowGenerate(true)}
            className="btn-primary gap-2"
          >
            <Plus className="w-4 h-4" />
            Generate Report
          </button>
        </div>

        {/* Reports list */}
        <div>
          <h2 className="text-sm font-semibold mb-4">Recent Reports</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="card p-4 h-16">
                  <div className="flex gap-3">
                    <div className="skeleton w-8 h-8 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-1/3" />
                      <div className="skeleton h-3 w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mb-4">
                <FileBarChart className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
              <p className="text-muted-foreground">Generate your first report to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map(report => (
                <ReportRow key={report.id} report={report} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showGenerate && (
        <GenerateModal
          clients={clients as { id: string; name: string }[]}
          onClose={() => setShowGenerate(false)}
          onGenerated={() => {
            qc.invalidateQueries({ queryKey: ['reports'] })
            setShowGenerate(false)
          }}
        />
      )}
    </div>
  )
}

function ReportRow({ report }: { report: Report & { client?: { name: string } } }) {
  const FormatIcon = FORMAT_ICONS[report.format] || FileText

  const statusIcon = report.status === 'ready'
    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    : report.status === 'failed'
    ? <XCircle className="w-4 h-4 text-red-400" />
    : <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />

  return (
    <div className="card p-4 flex items-center gap-4 card-hover">
      <div className="w-9 h-9 rounded-lg bg-brand-600/10 flex items-center justify-center flex-shrink-0">
        <FormatIcon className="w-4.5 h-4.5 text-brand-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{report.title}</p>
          <span className="badge bg-surface text-muted-foreground border-border text-[10px]">
            {report.format.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {(report as Report & { client?: { name: string } }).client?.name} ·{' '}
          {formatDate(report.date_from)} – {formatDate(report.date_to)} ·{' '}
          {formatRelativeTime(report.created_at)}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {statusIcon}
        {report.status === 'ready' && report.file_url && (
          <a
            href={report.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs py-1.5 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        )}
        {report.status === 'failed' && (
          <span className="text-xs text-red-400">{report.error || 'Generation failed'}</span>
        )}
      </div>
    </div>
  )
}

function GenerateModal({
  clients,
  onClose,
  onGenerated,
}: {
  clients: { id: string; name: string }[]
  onClose: () => void
  onGenerated: () => void
}) {
  const [clientId, setClientId] = useState(clients[0]?.id || '')
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last_7_days')
  const [format, setFormat] = useState<'pdf' | 'pptx' | 'xlsx'>('pdf')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const dateRange = getDateRange(datePreset)
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          date_from: dateRange.from,
          date_to: dateRange.to,
          format,
          type: datePreset === 'last_7_days' ? 'weekly' : 'monthly',
        }),
      })
      if (!res.ok) throw new Error('Failed to generate report')
      toast.success('Report generation started')
      onGenerated()
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            Generate Report
          </h2>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Client</label>
            <select
              className="input cursor-pointer"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Date Range</label>
            <select
              className="input cursor-pointer"
              value={datePreset}
              onChange={e => setDatePreset(e.target.value as DateRangePreset)}
            >
              {DATE_RANGE_PRESETS.filter(p => p.value !== 'today' && p.value !== 'yesterday').map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {(['pdf', 'pptx', 'xlsx'] as const).map(f => {
                const Icon = FORMAT_ICONS[f]
                return (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                      format === f
                        ? 'border-brand-600 bg-brand-600/10 text-brand-400'
                        : 'border-border hover:border-brand-600/40 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium uppercase">{f}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleGenerate}
              disabled={loading || !clientId}
              className="btn-primary flex-1 gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
