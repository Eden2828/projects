import { Suspense } from 'react'
import { AuthForm } from '@/components/adpilot/AuthForm'

export const metadata = { title: 'הרשמה — AdPilot' }

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  )
}
