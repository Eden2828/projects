import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import type { DateRange, DateRangePreset } from '@/types'

export function getDateRange(preset: DateRangePreset, customFrom?: string, customTo?: string): DateRange {
  const today = new Date()
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  switch (preset) {
    case 'today':
      return { preset, from: fmt(today), to: fmt(today), label: 'Today' }
    case 'yesterday': {
      const y = subDays(today, 1)
      return { preset, from: fmt(y), to: fmt(y), label: 'Yesterday' }
    }
    case 'last_7_days':
      return { preset, from: fmt(subDays(today, 6)), to: fmt(today), label: 'Last 7 Days' }
    case 'last_14_days':
      return { preset, from: fmt(subDays(today, 13)), to: fmt(today), label: 'Last 14 Days' }
    case 'last_30_days':
      return { preset, from: fmt(subDays(today, 29)), to: fmt(today), label: 'Last 30 Days' }
    case 'this_month':
      return {
        preset,
        from: fmt(startOfMonth(today)),
        to: fmt(today),
        label: format(today, 'MMMM yyyy'),
      }
    case 'last_month': {
      const lastMonth = subMonths(today, 1)
      return {
        preset,
        from: fmt(startOfMonth(lastMonth)),
        to: fmt(endOfMonth(lastMonth)),
        label: format(lastMonth, 'MMMM yyyy'),
      }
    }
    case 'custom':
      return {
        preset,
        from: customFrom || fmt(subDays(today, 29)),
        to: customTo || fmt(today),
        label: customFrom && customTo
          ? `${format(new Date(customFrom), 'MMM d')} – ${format(new Date(customTo), 'MMM d, yyyy')}`
          : 'Custom Range',
      }
    default:
      return { preset: 'last_30_days', from: fmt(subDays(today, 29)), to: fmt(today), label: 'Last 30 Days' }
  }
}

export const DATE_RANGE_PRESETS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_14_days', label: 'Last 14 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
]
