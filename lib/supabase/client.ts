import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Client navigateur (singleton) pour toute l’app après connexion. */
export function createClient() {
  return createBrowserClient(url, key)
}

/**
 * Client dédié à la page de connexion pour régler la durée des cookies.
 * `isSingleton: false` évite de réutiliser le singleton avec de mauvaises options.
 */
export function createLoginClient(remember30d: boolean) {
  const eightHours = 60 * 60 * 8
  const thirtyDays = 60 * 60 * 24 * 30
  return createBrowserClient(url, key, {
    isSingleton: false,
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      maxAge: remember30d ? thirtyDays : eightHours,
    },
  })
}
