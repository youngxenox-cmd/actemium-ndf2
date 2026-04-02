import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
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
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLogin = request.nextUrl.pathname === '/login'

  function redirectWithSessionCookies(url: URL) {
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(c => {
      redirect.cookies.set(c.name, c.value)
    })
    return redirect
  }

  if (!user && !isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return redirectWithSessionCookies(url)
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return redirectWithSessionCookies(url)
  }

  if (user && !isLogin) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approved')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.approved) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('reason', 'pending')
      return redirectWithSessionCookies(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
