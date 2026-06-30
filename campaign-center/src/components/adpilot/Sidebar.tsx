'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import {
  LayoutDashboard, ClipboardList, Megaphone, Lightbulb,
  Bell, Settings, Shield, LogOut, Sparkles,
} from 'lucide-react'

const nav = [
  { href: '/app/dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
  { href: '/app/onboarding', label: 'פרופיל העסק', icon: ClipboardList },
  { href: '/app/drafts', label: 'קמפיינים', icon: Megaphone },
  { href: '/app/recommendations', label: 'המלצות', icon: Lightbulb },
  { href: '/app/alerts', label: 'התראות', icon: Bell },
  { href: '/app/settings', label: 'הגדרות', icon: Settings },
]

export function AdpilotSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/app/login')
    router.refresh()
  }

  return (
    <aside className="fixed inset-y-0 right-0 w-[260px] border-l border-border bg-card flex flex-col">
      <div className="h-[60px] flex items-center gap-2 px-5 border-b border-border">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-gradient">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg">AdPilot</span>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-auto">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className={cn('sidebar-link', active && 'sidebar-link-active')}>
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          )
        })}

        {isAdmin && (
          <Link href="/app/admin"
            className={cn('sidebar-link', pathname.startsWith('/app/admin') && 'sidebar-link-active')}>
            <Shield className="w-[18px] h-[18px]" />
            ניהול סוכנות
          </Link>
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <button onClick={signOut} className="sidebar-link w-full">
          <LogOut className="w-[18px] h-[18px]" />
          התנתקות
        </button>
      </div>
    </aside>
  )
}
