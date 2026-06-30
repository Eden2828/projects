'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils/cn'
import {
  LayoutGrid, Bell, MessageSquare, Palette, ClipboardList,
  FileBarChart, Lightbulb, Activity, Settings, LogOut,
  Zap, ChevronRight, Users
} from 'lucide-react'

const navItems = [
  { href: '/campaign-center', label: 'Dashboard', icon: LayoutGrid, exact: true },
  { href: '/campaign-center/alerts', label: 'Alert Center', icon: Bell, badge: 'alerts' },
  { href: '/campaign-center/chat', label: 'AI Assistant', icon: MessageSquare },
  { href: '/campaign-center/creatives', label: 'Creatives', icon: Palette },
  { href: '/campaign-center/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/campaign-center/reports', label: 'Reports', icon: FileBarChart },
  { href: '/campaign-center/insights', label: 'Cross-Account Insights', icon: Lightbulb },
  { href: '/campaign-center/activity', label: 'Activity Log', icon: Activity },
]

const bottomItems = [
  { href: '/campaign-center/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  alertCount?: number
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ alertCount = 0, collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-border bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-[60px] px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate">Think Digital</p>
              <p className="text-xs text-muted-foreground leading-tight">Campaign Center</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={onToggle} className="ml-auto btn-ghost p-1.5 rounded-md">
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map(item => {
          const active = isActive(item.href, item.exact)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'sidebar-link',
                active && 'sidebar-link-active',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              {!collapsed && item.badge === 'alerts' && alertCount > 0 && (
                <span className="badge badge-critical text-xs px-1.5 py-0.5 min-w-[20px] text-center">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border py-3 px-2 space-y-1 flex-shrink-0">
        {bottomItems.map(item => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('sidebar-link', collapsed && 'justify-center px-2')}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            </Link>
          )
        })}

        {/* User */}
        <div className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg',
          collapsed && 'justify-center px-2'
        )}>
          <div className="w-7 h-7 rounded-full bg-brand-gradient flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role?.replace('_', ' ') || ''}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={signOut} className="btn-ghost p-1.5 rounded-md" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
