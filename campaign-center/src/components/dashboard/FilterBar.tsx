'use client'

import { Search, SlidersHorizontal, LayoutGrid, LayoutList, X } from 'lucide-react'
import type { ClientFilters } from '@/types'
import { cn } from '@/lib/utils/cn'

interface FilterBarProps {
  filters: ClientFilters
  onChange: (filters: Partial<ClientFilters>) => void
  totalCount: number
  filteredCount: number
  view: 'grid' | 'list'
  onViewChange: (view: 'grid' | 'list') => void
}

const HEALTH_OPTIONS = [
  { value: 'all', label: 'All', color: '' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
  { value: 'warning', label: 'Warning', color: 'text-yellow-400' },
  { value: 'good', label: 'Good', color: 'text-emerald-400' },
  { value: 'excellent', label: 'Excellent', color: 'text-cyan-400' },
] as const

const SORT_OPTIONS = [
  { value: 'health_score', label: 'Health Score' },
  { value: 'name', label: 'Name' },
  { value: 'spend', label: 'Spend' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'updated_at', label: 'Last Updated' },
] as const

export function FilterBar({ filters, onChange, totalCount, filteredCount, view, onViewChange }: FilterBarProps) {
  const hasActiveFilters = filters.search || filters.health_status !== 'all' || filters.has_alerts

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          className="input pl-9 pr-9"
          placeholder="Search clients..."
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
        />
        {filters.search && (
          <button
            onClick={() => onChange({ search: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Health filter pills */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface">
          {HEALTH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange({ health_status: opt.value })}
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-md transition-all',
                filters.health_status === opt.value
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
                opt.color
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Alerts only toggle */}
        <button
          onClick={() => onChange({ has_alerts: filters.has_alerts ? null : true })}
          className={cn(
            'text-xs font-medium px-3 py-2 rounded-lg border transition-all',
            filters.has_alerts
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface'
          )}
        >
          Alerts only
        </button>

        {/* Sort */}
        <select
          value={`${filters.sort_by}:${filters.sort_dir}`}
          onChange={e => {
            const [sort_by, sort_dir] = e.target.value.split(':') as [ClientFilters['sort_by'], 'asc' | 'desc']
            onChange({ sort_by, sort_dir })
          }}
          className="input text-xs py-2 h-9 w-auto cursor-pointer"
        >
          {SORT_OPTIONS.map(opt => (
            <>
              <option key={`${opt.value}:desc`} value={`${opt.value}:desc`}>{opt.label} ↓</option>
              <option key={`${opt.value}:asc`} value={`${opt.value}:asc`}>{opt.label} ↑</option>
            </>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 p-1 rounded-lg bg-surface">
          <button
            onClick={() => onViewChange('grid')}
            className={cn(
              'p-1.5 rounded-md transition-all',
              view === 'grid' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={cn(
              'p-1.5 rounded-md transition-all',
              view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="sm:ml-auto flex items-center text-xs text-muted-foreground whitespace-nowrap self-center">
        {filteredCount < totalCount ? (
          <span>{filteredCount} of {totalCount} clients</span>
        ) : (
          <span>{totalCount} clients</span>
        )}
      </div>
    </div>
  )
}
