'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, UserProfile } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

type Tab = 'company' | 'categories' | 'users' | 'credit'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('user_profiles').select('*').eq('id', user.id).single()
          .then(({ data }) => setCurrentUser(data as UserProfile))
      }
    })
  }, [])

  const isAdmin = currentUser?.role === 'admin'

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">System Settings</h1>
        <p className="page-subtitle">Configure your ACLC system</p>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0' }}>
        {([
          { key: 'company', icon: '🏢', label: 'Company Info' },
          { key: 'categories', icon: '🏷️', label: 'Categories' },
          { key: 'users', icon: '👤', label: 'Users & Roles' },
          { key: 'credit', icon: '💳', label: 'Credit Terms' },
        ] as { key: Tab; icon: string; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontWeight: tab === t.key ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              transition: 'var(--transition)',
              marginBottom: '-1px',
            }}
          >
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'company' && <CompanyTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'users' && <UsersTab isAdmin={isAdmin} />}
      {tab === 'credit' && <CreditTab isAdmin={isAdmin} />}
    </div>
  )
}

// ─── COMPANY TAB ─────────────────────────────────────────────────────────────
function CompanyTab() {
  const [form, setForm] = useState({ company_name: '', company_address: '', company_contact: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('system_settings').select('key,value').in('key', ['company_name', 'company_address', 'company_contact'])
      .then(({ data }) => {
        if (data) {
          const s: Record<string, string> = {}
          data.forEach((r: { key: string; value: string }) => { s[r.key] = (r.value as unknown as string).replace(/^"|"$/g, '') })
          setForm({ company_name: s.company_name ?? '', company_address: s.company_address ?? '', company_contact: s.company_contact ?? '' })
        }
        setLoading(false)
      })
  }, [])

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await Promise.all([
      supabase.from('system_settings').upsert({ key: 'company_name', value: JSON.stringify(form.company_name), updated_by: user?.id }),
      supabase.from('system_settings').upsert({ key: 'company_address', value: JSON.stringify(form.company_address), updated_by: user?.id }),
      supabase.from('system_settings').upsert({ key: 'company_contact', value: JSON.stringify(form.company_contact), updated_by: user?.id }),
    ])
    setMsg('Settings saved!')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  if (loading) return <div className="spinner" style={{ margin: '2rem auto' }} />

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>🏢 Company Information</h2>
      {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><span>✅</span><span>{msg}</span></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="input-group">
          <label className="input-label">Company Name</label>
          <input className="input" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="ACLC Motorcycle Parts & Oils" />
        </div>
        <div className="input-group">
          <label className="input-label">Company Address</label>
          <textarea className="input" value={form.company_address} onChange={e => setForm(f => ({ ...f, company_address: e.target.value }))} placeholder="Full business address" style={{ minHeight: '80px' }} />
        </div>
        <div className="input-group">
          <label className="input-label">Contact Number</label>
          <input className="input" value={form.company_contact} onChange={e => setForm(f => ({ ...f, company_contact: e.target.value }))} placeholder="09XX-XXX-XXXX" />
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? <><div className="spinner" /><span>Saving...</span></> : '💾 Save Settings'}
        </button>
      </div>
    </div>
  )
}

// ─── CATEGORIES TAB ───────────────────────────────────────────────────────────
function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories((data ?? []) as Category[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addCategory() {
    if (!newName.trim()) { setError('Category name is required.'); return }
    setAdding(true)
    const supabase = createClient()
    const { error: e } = await supabase.from('categories').insert({ name: newName.trim(), description: newDesc.trim() || null })
    if (e) setError(e.message)
    else { setNewName(''); setNewDesc(''); load() }
    setAdding(false)
  }

  async function toggleActive(cat: Category) {
    const supabase = createClient()
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    load()
  }

  if (loading) return <div className="spinner" style={{ margin: '2rem auto' }} />

  return (
    <div className="card">
      <h2 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>🏷️ Product Categories</h2>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><span>⚠️</span><span>{error}</span></div>}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="New category name..." style={{ flex: 1, minWidth: '180px' }} onKeyDown={e => e.key === 'Enter' && addCategory()} />
        <input className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" style={{ flex: 2, minWidth: '180px' }} />
        <button className="btn btn-primary" onClick={addCategory} disabled={adding}>
          {adding ? <div className="spinner" /> : '➕ Add'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {categories.map(cat => (
          <div key={cat.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
            opacity: cat.is_active ? 1 : 0.5,
          }}>
            <span style={{ fontSize: '1.125rem' }}>🏷️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{cat.name}</div>
              {cat.description && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{cat.description}</div>}
            </div>
            <span className={`badge ${cat.is_active ? 'badge-green' : 'badge-muted'}`}>{cat.is_active ? 'Active' : 'Inactive'}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(cat)}>
              {cat.is_active ? '🔒 Disable' : '✅ Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────
function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('user_profiles').select('*').order('full_name').then(({ data }) => {
      setUsers((data ?? []) as UserProfile[])
      setLoading(false)
    })
  }, [])

  const ROLE_COLORS: Record<string, string> = {
    admin: 'badge-red', owner: 'badge-yellow', accounting: 'badge-blue',
    staff: 'badge-green', dispatch: 'badge-brand',
  }

  async function changeRole(uid: string, role: string) {
    if (!isAdmin) return
    const supabase = createClient()
    await supabase.from('user_profiles').update({ role }).eq('id', uid)
    setUsers(u => u.map(x => x.id === uid ? { ...x, role: role as UserProfile['role'] } : x))
  }

  async function toggleActive(u: UserProfile) {
    if (!isAdmin) return
    const supabase = createClient()
    await supabase.from('user_profiles').update({ is_active: !u.is_active }).eq('id', u.id)
    setUsers(us => us.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x))
  }

  if (loading) return <div className="spinner" style={{ margin: '2rem auto' }} />

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontWeight: 700 }}>👤 Users & Roles</h2>
        {!isAdmin && <span className="badge badge-yellow">⚠️ Admin access required to modify</span>}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div className="user-avatar" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{u.email}</td>
                <td>
                  {isAdmin ? (
                    <select className="input" style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.8125rem', width: 'auto' }}
                      value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                      {['admin','owner','accounting','staff','dispatch'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className={`badge ${ROLE_COLORS[u.role] ?? 'badge-muted'}`}>{u.role}</span>
                  )}
                </td>
                <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{formatDateTime(u.created_at)}</td>
                {isAdmin && (
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                      {u.is_active ? '🔒 Disable' : '✅ Enable'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── CREDIT TERMS TAB ─────────────────────────────────────────────────────────
function CreditTab({ isAdmin }: { isAdmin: boolean }) {
  const [days, setDays] = useState({ cash: '30', terms: '60', check: '30' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('system_settings').select('key,value').in('key', ['credit_terms_cash_days','credit_terms_terms_days','credit_terms_check_days'])
      .then(({ data }) => {
        if (data) {
          const s: Record<string, string> = {}
          data.forEach((r: { key: string; value: unknown }) => { s[r.key] = String(r.value) })
          setDays({ cash: s.credit_terms_cash_days ?? '30', terms: s.credit_terms_terms_days ?? '60', check: s.credit_terms_check_days ?? '30' })
        }
      })
  }, [])

  async function save() {
    if (!isAdmin) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await Promise.all([
      supabase.from('system_settings').upsert({ key: 'credit_terms_cash_days', value: parseInt(days.cash), updated_by: user?.id }),
      supabase.from('system_settings').upsert({ key: 'credit_terms_terms_days', value: parseInt(days.terms), updated_by: user?.id }),
      supabase.from('system_settings').upsert({ key: 'credit_terms_check_days', value: parseInt(days.check), updated_by: user?.id }),
    ])
    setMsg('Credit terms saved!')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>💳 Credit Terms Configuration</h2>
      {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><span>✅</span><span>{msg}</span></div>}
      {!isAdmin && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}><span>⚠️</span><span>Admin access required to modify credit terms.</span></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {[
          { key: 'cash' as const, label: 'Cash Payment', icon: '💵', desc: 'Days until payment is due for Cash orders' },
          { key: 'terms' as const, label: 'Terms Credit', icon: '📋', desc: 'Days until payment is due for Terms orders' },
          { key: 'check' as const, label: 'Post-Dated Check', icon: '📝', desc: 'Days from check date until due' },
        ].map(({ key, label, icon, desc }) => (
          <div key={key} style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{icon} {label}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number" min="1" max="365"
                  className="input"
                  style={{ width: '80px', textAlign: 'center' }}
                  value={days[key]}
                  onChange={e => setDays(d => ({ ...d, [key]: e.target.value }))}
                  disabled={!isAdmin}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>days</span>
              </div>
            </div>
          </div>
        ))}
        {isAdmin && (
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? <><div className="spinner" /><span>Saving...</span></> : '💾 Save Credit Terms'}
          </button>
        )}
      </div>
    </div>
  )
}
