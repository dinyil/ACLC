'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Customer, Product, PaymentMethod, PriceSource, PRICE_SOURCE_CONFIG } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import SearchableSelect from '@/components/SearchableSelect'

interface LineItem {
  id: string
  product_id: string
  product?: Product
  quantity: number
  unit_price: number
  discount_percent: number
  subtotal: number
  regular_price: number
  shop_price?: number
  price_source: PriceSource
  last_price?: number
  manual_reason: string
  is_manual_override: boolean
  // Raw string values for controlled number inputs (fixes 0 backspace issue)
  _qty_str: string
  _price_str: string
  _disc_str: string
}

// ─── PRICE SOURCE BADGE ───────────────────────────────────────────────────────
function PriceBadge({ source }: { source: PriceSource }) {
  const cfg = PRICE_SOURCE_CONFIG[source]
  return (
    <span
      className={`badge ${cfg.cls}`}
      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
      title={cfg.description}
    >
      {cfg.label}
    </span>
  )
}

// ─── MANUAL REASON MODAL ─────────────────────────────────────────────────────
function ManualReasonModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">✏️ Price Override Reason</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '1rem' }}>
          You are manually overriding the price. Please provide a reason.
        </p>
        <div className="input-group">
          <label className="input-label">Reason *</label>
          <input
            className="input"
            autoFocus
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Special deal, negotiated price..."
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => { if (reason.trim()) onConfirm(reason.trim()) }}
            disabled={!reason.trim()}
          >
            Confirm Override
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PRODUCT SEARCH DROPDOWN ──────────────────────────────────────────────────
function ProductSearch({
  products,
  value,
  onChange,
}: {
  products: Product[]
  value: string
  onChange: (productId: string) => void
}) {
  const [search, setSearch]   = useState('')
  const [category, setCategory] = useState('ALL')
  const [open, setOpen]       = useState(false)
  const ref                   = useRef<HTMLDivElement>(null)

  // Derive categories from product list
  const categories = Array.from(
    new Map(
      products
        .filter(p => p.category_id)
        .map(p => [p.category_id, (p as any).categories?.name ?? p.category_id])
    ).entries()
  )

  const selected = products.find(p => p.id === value)

  const filtered = products.filter(p => {
    const matchCat = category === 'ALL' || p.category_id === category
    const q = search.toLowerCase().trim()
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(id: string) {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        className="input"
        style={{
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: open ? 'var(--bg-elevated)' : undefined,
        }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ color: selected ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? `${selected.name} (${selected.sku})` : '— Select Product —'}
        </span>
        <span style={{ marginLeft: 8, flexShrink: 0, color: 'var(--text-muted)' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          padding: '0.75rem',
          minWidth: '320px',
        }}>
          {/* Search input */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <div className="input-icon-wrap" style={{ flex: 1, minWidth: '140px' }}>
              <span className="input-icon">🔍</span>
              <input
                className="input"
                autoFocus
                placeholder="Search name, SKU, brand..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '2rem' }}
              />
            </div>
            <select
              className="input"
              style={{ flex: '0 0 auto', minWidth: '120px' }}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map(([id, name]) => (
                <option key={id as string} value={id as string}>{name as string}</option>
              ))}
            </select>
          </div>

          {/* Product list */}
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No products found
              </div>
            ) : (
              filtered.map(p => (
                <div
                  key={p.id}
                  onClick={() => select(p.id)}
                  style={{
                    padding: '0.5rem 0.625rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: p.id === value ? 'var(--brand-primary)18' : undefined,
                    borderLeft: p.id === value ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (p.id !== value)(e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface)'
                  }}
                  onMouseLeave={e => {
                    if (p.id !== value)(e.currentTarget as HTMLDivElement).style.background = ''
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.sku}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {formatCurrency(p.unit_price)}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: p.stock_quantity <= p.reorder_level ? 'var(--red)' : 'var(--text-muted)',
                      fontWeight: p.stock_quantity <= p.reorder_level ? 600 : 400,
                    }}>
                      {p.stock_quantity} {(p as any).unit_of_measure ?? 'pcs'} left
                      {p.stock_quantity === 0 && ' ⚠️'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
            {filtered.length} of {products.length} products
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function NewOrderPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products,  setProducts]  = useState<Product[]>([])

  const [selectedCustomerId, setSelectedCustomerId] = useState(searchParams.get('shop') ?? '')
  const [selectedCustomer,   setSelectedCustomer]   = useState<Customer | null>(null)
  const [items,              setItems]              = useState<LineItem[]>([])
  const [paymentMethod,      setPaymentMethod]      = useState<PaymentMethod>('CASH')
  const [gcashRef,   setGcashRef]   = useState('')
  const [checkNo,    setCheckNo]    = useState('')
  const [checkDate,  setCheckDate]  = useState('')
  const [checkBank,  setCheckBank]  = useState('')
  const [notes,      setNotes]      = useState('')

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  // Manual override state
  const [pendingOverride, setPendingOverride] = useState<{ itemId: string; newPrice: number } | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [cRes, pRes] = await Promise.all([
        supabase.from('customers').select('*').eq('is_active', true).order('business_name'),
        supabase.from('products').select('*, categories(name)').eq('is_active', true).order('name'),
      ])
      setCustomers((cRes.data ?? []) as Customer[])
      setProducts((pRes.data ?? []) as Product[])
      setLoading(false)
    }
    load()
  }, [])

  // When customer changes
  useEffect(() => {
    const c = customers.find(x => x.id === selectedCustomerId) ?? null
    setSelectedCustomer(c)
    if (c) {
      if (c.credit_terms === 'POST_DATED_CHECK') setPaymentMethod('CHECK')
      else setPaymentMethod('CASH')
    }
    if (c && items.length > 0) {
      items.forEach(item => {
        if (item.product_id) resolvePrice(item.id, item.product_id, c.id)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, customers])

  // ─── PRICE RESOLUTION ──────────────────────────────────────
  const resolvePrice = useCallback(async (itemId: string, productId: string, shopId: string) => {
    if (!productId || !shopId) return
    const supabase = createClient()
    const prod     = products.find(p => p.id === productId)
    if (!prod) return

    const regularPrice = prod.unit_price

    const { data: shopPrice } = await supabase
      .from('shop_pricing')
      .select('special_price')
      .eq('shop_id', shopId)
      .eq('product_id', productId)
      .eq('is_active', true)
      .lte('effective_date', new Date().toISOString().slice(0, 10))
      .order('effective_date', { ascending: false })
      .limit(1)
      .single()

    const { data: lastOrder } = await supabase
      .from('order_items')
      .select('unit_price, orders!inner(customer_id, status)')
      .eq('product_id', productId)
      .eq('orders.customer_id', shopId)
      .neq('orders.status', 'CANCELLED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const lastPrice = (lastOrder as any)?.unit_price as number | undefined
    const finalPrice   = shopPrice?.special_price ?? regularPrice
    const priceSource: PriceSource = shopPrice ? 'SHOP_SPECIFIC' : 'REGULAR'

    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const updated: LineItem = {
        ...item,
        regular_price:       regularPrice,
        shop_price:          shopPrice?.special_price,
        unit_price:          finalPrice,
        price_source:        priceSource,
        last_price:          lastPrice,
        is_manual_override:  false,
        manual_reason:       '',
        _price_str:          finalPrice.toString(),
      }
      updated.subtotal = updated.unit_price * (1 - updated.discount_percent / 100) * updated.quantity
      return updated
    }))
  }, [products])

  const makeBlankItem = (): LineItem => ({
    id: crypto.randomUUID(),
    product_id: '',
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    subtotal: 0,
    regular_price: 0,
    price_source: 'REGULAR',
    manual_reason: '',
    is_manual_override: false,
    _qty_str: '1',
    _price_str: '0',
    _disc_str: '0',
  })

  const addLineItem = () => setItems(prev => [...prev, makeBlankItem()])
  const removeLineItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, ...patch }
      updated.subtotal = updated.unit_price * (1 - updated.discount_percent / 100) * updated.quantity
      return updated
    }))
  }

  const handleProductChange = async (itemId: string, productId: string) => {
    const prod = products.find(p => p.id === productId)
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const price = prod?.unit_price ?? 0
      return {
        ...item,
        product_id: productId,
        product: prod,
        unit_price: price,
        regular_price: price,
        price_source: 'REGULAR',
        shop_price: undefined,
        last_price: undefined,
        is_manual_override: false,
        manual_reason: '',
        subtotal: price * item.quantity,
        _price_str: price.toString(),
      }
    }))
    if (selectedCustomerId && productId) {
      await resolvePrice(itemId, productId, selectedCustomerId)
    }
  }

  const handlePriceChange = (itemId: string, newPrice: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    const resolvedPrice = item.shop_price ?? item.regular_price
    if (Math.abs(newPrice - resolvedPrice) < 0.001) {
      updateItem(itemId, {
        unit_price: newPrice,
        price_source: item.shop_price ? 'SHOP_SPECIFIC' : 'REGULAR',
        is_manual_override: false,
        manual_reason: '',
      })
      return
    }
    setPendingOverride({ itemId, newPrice })
  }

  const confirmManualOverride = (reason: string) => {
    if (!pendingOverride) return
    const { itemId, newPrice } = pendingOverride
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const updated = {
        ...item,
        unit_price:         newPrice,
        price_source:       'MANUAL' as PriceSource,
        is_manual_override: true,
        manual_reason:      reason,
      }
      updated.subtotal = updated.unit_price * (1 - updated.discount_percent / 100) * updated.quantity
      return updated
    }))
    setPendingOverride(null)
  }

  const totals = items.reduce(
    (acc, item) => {
      const regularSubtotal = item.regular_price * item.quantity
      acc.subtotal  += regularSubtotal
      acc.discount  += regularSubtotal - item.subtotal
      acc.total     += item.subtotal
      return acc
    },
    { subtotal: 0, discount: 0, total: 0 }
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCustomerId)        { setError('Please select a shop.');                      return }
    if (items.length === 0)          { setError('Add at least one product.');                  return }
    if (items.some(i => !i.product_id)) { setError('All line items must have a product.');    return }
    if (items.some(i => i.is_manual_override && !i.manual_reason.trim())) {
      setError('All manually adjusted prices require a reason.'); return
    }
    if (paymentMethod === 'GCASH' && !gcashRef.trim()) { setError('GCash Reference is required.'); return }
    if (paymentMethod === 'CHECK' && (!checkNo || !checkDate)) { setError('Check No. and Date are required.'); return }

    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const customer = customers.find(c => c.id === selectedCustomerId)

      const { data: order, error: orderError } = await supabase.from('orders').insert({
        customer_id:             selectedCustomerId,
        status:                  'DRAFT',
        payment_method:          paymentMethod,
        payment_status:          'UNPAID',
        gcash_reference:         paymentMethod === 'GCASH' ? gcashRef : null,
        check_number:            paymentMethod === 'CHECK' ? checkNo  : null,
        check_date:              paymentMethod === 'CHECK' ? checkDate : null,
        check_bank:              paymentMethod === 'CHECK' ? checkBank : null,
        subtotal:                totals.subtotal,
        discount_amount:         totals.discount,
        total_amount:            totals.total,
        amount_paid:             0,
        balance_due:             totals.total,
        notes:                   notes.trim() || null,
        payment_terms_snapshot:  paymentMethod,
        credit_terms_snapshot:   customer?.credit_terms ?? null,
        created_by:              user?.id,
      }).select().single()

      if (orderError) throw orderError

      const orderItems = items.map(item => ({
        order_id:                order.id,
        product_id:              item.product_id,
        quantity:                item.quantity,
        unit_price:              item.unit_price,
        discount_percent:        item.discount_percent,
        discount_amount:         (item.regular_price * item.quantity) - item.subtotal,
        subtotal:                item.subtotal,
        regular_price_snapshot:  item.regular_price,
        shop_price_snapshot:     item.shop_price ?? null,
        price_source:            item.price_source,
        manual_reason:           item.manual_reason || null,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) throw itemsError

      const manualItems = items.filter(i => i.is_manual_override)
      if (manualItems.length > 0) {
        await supabase.from('audit_logs').insert(
          manualItems.map(item => ({
            user_id:     user?.id,
            action_type: 'ORDER_PRICE_MANUAL_OVERRIDE',
            module:      'order_items',
            record_id:   order.id,
            before_data: { regular_price: item.regular_price, shop_price: item.shop_price },
            after_data:  { unit_price: item.unit_price, reason: item.manual_reason },
          }))
        )
      }

      await supabase.from('audit_logs').insert({
        user_id:     user?.id,
        action_type: 'ORDER_CREATED',
        module:      'orders',
        record_id:   order.id,
        after_data:  { order_number: order.order_number, customer_id: selectedCustomerId, total_amount: totals.total },
      })

      router.push(`/dashboard/orders/${order.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order.')
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner" style={{ margin: '2rem auto' }} />

  const customer = selectedCustomer

  return (
    <div className="page-container" style={{ maxWidth: '1080px' }}>
      <div className="page-header flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 className="page-title">New Order</h1>
          <p className="page-subtitle">Create a draft order for a shop</p>
        </div>
        <button className="btn btn-secondary" onClick={() => router.push('/dashboard/orders')}>Cancel</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><span>⚠️</span><span>{error}</span></div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Shop & Payment Info */}
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Shop / Customer</h2>
            <div className="input-group">
              <label className="input-label">Select Shop *</label>
              <SearchableSelect
                required
                placeholder="— Select Shop —"
                searchPlaceholder="Search shop name, code, agent..."
                value={selectedCustomerId}
                onChange={setSelectedCustomerId}
                options={customers.map(c => ({
                  value: c.id,
                  label: c.business_name,
                  sublabel: c.customer_code ?? undefined,
                  badge: c.credit_terms,
                  badgeColor: c.credit_terms === 'CASH' ? 'var(--green)' : 'var(--yellow)',
                }))}
              />
            </div>
            {customer && (
              <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Contact:</span> <span style={{ color: 'var(--text-primary)' }}>{customer.contact_person}</span>
                  {customer.contact_number && <span style={{ color: 'var(--text-muted)' }}> · {customer.contact_number}</span>}
                </div>
                {customer.address && <div style={{ color: 'var(--text-secondary)' }}>{customer.address}</div>}
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Default term:</span>{' '}
                  <span style={{ fontWeight: 600, color: 'var(--brand-accent)' }}>{customer.credit_terms}</span>
                </div>
                {customer.agent_name && (
                  <div><span style={{ color: 'var(--text-muted)' }}>Agent:</span> {customer.agent_name}</div>
                )}
                {customer.credit_limit && (
                  <div><span style={{ color: 'var(--text-muted)' }}>Credit limit:</span> {formatCurrency(customer.credit_limit)}</div>
                )}
              </div>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Payment Info</h2>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label">Payment Method *</label>
              <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                <option value="CASH">Cash</option>
                <option value="GCASH">GCash</option>
                <option value="CHECK">Check (PDC)</option>
              </select>
            </div>
            {paymentMethod === 'GCASH' && (
              <div className="input-group">
                <label className="input-label">GCash Reference No. *</label>
                <input className="input" value={gcashRef} onChange={e => setGcashRef(e.target.value)} required />
              </div>
            )}
            {paymentMethod === 'CHECK' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="input-group">
                  <label className="input-label">Check No. *</label>
                  <input className="input" value={checkNo} onChange={e => setCheckNo(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Bank</label>
                  <input className="input" value={checkBank} onChange={e => setCheckBank(e.target.value)} />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Check Date *</label>
                  <input type="date" className="input" value={checkDate} onChange={e => setCheckDate(e.target.value)} required />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Items */}
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Order Items</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLineItem}>➕ Add Item</button>
          </div>

          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">🛒</div>
              <div className="empty-state-title">No items added</div>
              <div className="empty-state-desc">Click "Add Item" to add products to this order</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((item, idx) => (
                <div key={item.id} style={{
                  background: 'var(--bg-base)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '1rem',
                }}>
                  {/* Row header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Item #{idx + 1}</span>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => removeLineItem(item.id)}>🗑️</button>
                  </div>

                  {/* Product search */}
                  <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="input-label">Product *</label>
                    <ProductSearch
                      products={products}
                      value={item.product_id}
                      onChange={id => handleProductChange(item.id, id)}
                    />
                    {/* Price info badges */}
                    {item.product_id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
                        <PriceBadge source={item.price_source} />
                        {item.shop_price !== undefined && item.shop_price !== item.regular_price && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            (Regular: {formatCurrency(item.regular_price)})
                          </span>
                        )}
                        {item.last_price !== undefined && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderLeft: '1px solid var(--border-default)', paddingLeft: '0.5rem' }}>
                            Last price: {formatCurrency(item.last_price)}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Manual override reason */}
                    {item.is_manual_override && (
                      <div style={{ marginTop: '0.375rem' }}>
                        <input
                          className="input"
                          style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
                          placeholder="Reason for price override *"
                          value={item.manual_reason}
                          onChange={e => updateItem(item.id, { manual_reason: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Qty / Price / Discount / Subtotal row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                    {/* Qty */}
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label">Qty *</label>
                      <input
                        type="number"
                        min="1"
                        className="input"
                        value={item._qty_str}
                        onChange={e => {
                          const raw = e.target.value
                          const num = parseInt(raw)
                          updateItem(item.id, {
                            _qty_str: raw,
                            quantity: isNaN(num) || num < 1 ? 1 : num,
                          })
                        }}
                        onBlur={() => {
                          if (!item._qty_str || isNaN(parseInt(item._qty_str))) {
                            updateItem(item.id, { _qty_str: '1', quantity: 1 })
                          }
                        }}
                        required
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label">Unit Price (₱)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        value={item._price_str}
                        onChange={e => {
                          const raw = e.target.value
                          updateItem(item.id, { _price_str: raw })
                        }}
                        onBlur={e => {
                          const val = parseFloat(e.target.value)
                          const price = isNaN(val) ? 0 : val
                          updateItem(item.id, { _price_str: price.toString() })
                          handlePriceChange(item.id, price)
                        }}
                        style={{
                          borderColor: item.is_manual_override
                            ? 'var(--yellow)'
                            : item.price_source === 'SHOP_SPECIFIC'
                            ? 'var(--green)'
                            : undefined,
                        }}
                        required
                      />
                    </div>

                    {/* Discount % */}
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label">Disc %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="input"
                        value={item._disc_str}
                        onChange={e => {
                          const raw = e.target.value
                          const num = parseFloat(raw)
                          updateItem(item.id, {
                            _disc_str: raw,
                            discount_percent: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)),
                          })
                        }}
                        onBlur={() => {
                          if (item._disc_str === '' || isNaN(parseFloat(item._disc_str))) {
                            updateItem(item.id, { _disc_str: '0', discount_percent: 0 })
                          }
                        }}
                      />
                    </div>

                    {/* Subtotal */}
                    <div style={{ margin: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem', fontWeight: 500 }}>Subtotal</div>
                      <div style={{
                        padding: '0.625rem 0.75rem',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: 'var(--brand-primary)',
                      }}>
                        {formatCurrency(item.subtotal)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          {items.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <div style={{ width: '100%', maxWidth: '320px', background: 'var(--bg-base)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                <div className="flex justify-between" style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  <span>Subtotal (regular)</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between" style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  <span>Discount / Savings</span>
                  <span style={{ color: totals.discount > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                    {totals.discount > 0 ? `- ${formatCurrency(totals.discount)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', fontSize: '1.25rem', fontWeight: 800 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--brand-primary)' }}>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes & Submit */}
        <div className="card">
          <div className="input-group">
            <label className="input-label">Order Notes</label>
            <textarea
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes or special instructions..."
              style={{ minHeight: '80px', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving || items.length === 0}>
            {saving ? <><div className="spinner" /><span>Creating...</span></> : '💾 Create Draft Order'}
          </button>
        </div>

      </form>

      {pendingOverride && (
        <ManualReasonModal
          onConfirm={confirmManualOverride}
          onCancel={() => setPendingOverride(null)}
        />
      )}
    </div>
  )
}
