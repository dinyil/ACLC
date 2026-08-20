'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Customer, Product, ShopPricing, ShopPricingHistory,
  Order, Payment, AuditLog, CreditTermsType, UserProfile, UserRole,
  PRICE_SOURCE_CONFIG, hasPermission,
} from '@/lib/types'
import { formatCurrency, formatDate, formatDateTime, CREDIT_TERMS_LABEL } from '@/lib/utils'
import SearchableSelect from '@/components/SearchableSelect'

type Tab = 'info' | 'pricing' | 'orders' | 'payments' | 'activity'

// ─── PRICE SOURCE BADGE ───────────────────────────────────────────────────────
function PriceSourceBadge({ source }: { source: string }) {
  const cfg = PRICE_SOURCE_CONFIG[source as keyof typeof PRICE_SOURCE_CONFIG]
  if (!cfg) return null
  return (
    <span className={`badge ${cfg.cls}`} title={cfg.description}>
      {cfg.label}
    </span>
  )
}

// ─── ADD / EDIT PRICING MODAL ─────────────────────────────────────────────────
function PricingModal({
  shopId,
  products,
  existing,
  onClose,
  onSaved,
}: {
  shopId: string
  products: Product[]
  existing?: ShopPricing | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!existing
  const [form, setForm] = useState({
    product_id:     existing?.product_id    ?? '',
    special_price:  existing?.special_price?.toString() ?? '',
    effective_date: existing?.effective_date ?? new Date().toISOString().slice(0, 10),
    reason:         existing?.reason        ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [regularPrice, setRegularPrice] = useState(existing?.regular_price ?? 0)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Auto-load regular price when product changes
  useEffect(() => {
    if (form.product_id) {
      const prod = products.find(p => p.id === form.product_id)
      if (prod) setRegularPrice(prod.unit_price)
    }
  }, [form.product_id, products])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product_id || !form.special_price || !form.effective_date) {
      setError('Product, special price, and effective date are required.')
      return
    }
    const sp = parseFloat(form.special_price)
    if (isNaN(sp) || sp < 0) {
      setError('Special price must be a valid number.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Get previous price for history
      let prevPrice: number | undefined
      if (isEdit) {
        prevPrice = existing?.special_price
      } else {
        const { data: active } = await supabase
          .from('shop_pricing')
          .select('special_price')
          .eq('shop_id', shopId)
          .eq('product_id', form.product_id)
          .eq('is_active', true)
          .single()
        prevPrice = active?.special_price
      }

      // 1. Deactivate any existing active price for this shop+product
      await supabase
        .from('shop_pricing')
        .update({ is_active: false, updated_by: user?.id })
        .eq('shop_id', shopId)
        .eq('product_id', form.product_id)
        .eq('is_active', true)

      // 2. Insert new active price record
      const { error: insertErr } = await supabase.from('shop_pricing').insert({
        shop_id:        shopId,
        product_id:     form.product_id,
        regular_price:  regularPrice,
        special_price:  sp,
        effective_date: form.effective_date,
        is_active:      true,
        reason:         form.reason.trim() || null,
        created_by:     user?.id,
        updated_by:     user?.id,
      })
      if (insertErr) throw insertErr

      // 3. Insert history record
      await supabase.from('shop_pricing_history').insert({
        shop_id:        shopId,
        product_id:     form.product_id,
        previous_price: prevPrice ?? null,
        new_price:      sp,
        effective_date: form.effective_date,
        changed_by:     user?.id,
        reason:         form.reason.trim() || null,
      })

      // 4. Audit log
      await supabase.from('audit_logs').insert({
        user_id:     user?.id,
        action_type: isEdit ? 'SHOP_PRICE_UPDATED' : 'SHOP_PRICE_CREATED',
        module:      'shop_pricing',
        record_id:   shopId,
        before_data: { product_id: form.product_id, previous_price: prevPrice },
        after_data:  { product_id: form.product_id, new_price: sp, effective_date: form.effective_date },
      })

      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save price.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? '✏️ Update Shop Price' : '🏷️ Set Shop-Specific Price'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><span>⚠️</span><span>{error}</span></div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Product *</label>
              <SearchableSelect
                required
                disabled={isEdit}
                placeholder="— Select Product —"
                searchPlaceholder="Search product name or SKU..."
                value={form.product_id}
                onChange={v => set('product_id', v)}
                options={products.map(p => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.sku,
                  badge: formatCurrency(p.unit_price),
                  badgeColor: 'var(--brand-accent)',
                }))}
              />
            </div>

            {form.product_id && (
              <div style={{ gridColumn: '1 / -1', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Regular price: </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(regularPrice)}</span>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Special Shop Price (₱) *</label>
              <input className="input" type="number" step="0.01" min="0" value={form.special_price} onChange={e => set('special_price', e.target.value)} required />
            </div>

            <div className="input-group">
              <label className="input-label">Effective Date *</label>
              <input className="input" type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)} required />
            </div>

            {form.special_price && regularPrice > 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '0.5rem 0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Discount from regular: </span>
                <span style={{ color: parseFloat(form.special_price) < regularPrice ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {regularPrice > 0
                    ? `${(((regularPrice - parseFloat(form.special_price)) / regularPrice) * 100).toFixed(1)}% (${formatCurrency(regularPrice - parseFloat(form.special_price))})`
                    : '—'}
                </span>
              </div>
            )}

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Reason / Notes</label>
              <input className="input" value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="e.g. Bulk discount, loyalty rate..." />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /><span>Saving...</span></> : <><span>💾</span><span>Save Price</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── DEACTIVATE PRICE CONFIRM ─────────────────────────────────────────────────
function DeactivatePriceConfirm({
  pricing,
  onClose,
  onConfirm,
  loading,
}: {
  pricing: ShopPricing
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title">⚠️ Deactivate Special Price</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
          Deactivate the special price of <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(pricing.special_price)}</strong> for <strong style={{ color: 'var(--text-primary)' }}>{(pricing.product as any)?.name ?? 'this product'}</strong>?
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          Future orders will revert to the regular product price. Existing orders are unaffected.
        </p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <><div className="spinner" /><span>Deactivating...</span></> : 'Deactivate Price'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── INFO TAB ─────────────────────────────────────────────────────────────────
function InfoTab({ shop, onEdit }: { shop: Customer; onEdit: () => void }) {
  const contactNumber = shop.contact_number ?? shop.phone ?? '—'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      {/* Left column */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shop Information</h3>
        <InfoRow label="Shop Code"     value={shop.customer_code} mono />
        <InfoRow label="Business Name" value={shop.business_name} strong />
        <InfoRow label="Contact Person" value={shop.contact_person} />
        <InfoRow label="Contact Number" value={contactNumber} />
        <InfoRow label="Address"       value={shop.address ?? '—'} />
        <InfoRow label="TIN"           value={shop.tin ?? '—'} mono />
        <InfoRow label="Assigned Agent" value={shop.agent_name ?? '—'} />
      </div>
      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment & Credit</h3>
          <InfoRow label="Default Payment Term" value={CREDIT_TERMS_LABEL[shop.credit_terms]} />
          <InfoRow label="Credit Limit"         value={shop.credit_limit ? formatCurrency(shop.credit_limit) : 'No limit'} />
          <InfoRow label="Status"               value={shop.is_active ? 'Active' : 'Inactive'} />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</h3>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
            {shop.notes ?? <span style={{ color: 'var(--text-muted)' }}>No notes.</span>}
          </p>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timestamps</h3>
          <InfoRow label="Date Created" value={formatDateTime(shop.created_at)} />
          <InfoRow label="Last Updated" value={formatDateTime(shop.updated_at)} />
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={onEdit}>✏️ Edit Shop Info</button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{
        fontSize: '0.9375rem',
        color: 'var(--text-primary)',
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
        fontWeight: strong ? 700 : 400,
      }}>{value}</span>
    </div>
  )
}

// ─── PRICING TAB ──────────────────────────────────────────────────────────────
function PricingTab({
  shopId,
  canManage,
}: {
  shopId: string
  canManage: boolean
}) {
  const [pricings, setPricings]       = useState<ShopPricing[]>([])
  const [history,  setHistory]        = useState<ShopPricingHistory[]>([])
  const [products, setProducts]       = useState<Product[]>([])
  const [loading,  setLoading]        = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [editPrice, setEditPrice]     = useState<ShopPricing | null>(null)
  const [deactivating, setDeactivating] = useState<ShopPricing | null>(null)
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [pRes, hRes, prodRes] = await Promise.all([
      supabase.from('shop_pricing')
        .select('*, product:products(id,name,sku,unit_price)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false }),
      supabase.from('shop_pricing_history')
        .select('*, product:products(id,name,sku), changed_by_user:user_profiles!shop_pricing_history_changed_by_fkey(full_name)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ])
    setPricings((pRes.data ?? []) as ShopPricing[])
    setHistory((hRes.data ?? []) as ShopPricingHistory[])
    setProducts((prodRes.data ?? []) as Product[])
    setLoading(false)
  }, [shopId])

  useEffect(() => { load() }, [load])

  async function handleDeactivatePrice() {
    if (!deactivating) return
    setDeactivateLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('shop_pricing')
      .update({ is_active: false, updated_by: user?.id })
      .eq('id', deactivating.id)
    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      action_type: 'SHOP_PRICE_DEACTIVATED',
      module: 'shop_pricing',
      record_id: shopId,
      before_data: { special_price: deactivating.special_price, product_id: deactivating.product_id },
      after_data: { is_active: false },
    })
    setDeactivating(null)
    setDeactivateLoading(false)
    load()
  }

  const activePricings   = pricings.filter(p => p.is_active)
  const inactivePricings = pricings.filter(p => !p.is_active)
  const displayPricings  = showInactive ? pricings : activePricings

  const filteredHistory = historyFilter
    ? history.filter(h => (h.product as any)?.name?.toLowerCase().includes(historyFilter.toLowerCase()))
    : history

  if (loading) return <div className="spinner" style={{ margin: '3rem auto' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Active / All Prices */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Shop-Specific Prices</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {activePricings.length} active · {inactivePricings.length} inactive
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowInactive(p => !p)}
              style={{ fontSize: '0.8125rem' }}
            >
              {showInactive ? 'Hide Inactive' : 'Show Inactive'}
            </button>
            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={() => { setEditPrice(null); setShowModal(true) }}>
                🏷️ Set Price
              </button>
            )}
          </div>
        </div>

        {displayPricings.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-state-icon">🏷️</div>
            <div className="empty-state-title">No special prices set</div>
            <div className="empty-state-desc">All orders use the product's regular price for this shop.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Regular Price</th>
                  <th>Special Price</th>
                  <th>Discount</th>
                  <th>Effective Date</th>
                  <th>Status</th>
                  <th>Reason</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayPricings.map(p => {
                  const prod = p.product as any
                  const disc = p.regular_price > 0
                    ? ((p.regular_price - p.special_price) / p.regular_price * 100).toFixed(1)
                    : '—'
                  return (
                    <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 600 }}>{prod?.name ?? '—'}</td>
                      <td><span className="mono" style={{ fontSize: '0.8125rem' }}>{prod?.sku ?? '—'}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatCurrency(p.regular_price)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(p.special_price)}</td>
                      <td style={{ color: p.special_price < p.regular_price ? 'var(--green)' : 'var(--red)' }}>
                        {typeof disc === 'string' && disc !== '—' ? `${disc}%` : disc}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDate(p.effective_date)}</td>
                      <td>
                        <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{p.reason ?? '—'}</td>
                      {canManage && (
                        <td>
                          {p.is_active && (
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditPrice(p); setShowModal(true) }} title="Update Price">✏️</button>
                              <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeactivating(p)} title="Deactivate">🚫</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Price History */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Price History</h3>
          <input
            className="input"
            style={{ width: '220px' }}
            placeholder="Filter by product..."
            value={historyFilter}
            onChange={e => setHistoryFilter(e.target.value)}
          />
        </div>
        {filteredHistory.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-state-title">No price history yet</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Previous Price</th>
                  <th>New Price</th>
                  <th>Change</th>
                  <th>Effective Date</th>
                  <th>Changed By</th>
                  <th>Reason</th>
                  <th>Date Changed</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(h => {
                  const prod = h.product as any
                  const changer = h.changed_by_user as any
                  const diff = h.previous_price != null
                    ? h.new_price - h.previous_price
                    : null
                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600 }}>{prod?.name ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {h.previous_price != null ? formatCurrency(h.previous_price) : <span style={{ color: 'var(--text-muted)' }}>New</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(h.new_price)}</td>
                      <td>
                        {diff != null ? (
                          <span style={{ color: diff < 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                            {diff < 0 ? '▼' : '▲'} {formatCurrency(Math.abs(diff))}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDate(h.effective_date)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{changer?.full_name ?? '—'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{h.reason ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{formatDateTime(h.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <PricingModal
          shopId={shopId}
          products={products}
          existing={editPrice}
          onClose={() => { setShowModal(false); setEditPrice(null) }}
          onSaved={load}
        />
      )}
      {deactivating && (
        <DeactivatePriceConfirm
          pricing={deactivating}
          onClose={() => setDeactivating(null)}
          onConfirm={handleDeactivatePrice}
          loading={deactivateLoading}
        />
      )}
    </div>
  )
}

// ─── ORDERS TAB ───────────────────────────────────────────────────────────────
function OrdersTab({ shopId }: { shopId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', shopId)
        .order('created_at', { ascending: false })
      setOrders((data ?? []) as Order[])
      setLoading(false)
    }
    load()
  }, [shopId])

  if (loading) return <div className="spinner" style={{ margin: '3rem auto' }} />

  const total       = orders.reduce((s, o) => s + o.total_amount, 0)
  const paid        = orders.filter(o => o.payment_status === 'PAID')
  const unpaid      = orders.filter(o => o.payment_status === 'UNPAID')
  const partial     = orders.filter(o => o.payment_status === 'PARTIAL')
  const overdue     = orders.filter(o => o.due_date && new Date(o.due_date) < new Date() && o.payment_status !== 'PAID')
  const outstanding = orders.reduce((s, o) => s + o.balance_due, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Purchases', value: formatCurrency(total), color: 'var(--brand-primary)' },
          { label: 'Paid Orders',     value: paid.length,           color: 'var(--green)' },
          { label: 'Unpaid Orders',   value: unpaid.length,         color: 'var(--red)' },
          { label: 'Partial',         value: partial.length,        color: 'var(--yellow)' },
          { label: 'Overdue',         value: overdue.length,        color: 'var(--red)' },
          { label: 'Outstanding',     value: formatCurrency(outstanding), color: outstanding > 0 ? 'var(--red)' : 'var(--green)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Order History</h3>
        {orders.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-state-title">No orders yet</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td><span className="mono" style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{o.order_number}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(o.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(o.total_amount)}</td>
                    <td style={{ color: 'var(--green)' }}>{formatCurrency(o.amount_paid)}</td>
                    <td style={{ color: o.balance_due > 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: o.balance_due > 0 ? 700 : 400 }}>
                      {formatCurrency(o.balance_due)}
                    </td>
                    <td>
                      <span className="badge badge-blue">{o.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td>
                      <span className={`badge ${o.payment_status === 'PAID' ? 'badge-green' : o.payment_status === 'PARTIAL' ? 'badge-yellow' : 'badge-red'}`}>
                        {o.payment_status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/dashboard/orders/${o.id}`} className="btn btn-ghost btn-sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PAYMENTS TAB ─────────────────────────────────────────────────────────────
function PaymentsTab({ shopId }: { shopId: string }) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('payments')
        .select('*, orders!inner(customer_id, order_number)')
        .eq('orders.customer_id', shopId)
        .order('created_at', { ascending: false })
      setPayments((data ?? []) as unknown as Payment[])
      setLoading(false)
    }
    load()
  }, [shopId])

  if (loading) return <div className="spinner" style={{ margin: '3rem auto' }} />

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700 }}>Payment History</h3>
        <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--green)' }}>
          Total Paid: {formatCurrency(totalPaid)}
        </div>
      </div>
      {payments.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem' }}>
          <div className="empty-state-title">No payments recorded</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order #</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(p.payment_date)}</td>
                  <td><span className="mono">{(p as any).orders?.order_number ?? '—'}</span></td>
                  <td style={{ fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(p.amount)}</td>
                  <td><span className="badge badge-blue">{p.payment_method}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{p.reference_number ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── ACTIVITY TAB ─────────────────────────────────────────────────────────────
function ActivityTab({ shopId }: { shopId: string }) {
  const [logs,    setLogs]    = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('audit_logs')
        .select('*, user:user_profiles(full_name)')
        .eq('record_id', shopId)
        .order('created_at', { ascending: false })
        .limit(50)
      setLogs((data ?? []) as AuditLog[])
      setLoading(false)
    }
    load()
  }, [shopId])

  if (loading) return <div className="spinner" style={{ margin: '3rem auto' }} />

  return (
    <div className="card">
      <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Activity Log</h3>
      {logs.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem' }}>
          <div className="empty-state-title">No activity recorded</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{formatDateTime(log.created_at)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{(log.user as any)?.full_name ?? '—'}</td>
                  <td>
                    <span className="mono" style={{ fontSize: '0.8125rem', color: 'var(--brand-accent)' }}>
                      {log.action_type}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{log.module}</td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {log.after_data ? JSON.stringify(log.after_data).slice(0, 80) + '...' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── MAIN SHOP PROFILE PAGE ───────────────────────────────────────────────────
export default function ShopProfilePage() {
  const params = useParams()
  const router = useRouter()
  const shopId = params.id as string

  const [shop,      setShop]      = useState<Customer | null>(null)
  const [userRole,  setUserRole]  = useState<UserRole>('staff')
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [showEdit,  setShowEdit]  = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [shopRes, profileRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', shopId).single(),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return null
        const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
        return data
      }),
    ])
    if (shopRes.data) setShop(shopRes.data as Customer)
    if (profileRes) setUserRole((profileRes as any).role as UserRole)
    setLoading(false)
  }, [shopId])

  useEffect(() => { load() }, [load])

  const canManagePricing = hasPermission(userRole, 'shops:pricing:manage')

  if (loading) return (
    <div className="loading-page" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  if (!shop) return (
    <div className="page-container">
      <div className="empty-state">
        <div className="empty-state-icon">🏪</div>
        <div className="empty-state-title">Shop not found</div>
        <Link href="/dashboard/customers" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Shops
        </Link>
      </div>
    </div>
  )

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'info',     label: 'Info',        icon: '🏪' },
    { id: 'pricing',  label: 'Pricing',     icon: '🏷️' },
    { id: 'orders',   label: 'Orders',      icon: '📦' },
    { id: 'payments', label: 'Payments',    icon: '💳' },
    { id: 'activity', label: 'Activity Log', icon: '📋' },
  ]

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/dashboard/customers" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            ← Shops
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{shop.business_name}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{shop.business_name}</h1>
              <span className={`badge ${shop.is_active ? 'badge-green' : 'badge-red'}`}>
                {shop.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
              <span className="mono">{shop.customer_code}</span>
              {shop.contact_person && ` · ${shop.contact_person}`}
              {(shop.contact_number ?? shop.phone) && ` · ${shop.contact_number ?? shop.phone}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>✏️ Edit</button>
            <Link href={`/dashboard/orders/new?shop=${shopId}`} className="btn btn-primary">
              ➕ New Order
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-default)', marginBottom: '1.5rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.9375rem',
              transition: 'var(--transition)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              marginBottom: '-1px',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info'     && <InfoTab shop={shop} onEdit={() => setShowEdit(true)} />}
      {activeTab === 'pricing'  && <PricingTab shopId={shopId} canManage={canManagePricing} />}
      {activeTab === 'orders'   && <OrdersTab shopId={shopId} />}
      {activeTab === 'payments' && <PaymentsTab shopId={shopId} />}
      {activeTab === 'activity' && <ActivityTab shopId={shopId} />}

      {/* Edit Modal */}
      {showEdit && (
        // Re-use the CustomerModal from the parent page by passing to a mini-version here
        <ShopEditModal
          shop={shop}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </div>
  )
}

// ─── INLINE EDIT MODAL (reuse pattern from parent) ───────────────────────────
function ShopEditModal({
  shop,
  onClose,
  onSaved,
}: {
  shop: Customer
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    business_name:  shop.business_name,
    contact_person: shop.contact_person,
    contact_number: shop.contact_number ?? shop.phone ?? '',
    address:        shop.address        ?? '',
    tin:            shop.tin            ?? '',
    agent_name:     shop.agent_name     ?? '',
    credit_terms:   shop.credit_terms   as CreditTermsType,
    credit_limit:   shop.credit_limit?.toString() ?? '',
    notes:          shop.notes          ?? '',
    is_active:      shop.is_active,
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        business_name:  form.business_name.trim(),
        contact_person: form.contact_person.trim(),
        contact_number: form.contact_number.trim() || null,
        phone:          form.contact_number.trim() || null,
        address:        form.address.trim()        || null,
        tin:            form.tin.trim()            || null,
        agent_name:     form.agent_name.trim()     || null,
        credit_terms:   form.credit_terms,
        credit_limit:   form.credit_limit ? parseFloat(form.credit_limit) : null,
        notes:          form.notes.trim()          || null,
        is_active:      form.is_active,
        updated_by:     user?.id,
      }
      const { error: e } = await supabase.from('customers').update(payload).eq('id', shop.id)
      if (e) throw e
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action_type: 'SHOP_UPDATED',
        module: 'customers',
        record_id: shop.id,
        before_data: { ...shop },
        after_data: payload,
      })
      onSaved()
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
          <h2 className="modal-title">✏️ Edit Shop — {shop.business_name}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><span>⚠️</span><span>{error}</span></div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Shop / Business Name *</label>
              <input className="input" value={form.business_name} onChange={e => set('business_name', e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Contact Person *</label>
              <input className="input" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Contact Number</label>
              <input className="input" value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="09XX-XXX-XXXX" />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Complete Address</label>
              <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Customer TIN</label>
              <input className="input" value={form.tin} onChange={e => set('tin', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Assigned Agent</label>
              <input className="input" value={form.agent_name} onChange={e => set('agent_name', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Default Payment Term</label>
              <select className="input" value={form.credit_terms} onChange={e => set('credit_terms', e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="TERMS">Terms (60 days)</option>
                <option value="POST_DATED_CHECK">Post-Dated Check (30 days)</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Credit Limit (₱)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Status</label>
              <select className="input" value={form.is_active ? 'active' : 'inactive'} onChange={e => set('is_active', e.target.value === 'active')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Notes</label>
              <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: '80px', resize: 'vertical' }} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /><span>Saving...</span></> : <><span>💾</span><span>Update Shop</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
