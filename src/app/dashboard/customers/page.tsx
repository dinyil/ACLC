'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer, CreditTermsType, UserRole } from '@/lib/types'
import { formatDate, CREDIT_TERMS_LABEL } from '@/lib/utils'
import Link from 'next/link'

// ─── CUSTOMER FORM MODAL ─────────────────────────────────────────────────────
function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!customer
  const [form, setForm] = useState({
    business_name:  customer?.business_name  ?? '',
    contact_person: customer?.contact_person ?? '',
    contact_number: customer?.contact_number ?? customer?.phone ?? '',
    address:        customer?.address        ?? '',
    tin:            customer?.tin            ?? '',
    agent_name:     customer?.agent_name     ?? '',
    credit_terms:   (customer?.credit_terms  ?? 'CASH') as CreditTermsType,
    credit_limit:   customer?.credit_limit?.toString() ?? '',
    notes:          customer?.notes          ?? '',
    is_active:      customer?.is_active      ?? true,
  })
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState('')
  const [dupWarn, setDupWarn]   = useState('')

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  // Live duplicate check on business_name blur
  async function checkDuplicate(field: string, value: string) {
    if (!value.trim()) return
    const supabase = createClient()
    const query = supabase.from('customers').select('id, business_name').eq(field, value.trim())
    if (isEdit) query.neq('id', customer!.id)
    const { data } = await query.limit(1)
    if (data && data.length > 0) {
      const labels: Record<string, string> = {
        business_name:  'Shop name',
        contact_number: 'Contact number',
        tin:            'TIN',
      }
      setDupWarn(`⚠️ ${labels[field] ?? field} already exists: "${(data[0] as any).business_name ?? value}"`)
    } else {
      setDupWarn('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.business_name.trim() || !form.contact_person.trim()) {
      setError('Shop name and contact person are required.')
      return
    }
    if (dupWarn) {
      setError('Please resolve the duplicate warning before saving.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Final duplicate check before insert
      if (!isEdit) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('business_name', form.business_name.trim())
          .limit(1)
        if (existing && existing.length > 0) {
          setError('A shop with this name already exists.')
          setLoading(false)
          return
        }
      }

      const payload = {
        business_name:  form.business_name.trim(),
        contact_person: form.contact_person.trim(),
        contact_number: form.contact_number.trim() || null,
        address:        form.address.trim()        || null,
        tin:            form.tin.trim()            || null,
        agent_name:     form.agent_name.trim()     || null,
        credit_terms:   form.credit_terms,
        credit_limit:   form.credit_limit ? parseFloat(form.credit_limit) : null,
        notes:          form.notes.trim()          || null,
        is_active:      form.is_active,
        updated_by:     user?.id,
      }

      const before = isEdit ? { ...customer } : null

      if (isEdit) {
        const { error: e } = await supabase.from('customers').update(payload).eq('id', customer!.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('customers').insert({ ...payload, created_by: user?.id })
        if (e) throw e
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id:     user?.id,
        action_type: isEdit ? 'SHOP_UPDATED' : 'SHOP_CREATED',
        module:      'customers',
        record_id:   customer?.id,
        before_data: before,
        after_data:  payload,
      })

      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? '✏️ Edit Shop / Customer' : '➕ New Shop / Customer'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {error   && <div className="alert alert-error"   style={{ marginBottom: '1rem' }}><span>⚠️</span><span>{error}</span></div>}
        {dupWarn && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}><span>{dupWarn}</span></div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Shop Name */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Shop / Business Name *</label>
              <input
                id="cust-name" className="input"
                value={form.business_name}
                onChange={e => set('business_name', e.target.value)}
                onBlur={e => checkDuplicate('business_name', e.target.value)}
                placeholder="e.g. Juan dela Cruz Motor Shop"
                required
              />
            </div>

            {/* Contact Person */}
            <div className="input-group">
              <label className="input-label">Contact Person *</label>
              <input id="cust-contact" className="input" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Full name" required />
            </div>

            {/* Contact Number */}
            <div className="input-group">
              <label className="input-label">Contact Number</label>
              <input
                id="cust-phone" className="input"
                value={form.contact_number}
                onChange={e => set('contact_number', e.target.value)}
                onBlur={e => e.target.value && checkDuplicate('contact_number', e.target.value)}
                placeholder="09XX-XXX-XXXX"
              />
            </div>

            {/* Address */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Complete Address</label>
              <input id="cust-address" className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full business address" />
            </div>

            {/* TIN */}
            <div className="input-group">
              <label className="input-label">Customer TIN</label>
              <input
                id="cust-tin" className="input"
                value={form.tin}
                onChange={e => set('tin', e.target.value)}
                onBlur={e => e.target.value && checkDuplicate('tin', e.target.value)}
                placeholder="XXX-XXX-XXX"
              />
            </div>

            {/* Agent */}
            <div className="input-group">
              <label className="input-label">Assigned Agent</label>
              <input id="cust-agent" className="input" value={form.agent_name} onChange={e => set('agent_name', e.target.value)} placeholder="Agent name" />
            </div>

            {/* Credit Terms */}
            <div className="input-group">
              <label className="input-label">Default Payment Term</label>
              <select id="cust-terms" className="input" value={form.credit_terms} onChange={e => set('credit_terms', e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="TERMS">Terms (60 days)</option>
                <option value="POST_DATED_CHECK">Post-Dated Check (30 days)</option>
              </select>
            </div>

            {/* Credit Limit */}
            <div className="input-group">
              <label className="input-label">Credit Limit (₱)</label>
              <input id="cust-limit" className="input" type="number" min="0" step="0.01" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} placeholder="0 = no limit" />
            </div>

            {/* Status (edit only) */}
            {isEdit && (
              <div className="input-group">
                <label className="input-label">Status</label>
                <select id="cust-status" className="input" value={form.is_active ? 'active' : 'inactive'} onChange={e => set('is_active', e.target.value === 'active')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Notes</label>
              <textarea id="cust-notes" className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes about this shop..." style={{ minHeight: '80px', resize: 'vertical' }} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="cust-save" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /><span>Saving...</span></> : <><span>💾</span><span>{isEdit ? 'Update Shop' : 'Create Shop'}</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── DEACTIVATE CONFIRM MODAL ────────────────────────────────────────────────
function DeactivateModal({
  customer,
  onClose,
  onConfirm,
  loading,
}: {
  customer: Customer
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">⚠️ Deactivate Shop</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
          Are you sure you want to deactivate <strong style={{ color: 'var(--text-primary)' }}>{customer.business_name}</strong>?
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          This will hide them from active lists but preserve all orders, payments, and price history.
        </p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button id="confirm-deactivate" className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <><div className="spinner" /><span>Deactivating...</span></> : '🗑️ Deactivate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers,    setCustomers]    = useState<Customer[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterTerms,  setFilterTerms]  = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [showModal,    setShowModal]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('business_name')
    setCustomers((data ?? []) as Customer[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase.channel('customers-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  async function handleDeactivate() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('customers').update({ is_active: false }).eq('id', deleteTarget.id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      action_type: 'SHOP_DEACTIVATED',
      module: 'customers',
      record_id: deleteTarget.id,
      before_data: { is_active: true },
      after_data:  { is_active: false },
    })
    setDeleteTarget(null)
    setDeleting(false)
    load()
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    const num = c.contact_number ?? c.phone ?? ''
    const matchSearch = !q
      || c.business_name.toLowerCase().includes(q)
      || c.contact_person.toLowerCase().includes(q)
      || (c.agent_name ?? '').toLowerCase().includes(q)
      || num.toLowerCase().includes(q)
      || (c.tin ?? '').toLowerCase().includes(q)
      || (c.customer_code ?? '').toLowerCase().includes(q)
    const matchTerms  = filterTerms === 'ALL' || c.credit_terms === filterTerms
    const matchStatus =
      filterStatus === 'all'     ? true :
      filterStatus === 'active'  ? c.is_active :
                                   !c.is_active
    return matchSearch && matchTerms && matchStatus
  })

  const termsBadge = (t: CreditTermsType) => {
    const map  = { CASH: 'badge-green', TERMS: 'badge-blue', POST_DATED_CHECK: 'badge-yellow' }
    const short = { CASH: 'Cash', TERMS: 'Terms', POST_DATED_CHECK: 'PDC' }
    return <span className={`badge ${map[t]}`}>{short[t]}</span>
  }

  const activeCount   = customers.filter(c => c.is_active).length
  const inactiveCount = customers.filter(c => !c.is_active).length

  if (loading) return (
    <div className="loading-page" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Shops / Customers</h1>
          <p className="page-subtitle">
            {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        <button id="new-customer-btn" className="btn btn-primary" onClick={() => { setEditTarget(null); setShowModal(true) }}>
          ➕ New Shop
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="input-icon-wrap" style={{ flex: 1, minWidth: '220px' }}>
            <span className="input-icon">🔍</span>
            <input
              id="customer-search"
              className="input"
              placeholder="Search name, contact, agent, TIN, code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select id="terms-filter" className="input" style={{ width: 'auto' }} value={filterTerms} onChange={e => setFilterTerms(e.target.value)}>
            <option value="ALL">All Payment Terms</option>
            <option value="CASH">Cash</option>
            <option value="TERMS">Terms (60 days)</option>
            <option value="POST_DATED_CHECK">Post-Dated Check</option>
          </select>
          <select id="status-filter" className="input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'active' | 'inactive' | 'all')}>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="all">All Statuses</option>
          </select>
          {(search || filterTerms !== 'ALL' || filterStatus !== 'active') && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterTerms('ALL'); setFilterStatus('active') }}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Shop / Business Name</th>
              <th>Contact Person</th>
              <th>Contact #</th>
              <th>Agent</th>
              <th>TIN</th>
              <th>Payment Term</th>
              <th>Credit Limit</th>
              <th>Status</th>
              <th>Since</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-state-icon">🏪</div>
                    <div className="empty-state-title">{search ? 'No results found' : 'No shops yet'}</div>
                    <div className="empty-state-desc">{!search && 'Click "New Shop" to add your first shop'}</div>
                  </div>
                </td>
              </tr>
            ) : filtered.map(c => (
              <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.55 }}>
                <td>
                  <span className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {c.customer_code}
                  </span>
                </td>
                <td>
                  <Link href={`/dashboard/customers/${c.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.business_name}
                  </Link>
                </td>
                <td>{c.contact_person}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.contact_number ?? c.phone ?? '—'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.agent_name ?? '—'}</td>
                <td><span className="mono" style={{ fontSize: '0.8125rem' }}>{c.tin ?? '—'}</span></td>
                <td>{termsBadge(c.credit_terms)}</td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {c.credit_limit ? `₱${Number(c.credit_limit).toLocaleString()}` : <span style={{ color: 'var(--text-muted)' }}>No limit</span>}
                </td>
                <td>
                  <span className={`badge ${c.is_active ? 'badge-green' : 'badge-red'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{formatDate(c.created_at)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <Link
                      href={`/dashboard/customers/${c.id}`}
                      className="btn btn-ghost btn-sm"
                      title="View Profile"
                    >
                      👁️
                    </Link>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      title="Edit"
                      onClick={() => { setEditTarget(c); setShowModal(true) }}
                    >✏️</button>
                    {c.is_active && (
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        title="Deactivate"
                        onClick={() => setDeleteTarget(c)}
                      >🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results count */}
      {filtered.length > 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.75rem', textAlign: 'right' }}>
          Showing {filtered.length} of {customers.length} shops
        </p>
      )}

      {/* Shop Modal */}
      {showModal && (
        <CustomerModal
          customer={editTarget}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}

      {/* Deactivate Confirm */}
      {deleteTarget && (
        <DeactivateModal
          customer={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeactivate}
          loading={deleting}
        />
      )}
    </div>
  )
}
