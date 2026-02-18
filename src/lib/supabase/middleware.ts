import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  const isProtectedPath =
    pathname.startsWith('/forum') ||
    pathname.startsWith('/members') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/loki')

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approval_status')
      .eq('id', user.id)
      .single()

    const approvalStatus = (profile?.approval_status ?? 'approved') as 'pending' | 'approved' | 'rejected'

    if (isProtectedPath && approvalStatus !== 'approved') {
      return NextResponse.redirect(new URL('/pending-approval', request.url))
    }

    if (pathname.startsWith('/pending-approval') && approvalStatus === 'approved') {
      return NextResponse.redirect(new URL('/forum', request.url))
    }
  }

  return supabaseResponse
}
