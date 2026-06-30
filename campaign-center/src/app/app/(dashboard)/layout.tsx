import { redirect } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import { getApUser } from '@/lib/adpilot/data'
import { AdpilotSidebar } from '@/components/adpilot/Sidebar'

// Protected shell for the AdPilot dashboard. RTL Hebrew layout.
// Middleware already gates these routes; this is a defense-in-depth check.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getApUser()
  if (!user) redirect('/app/login')

  return (
    <div dir="rtl" lang="he" className="min-h-screen bg-background">
      <AdpilotSidebar isAdmin={user.role === 'admin'} />
      <div className="pr-[260px] min-h-screen">
        <main className="p-6 max-w-6xl mx-auto">{children}</main>
      </div>
      <Toaster
        position="top-left"
        toastOptions={{
          className: 'card text-sm border border-border',
          style: { background: 'rgb(var(--card))', color: 'rgb(var(--foreground))' },
        }}
      />
    </div>
  )
}
