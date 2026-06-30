import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Think Digital — Campaign Center',
  description: 'AI-powered Campaign Operations Platform for Think Digital agency',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
