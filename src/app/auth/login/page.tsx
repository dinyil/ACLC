'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const QUICK_ROLES = [
  { role: 'Admin',      email: 'admin@aclc.com',      password: 'Admin@ACLC2025!',    color: '#7c3aed' },
  { role: 'Owner',      email: 'owner@aclc.com',      password: 'Owner@ACLC2025!',    color: '#2563eb' },
  { role: 'Accounting', email: 'accounting@aclc.com', password: 'Acct@ACLC2025!',     color: '#059669' },
  { role: 'Staff',      email: 'staff@aclc.com',      password: 'Staff@ACLC2025!',    color: '#0891b2' },
  { role: 'Dispatch',   email: 'dispatch@aclc.com',   password: 'Dispatch@ACLC2025!', color: '#d97706' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [loadingRole, setLoadingRole] = useState<string | null>(null)
  const [error, setError]             = useState('')
  const [showPass, setShowPass]       = useState(false)

  async function doLogin(em: string, pw: string, roleLabel?: string) {
    setLoading(true)
    if (roleLabel) setLoadingRole(roleLabel)
    setError('')
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: em, password: pw })
      if (signInError) throw signInError
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
      setLoadingRole(null)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />

      <div className="auth-card" style={{ maxWidth: 400 }}>
        {/* Logo */}
        <div className="auth-logo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z"
              fill="white" fillOpacity="0.95"/>
            <path d="M9 12l2 2 4-4" stroke="#2563eb" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="auth-title">ACLC</h1>
        <p className="auth-subtitle">Motorcycle Parts &amp; Oils<br />Warehouse Management System</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
        )}

        {/* Quick role buttons */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{
            fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: '0.625rem', textAlign: 'center',
          }}>
            Select Role to Sign In
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            {QUICK_ROLES.map(r => (
              <button
                key={r.role}
                type="button"
                onClick={() => doLogin(r.email, r.password, r.role)}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.6rem 0.875rem',
                  background: loadingRole === r.role ? `${r.color}18` : 'var(--bg-input)',
                  border: `1px solid ${loadingRole === r.role ? r.color : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: loadingRole === r.role ? r.color : 'var(--text-secondary)',
                  fontSize: '0.8125rem', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading && loadingRole !== r.role ? 0.45 : 1,
                  transition: 'all 0.15s',
                  gridColumn: r.role === 'Dispatch' ? 'span 2' : 'span 1',
                }}
              >
                {loadingRole === r.role
                  ? <><div className="spinner" style={{ width: 13, height: 13, borderTopColor: r.color }} /><span>Signing in…</span></>
                  : <span>{r.role}</span>
                }
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>or sign in manually</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Manual form */}
        <form className="auth-form" onSubmit={e => { e.preventDefault(); doLogin(email, password) }}>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              id="email" type="email" className="input"
              placeholder="you@aclc.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password"
                style={{ paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', fontSize: '0.75rem',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading && !loadingRole
              ? <><div className="spinner" /><span>Signing in…</span></>
              : 'Sign In'
            }
          </button>
        </form>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <a href="/auth/reset-password" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Forgot password?
          </a>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', opacity: 0.6 }}>
          ACLC WMS v2.0
        </div>
      </div>
    </div>
  )
}
