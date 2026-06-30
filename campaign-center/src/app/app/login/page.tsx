import { Suspense } from 'react'
import { AuthForm } from '@/components/adpilot/AuthForm'

export const metadata = { title: 'כניסה — AdPilot' }

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  )
}
