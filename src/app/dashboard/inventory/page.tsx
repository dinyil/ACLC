'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category } from '@/lib/types'
import { formatCurrency, formatDate, suggestSKU } from '@/lib/utils'

// ─── PRODUCT FORM MODAL ───────────────────────────────────────────────────────
function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product?: Product | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!product
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    category_id: product?.category_id ?? '',
    brand: product?.brand ?? '',
    unit_price: product?.unit_price?.toString() ?? '',
    stock_quantity: product?.stock_quantity?.toString() ?? '0',
    reorder_level: product?.reorder_level?.toString() ?? '5',
    unit_of_measure: product?.unit_of_measure ?? 'pcs',
    description: product?.description ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function handleAutoSKU() {
    if (form.brand && form.name) set('sku', suggestSKU(form.brand, form.name))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.sku.trim() || !form.unit_price) {
      setError('Name, SKU, and unit price are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        category_id: form.category_id || null,
        brand: form.brand.trim(),
        unit_price: parseFloat(form.unit_price),
        stock_quantity: parseInt(form.stock_quantity),
        reorder_level: parseInt(form.reorder_level),
        unit_of_measure: form.unit_of_measure,
        description: form.description.trim() || null,
      }

      let beforeData = null
      if (isEdit) {
        beforeData = { unit_price: product!.unit_price, stock_quantity: product!.stock_quantity }
        const { error: e } = await supabase.from('products').update(payload).eq('id', product!.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('products').insert({ ...payload, created_by: user?.id })
        if (e) throw e
      }

      // Stock movement log for initial stock on new product
      if (!isEdit && parseInt(form.stock_quantity) > 0) {
        const { data: prod } = await supabase.from('products').select('id').eq('sku', form.sku.trim().toUpperCase()).single()
        if (prod) {
          await supabase.from('stock_movements').insert({
            product_id: prod.id,
            movement_type: 'IN',
            quantity_change: parseInt(form.stock_quantity),
            quantity_before: 0,
            quantity_after: parseInt(form.stock_quantity),
            reason: 'Initial stock entry',
            created_by: user?.id,
          })
        }
      }

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action_type: isEdit ? 'UPDATE' : 'CREATE',
        module: 'products',
        record_id: product?.id,
        before_data: beforeData,
        after_data: payload,
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
          <h2 className="modal-title">{isEdit ? 'Edit Product' : 'New Product'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><span>{error}</span></div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Product Name *</label>
              <input id="prod-name" className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Honda Oil Filter 15412-KPH-901" required />
            </div>

            <div className="input-group">
              <label className="input-label">Brand</label>
              <input id="prod-brand" className="input" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. Honda, Yamaha, Motul" />
            </div>

            <div className="input-group">
              <label className="input-label">SKU *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input id="prod-sku" className="input" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="AUTO-GENERATE or type" required style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAutoSKU} title="Auto-generate SKU">Auto</button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Category</label>
              <select id="prod-category" className="input" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">— Select Category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Unit of Measure</label>
              <select id="prod-uom" className="input" value={form.unit_of_measure} onChange={e => set('unit_of_measure', e.target.value)}>
                <option value="pcs">Pieces (pcs)</option>
                <option value="liters">Liters (L)</option>
                <option value="bottles">Bottles</option>
                <option value="sets">Sets</option>
                <option value="pairs">Pairs</option>
                <option value="boxes">Boxes</option>
                <option value="rolls">Rolls</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Base Unit Price (₱) *</label>
              <input id="prod-price" className="input" type="number" min="0" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="0.00" required />
            </div>

            <div className="input-group">
              <label className="input-label">Current Stock Quantity</label>
              <input id="prod-stock" className="input" type="number" min="0" value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} />
            </div>

            <div className="input-group">
              <label className="input-label">Reorder Level (Low Stock Alert)</label>
              <input id="prod-reorder" className="input" type="number" min="0" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} />
            </div>

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Description</label>
              <textarea id="prod-desc" className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional product notes..." style={{ minHeight: '80px' }} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="prod-save" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /><span>Saving...</span></> : <span>{isEdit ? 'Update Product' : 'Add Product'}</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── STOCK ADJUST MODAL ───────────────────────────────────────────────────────
function StockAdjustModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState('')
  const [type, setType] = useState<'IN' | 'ADJUSTMENT'>('IN')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const change = parseInt(qty)
    if (!change || !reason.trim()) { setError('Quantity and reason are required.'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const newQty = product.stock_quantity + change
      if (newQty < 0) { setError('Stock cannot go below 0.'); setLoading(false); return }

      await supabase.from('products').update({ stock_quantity: newQty }).eq('id', product.id)
      await supabase.from('stock_movements').insert({
        product_id: product.id,
        movement_type: type,
        quantity_change: change,
        quantity_before: product.stock_quantity,
        quantity_after: newQty,
        reason: reason.trim(),
        created_by: user?.id,
      })
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action_type: 'STOCK_ADJUST',
        module: 'products',
        record_id: product.id,
        before_data: { stock_quantity: product.stock_quantity },
        after_data: { stock_quantity: newQty },
      })
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Adjustment failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Stock Adjustment</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{product.name}</strong><br />
          Current stock: <strong style={{ color: 'var(--brand-primary)' }}>{product.stock_quantity} {product.unit_of_measure}</strong>
        </p>
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><span>{error}</span></div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">Type</label>
            <select className="input" value={type} onChange={e => setType(e.target.value as 'IN' | 'ADJUSTMENT')}>
              <option value="IN">Stock IN (+)</option>
              <option value="ADJUSTMENT">Adjustment (can be negative)</option>
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Quantity Change {type === 'ADJUSTMENT' ? '(use negative to reduce)' : ''}</label>
            <input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder={type === 'IN' ? '+10' : '-5 or +5'} required />
          </div>
          <div className="input-group">
            <label className="input-label">Reason *</label>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Received from supplier, damage write-off..." required />
          </div>
          <div className="modal-footer" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner" /><span>Saving...</span></> : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('ALL')
  const [filterStock, setFilterStock] = useState('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, categories(*)').eq('is_active', true).order('name'),
      supabase.from('categories').select('*').eq('is_active', true).order('name'),
    ])
    setProducts((prodRes.data ?? []) as unknown as Product[])
    setCategories((catRes.data ?? []) as Category[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase.channel('inventory-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q)
    const matchCat = filterCat === 'ALL' || p.category_id === filterCat
    const isLow = p.stock_quantity <= p.reorder_level
    const isOut = p.stock_quantity === 0
    const matchStock = filterStock === 'ALL' || (filterStock === 'LOW' && isLow && !isOut) || (filterStock === 'OUT' && isOut)
    return matchSearch && matchCat && matchStock
  })

  const lowStockCount = products.filter(p => p.stock_quantity <= p.reorder_level).length

  const stockBadge = (p: Product) => {
    if (p.stock_quantity === 0) return <span className="badge badge-red">Out of Stock</span>
    if (p.stock_quantity <= p.reorder_level) return <span className="badge badge-yellow">Low Stock</span>
    return <span className="badge badge-green">In Stock</span>
  }

  if (loading) return (
    <div className="loading-page" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{products.length} products{lowStockCount > 0 && <> · <span style={{ color: 'var(--yellow)' }}>{lowStockCount} low stock</span></>}</p>
        </div>
        <button id="new-product-btn" className="btn btn-primary" onClick={() => { setEditTarget(null); setShowModal(true) }}>
          Add Product
        </button>
      </div>

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          <span><strong>{lowStockCount} product{lowStockCount !== 1 ? 's are' : ' is'} at or below reorder level.</strong> Consider restocking soon.</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setFilterStock('LOW')}>View Low Stock</button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="input-icon-wrap" style={{ flex: 1, minWidth: '200px' }}>
            <input id="inv-search" className="input" placeholder="Search by name, SKU, brand..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select id="inv-cat-filter" className="input" style={{ width: 'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select id="inv-stock-filter" className="input" style={{ width: 'auto' }} value={filterStock} onChange={e => setFilterStock(e.target.value)}>
            <option value="ALL">All Stock Levels</option>
            <option value="LOW">Low Stock</option>
            <option value="OUT">Out of Stock</option>
          </select>
          {(search || filterCat !== 'ALL' || filterStock !== 'ALL') && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterCat('ALL'); setFilterStock('ALL') }}>Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Base Price</th>
              <th>Stock</th>
              <th>Reorder At</th>
              <th>UOM</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-state-title">{search ? 'No products found' : 'No products yet'}</div>
                    <div className="empty-state-desc">{!search && 'Click "Add Product" to start building your inventory'}</div>
                  </div>
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td><span className="mono badge badge-muted">{p.sku}</span></td>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  {p.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.description.slice(0, 50)}...</div>}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {(p as unknown as { categories?: { name: string } }).categories?.name ?? '—'}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{p.brand || '—'}</td>
                <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{formatCurrency(p.unit_price)}</td>
                <td>
                  <span style={{
                    fontWeight: 700,
                    color: p.stock_quantity === 0 ? 'var(--red)' : p.stock_quantity <= p.reorder_level ? 'var(--yellow)' : 'var(--text-primary)',
                    fontSize: '1.0625rem',
                  }}>{p.stock_quantity}</span>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{p.reorder_level}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{p.unit_of_measure}</td>
                <td>{stockBadge(p)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button className="btn btn-ghost btn-sm" title="Adjust Stock" onClick={() => setAdjustTarget(p)}>Adjust</button>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => { setEditTarget(p); setShowModal(true) }}>Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ProductModal
          product={editTarget}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}

      {adjustTarget && (
        <StockAdjustModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
