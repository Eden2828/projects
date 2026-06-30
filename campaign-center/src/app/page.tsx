import { redirect } from 'next/navigation'

// Root now lands on the AdPilot product (Hebrew). The internal agency dashboard
// is still reachable directly at /campaign-center.
export default function HomePage() {
  redirect('/app')
}
