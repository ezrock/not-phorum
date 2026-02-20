import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = new Set(['/login', '/register'])

function isLegacyForumPath(pathname: string): boolean {
  return (
    pathname === '/forum' ||
    pathname === '/forum/' ||
    pathname === '/forum/new' ||
    pathname === '/forum/new/' ||
    pathname === '/forum/search' ||
    pathname === '/forum/search/' ||
    pathname.startsWith('/forum/topic/')
  )
}

function toCanonicalForumPath(pathname: string): string {
  if (pathname === '/forum' || pathname === '/forum/') return '/'
  if (pathname === '/forum/new' || pathname === '/forum/new/') return '/new'
  if (pathname === '/forum/search' || pathname === '/forum/search/') return '/search'
  if (pathname.startsWith('/forum/topic/')) {
    return `/topic/${pathname.slice('/forum/topic/'.length)}`
  }
  return pathname
}

function isKnownLoggedInPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/members' ||
    pathname.startsWith('/members/') ||
    pathname === '/profile' ||
    pathname.startsWith('/profile/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/loki' ||
    pathname.startsWith('/loki/') ||
    pathname === '/pending-approval' ||
    pathname.startsWith('/pending-approval/') ||
    pathname === '/search' ||
    pathname.startsWith('/search/') ||
    pathname === '/new' ||
    pathname.startsWith('/new/') ||
    pathname.startsWith('/topic/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/midi/') ||
    pathname === '/tags' ||
    isLegacyForumPath(pathname)
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Supabase SSR cookie bridge:
          // write to request + response so refreshed session cookies are visible in this middleware pass
          // and sent back to the browser. See docs/architecture.md.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approval_status, is_admin')
      .eq('id', user.id)
      .single()

    const approvalStatus = (profile?.approval_status ?? 'approved') as 'pending' | 'approved' | 'rejected'
    const isAdmin = profile?.is_admin === true

    if (approvalStatus !== 'approved' && pathname !== '/pending-approval') {
      return NextResponse.redirect(new URL('/pending-approval', request.url))
    }

    if (pathname.startsWith('/pending-approval') && approvalStatus === 'approved') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (pathname.startsWith('/admin') && !isAdmin) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (isLegacyForumPath(pathname)) {
      const redirectUrl = new URL(toCanonicalForumPath(pathname), request.url)
      redirectUrl.search = request.nextUrl.search
      return NextResponse.redirect(redirectUrl)
    }

    if (PUBLIC_PATHS.has(pathname) || !isKnownLoggedInPath(pathname)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}
