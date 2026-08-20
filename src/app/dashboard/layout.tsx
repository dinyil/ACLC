'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/lib/types'
import Sidebar from '@/components/Sidebar'

// Minimal Icon
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18 M3 6h18 M3 18h18" />
    </svg>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser]           = useState<UserProfile | null>(null)
  const [loading, setLoading]     = useState(true)
  const [authError, setAuthError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const loadUser = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !authUser) { router.push('/auth/login'); return }

      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileErr) console.error('Profile fetch error:', profileErr.message, profileErr.code)

      if (!profile) {
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .insert({
            id: authUser.id,
            email: authUser.email ?? '',
            full_name: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'User',
            role: 'staff',
            is_active: true,
          })
          .select()
          .single()

        if (newProfile) {
          setUser(newProfile as UserProfile)
        } else {
          setAuthError('Profile not found. Ask your admin to run create_profiles.sql.')
        }
        setLoading(false)
        return
      }

      setUser(profile as UserProfile)
    } catch (e) {
      console.error('Dashboard layout error:', e)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { loadUser() }, [loadUser])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, margin: '0 auto 1rem', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37,99,235,0.35)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" fill="white" fillOpacity="0.95"/>
              <path d="M9 12l2 2 4-4" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="spinner" style={{ margin: '0 auto', width: '28px', height: '28px' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading ACLC...</p>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="loading-page">
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
          <p style={{ color: 'var(--red)', marginBottom: '1rem', fontSize: '0.9375rem' }}>{authError}</p>
          <button className="btn btn-primary" onClick={handleLogout}>Back to Login</button>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div>
      <Sidebar
        user={user}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile top bar with hamburger */}
      <div className="mobile-topbar">
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" fill="white" fillOpacity="0.9"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>ACLC WMS</span>
        </div>
        <div style={{ width: 36 }} /> {/* spacer for symmetry */}
      </div>

      <div className="main-content">
        {children}
      </div>
    </div>
  )
}
