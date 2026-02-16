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

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()

  // Protect forum, members and profile routes — show 404 for unauthenticated users
  if (!user && (request.nextUrl.pathname.startsWith('/forum') || request.nextUrl.pathname.startsWith('/members') || request.nextUrl.pathname.startsWith('/profile') || request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/loki'))) {
    const notFoundUrl = new URL('/not-found', request.url)
    return NextResponse.rewrite(notFoundUrl)
  }

  return supabaseResponse
}
