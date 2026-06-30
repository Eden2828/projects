'use client'

import { useState } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils/cn'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export default function CampaignCenterLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <div className="min-h-screen bg-background">
            <Sidebar
              collapsed={collapsed}
              onToggle={() => setCollapsed(!collapsed)}
            />
            <div
              className={cn(
                'flex flex-col min-h-screen transition-all duration-300',
                collapsed ? 'pl-16' : 'pl-[260px]'
              )}
            >
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </div>
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'card text-sm border border-border',
                style: { background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' },
              }}
            />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
