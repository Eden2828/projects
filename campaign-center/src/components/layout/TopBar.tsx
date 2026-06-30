'use client'

import { useState } from 'react'
import { Search, Bell, Sun, Moon, Monitor, ChevronDown, RefreshCw } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils/cn'
import { formatRelativeTime } from '@/lib/utils/format'
import Link from 'next/link'

interface TopBarProps {
  title?: string
  subtitle?: string
  sidebarCollapsed?: boolean
  onSidebarToggle?: () => void
  alertCount?: number
  lastSyncedAt?: string | null
  onSync?: () => void
  syncing?: boolean
  children?: React.ReactNode
}

export function TopBar({
  title,
  subtitle,
  sidebarCollapsed,
  alertCount = 0,
  lastSyncedAt,
  onSync,
  syncing,
  children,
}: TopBarProps) {
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className="h-[60px] flex items-center gap-4 px-6 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
      {/* Title */}
      {(title || subtitle) && (
        <div className="min-w-0">
          {title && <h1 className="text-base font-semibold truncate">{title}</h1>}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {/* Spacer / children */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        {children}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Last sync */}
        {lastSyncedAt && (
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="status-dot status-dot-live" />
            <span>Synced {formatRelativeTime(lastSyncedAt)}</span>
          </div>
        )}

        {/* Sync button */}
        {onSync && (
          <button
            onClick={onSync}
            disabled={syncing}
            className="btn-ghost gap-1.5 text-xs"
            title="Sync data"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        )}

        {/* Search */}
        <button className="btn-ghost p-2" onClick={() => setSearchOpen(!searchOpen)} title="Search">
          <Search className="w-4 h-4" />
        </button>

        {/* Alerts */}
        <Link href="/campaign-center/alerts" className="relative btn-ghost p-2">
          <Bell className="w-4 h-4" />
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </Link>

        {/* Theme */}
        <div className="relative group">
          <button className="btn-ghost p-2" title="Toggle theme">
            {theme === 'dark' ? <Moon className="w-4 h-4" /> :
             theme === 'light' ? <Sun className="w-4 h-4" /> :
             <Monitor className="w-4 h-4" />}
          </button>
          <div className="absolute right-0 top-full mt-1 w-32 card shadow-card-hover py-1 hidden group-focus-within:block group-hover:block z-50">
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-surface transition-colors capitalize flex items-center gap-2',
                  theme === t && 'text-brand-500'
                )}
              >
                {t === 'light' ? <Sun className="w-3.5 h-3.5" /> :
                 t === 'dark' ? <Moon className="w-3.5 h-3.5" /> :
                 <Monitor className="w-3.5 h-3.5" />}
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
