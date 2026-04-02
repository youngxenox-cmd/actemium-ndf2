'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createLoginClient } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember30d, setRemember30d] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reasonMessage = useMemo(() => {
    if (reason === 'pending') {
      return "Votre compte doit être validé par un administrateur avant l'accès à l'application."
    }
    return null
  }, [reason])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createLoginClient(remember30d)
      const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signErr) {
        setError(signErr.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : signErr.message)
        setLoading(false)
        return
      }
      if (!data.user) {
        setError('Connexion impossible.')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('approved')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (!profile?.approved) {
        await supabase.auth.signOut()
        setError("Votre compte n'est pas encore validé. Contactez un administrateur.")
        setLoading(false)
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Une erreur est survenue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--bg)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border)',
          padding: '32px 28px 28px',
        }}
      >
        <div style={{ marginBottom: 28, textAlign: 'center' as const }}>
          <img
            src="/logo-generale-maintenance.png"
            alt="Generale de Maintenance"
            style={{
              width: '80%',
              maxWidth: 280,
              height: 'auto',
              margin: '0 auto 20px',
              display: 'block',
              background: 'transparent',
            }}
          />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 6 }}>
            Connexion
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
            Notes de frais — accès sécurisé
          </p>
        </div>

        {reasonMessage && (
          <div
            style={{
              marginBottom: 18,
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--red-light)',
              border: '1px solid rgba(229,62,62,0.25)',
              fontSize: 13,
              color: '#b91c1c',
              lineHeight: 1.45,
            }}
          >
            {reasonMessage}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--red-light)',
                border: '1px solid rgba(229,62,62,0.25)',
                fontSize: 13,
                color: '#b91c1c',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@exemple.fr"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border2)',
                fontSize: 14,
                color: 'var(--text)',
              }}
            />
          </div>

          <div>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
              Mot de passe
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border2)',
                fontSize: 14,
                color: 'var(--text)',
              }}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text2)',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={remember30d}
              onChange={e => setRemember30d(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
            />
            Rester connecté 30 jours
          </label>
          <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: -8, lineHeight: 1.45, paddingLeft: 28 }}>
            Si la case est décochée, la session expire plus tôt sur cet appareil (environ 8 h).
          </p>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              width: '100%',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: loading ? 'var(--border2)' : 'var(--primary)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg2)' }} />}>
      <LoginForm />
    </Suspense>
  )
}
