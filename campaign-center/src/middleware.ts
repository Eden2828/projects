import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login' || pathname.startsWith('/login/')
  const isCampaignCenter = pathname.startsWith('/campaign-center')
  const isApiRoute = pathname.startsWith('/api')
  const isWebhook = pathname.startsWith('/api/meta/webhook')
  // Cron-ready jobs authenticate themselves via CRON_SECRET (Bearer), not a session.
  const isCronJob = pathname.startsWith('/api/jobs/')

  // ---- AdPilot (self-serve ad-management product, mounted at /app) ----
  // Public: the landing page, login and signup. Everything else under /app is protected.
  const isAdpilot = pathname === '/app' || pathname.startsWith('/app/')
  const isAdpilotPublic =
    pathname === '/app' || pathname === '/app/login' || pathname === '/app/signup' ||
    pathname === '/app/demo'
  const isAdpilotProtected = isAdpilot && !isAdpilotPublic

  // Allow webhook and self-authenticating cron jobs through without a session.
  if (isWebhook || isCronJob) return supabaseResponse

  // Redirect unauthenticated users to the appropriate login
  if (!user && isCampaignCenter && !isApiRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  if (!user && isAdpilotProtected) {
    const loginUrl = new URL('/app/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from login/signup pages
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/campaign-center', request.url))
  }
  if (user && (pathname === '/app/login' || pathname === '/app/signup')) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url))
  }

  // Check API routes for auth (except webhook + cron, already returned above)
  if (!user && isApiRoute && !isWebhook && !isCronJob) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
