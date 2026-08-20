'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, UserProfile } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

// ✅ FIX 3: Full Dispatch Checklist Modal
function DispatchChecklistModal({
  order,
  currentUser,
  onClose,
  onDone,
}: {
  order: Order
  currentUser: UserProfile
  onClose: () => void
  onDone: () => void
}) {
  const [items, setItems] = useState<(OrderItem & { verifiedQty: number; verified: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    async function loadItems() {
      const supabase = createClient()
      const { data } = await supabase
        .from('order_items')
        .select('*, products(name, sku, unit_of_measure)')
        .eq('order_id', order.id)
      setItems(
        (data ?? []).map(i => ({
          ...(i as unknown as OrderItem),
          verifiedQty: (i as any).quantity,
          verified: false,
        }))
      )
      setLoading(false)
    }
    loadItems()
  }, [order.id])

  const allVerified = items.length > 0 && items.every(i => i.verified)

  function toggleVerify(id: string, value: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, verified: value } : i))
  }

  function setVerifiedQty(id: string, qty: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, verifiedQty: qty } : i))
  }

  function markAll() {
    setItems(prev => prev.map(i => ({ ...i, verified: true, verifiedQty: i.quantity })))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    try {
      // 1. Create (or upsert) dispatch_checklist
      const { data: existingCl } = await supabase
        .from('dispatch_checklists')
        .select('id')
        .eq('order_id', order.id)
        .single()

      let checklistId: string
      if (existingCl) {
        checklistId = existingCl.id
        await supabase.from('dispatch_checklists').update({
          status: 'CHECKED',
          checked_by: currentUser.id,
          checked_at: new Date().toISOString(),
          notes: notes || null
        }).eq('id', checklistId)
      } else {
        const { data: cl, error: clErr } = await supabase
          .from('dispatch_checklists')
          .insert({
            order_id: order.id,
            status: 'CHECKED',
            checked_by: currentUser.id,
            checked_at: new Date().toISOString(),
            notes: notes || null
          })
          .select()
          .single()
        if (clErr) throw clErr
        checklistId = cl.id
      }

      // 2. Insert checklist items (delete first if re-doing)
      await supabase.from('dispatch_checklist_items').delete().eq('checklist_id', checklistId)
      const clItems = items.map(i => ({
        checklist_id: checklistId,
        order_item_id: i.id,
        quantity_verified: i.verifiedQty,
        is_verified: i.verified,
        notes: null
      }))
      const { error: itemsErr } = await supabase.from('dispatch_checklist_items').insert(clItems)
      if (itemsErr) throw itemsErr

      // 3. Advance order to PENDING_FINAL_APPROVAL
      await supabase.from('orders').update({ status: 'PENDING_FINAL_APPROVAL' }).eq('id', order.id)

      // 4. Audit log
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action_type: 'DISPATCH_CHECKLIST_SUBMITTED',
        module: 'dispatch',
        record_id: order.id,
        after_data: { checklist_id: checklistId, items_verified: items.length }
      })

      onDone()
      onClose()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        setError((err as any).message ?? 'Failed to submit checklist.')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to submit checklist. Check your permissions.')
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🔍 Warehouse Verification Checklist</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              Order: <strong>{order.order_number}</strong> · {(order.customers as any)?.business_name}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '0 0 1rem' }}><span>⚠️</span><span>{error}</span></div>}

        {loading ? (
          <div className="loading-page" style={{ minHeight: 200 }}><div className="spinner" /></div>
        ) : (
          <>
            {/* Instructions */}
            <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <strong>Instructions:</strong> Physically count each item in the warehouse.
              Enter the verified quantity and check the box when confirmed.
              All items must be verified before submitting.
            </div>

            {/* Mark All button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={markAll}>✅ Mark All Verified</button>
            </div>

            {/* Items checklist */}
            <div className="table-wrap" style={{ marginBottom: '1rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: 'center' }}>Expected Qty</th>
                    <th style={{ textAlign: 'center' }}>Verified Qty</th>
                    <th style={{ textAlign: 'center' }}>✓ Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const qtyMismatch = item.verifiedQty !== item.quantity
                    return (
                      <tr key={item.id} style={item.verified ? { background: 'rgba(34,197,94,0.06)' } : {}}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{(item.products as any)?.name}</div>
                          <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {(item.products as any)?.sku}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {item.quantity} {(item.products as any)?.unit_of_measure}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min={0}
                            className="input"
                            style={{
                              width: 80,
                              textAlign: 'center',
                              borderColor: qtyMismatch ? 'var(--yellow)' : undefined,
                            }}
                            value={item.verifiedQty}
                            onChange={e => setVerifiedQty(item.id, parseInt(e.target.value) || 0)}
                          />
                          {qtyMismatch && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--yellow)', marginTop: '0.2rem' }}>⚠️ Qty mismatch</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={item.verified}
                            onChange={e => toggleVerify(item.id, e.target.checked)}
                            style={{ width: 20, height: 20, cursor: 'pointer', accentColor: 'var(--green)' }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Verified count indicator */}
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                flex: 1,
                height: 8,
                background: 'var(--bg-input)',
                borderRadius: 4,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(items.filter(i => i.verified).length / Math.max(items.length, 1)) * 100}%`,
                  height: '100%',
                  background: allVerified ? 'var(--green)' : 'var(--brand-primary)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {items.filter(i => i.verified).length} / {items.length} verified
              </span>
            </div>

            {/* Notes */}
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label">Checker Notes (optional)</label>
              <textarea
                className="input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any discrepancies, damage, or special notes..."
                rows={2}
              />
            </div>

            {!allVerified && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                <span>⚠️</span>
                <span>All items must be checked before submitting. ({items.length - items.filter(i => i.verified).length} remaining)</span>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!allVerified || submitting}
              >
                {submitting
                  ? <><div className="spinner" /><span>Submitting...</span></>
                  : '✅ Submit Checklist & Send for Final Approval'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
export default function DispatchPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
      setCurrentUser(p as UserProfile)
    }

    const { data } = await supabase
      .from('orders')
      .select('*, customers(business_name)')
      .in('status', ['PENDING_DISPATCH_CHECK', 'PENDING_FINAL_APPROVAL', 'DISPATCHED', 'DELIVERED'])
      .order('updated_at', { ascending: false })

    setOrders((data ?? []) as unknown as Order[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase.channel('dispatch-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_checklists' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const approveAndDispatch = async (order: Order) => {
    if (!currentUser) return
    const supabase = createClient()
    await supabase.from('orders').update({
      status: 'DISPATCHED',
      dispatched_by: currentUser.id,
      dispatched_at: new Date().toISOString()
    }).eq('id', order.id)

    // Update dispatch checklist
    await supabase.from('dispatch_checklists').update({
      status: 'DISPATCHED',
      approved_by: currentUser.id,
      approved_at: new Date().toISOString()
    }).eq('order_id', order.id)

    await supabase.from('audit_logs').insert({
      user_id: currentUser.id,
      action_type: 'FINAL_APPROVAL_DISPATCH',
      module: 'dispatch',
      record_id: order.id,
      before_data: { status: 'PENDING_FINAL_APPROVAL' },
      after_data: { status: 'DISPATCHED' }
    })
  }

  if (loading) return (
    <div className="loading-page" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  const pendingCheck    = orders.filter(o => o.status === 'PENDING_DISPATCH_CHECK')
  const pendingApproval = orders.filter(o => o.status === 'PENDING_FINAL_APPROVAL')
  const dispatched      = orders.filter(o => o.status === 'DISPATCHED')
  const delivered       = orders.filter(o => o.status === 'DELIVERED')

  const canApprove = currentUser?.role === 'owner' || currentUser?.role === 'admin'
  const canCheck   = currentUser?.role === 'dispatch' || currentUser?.role === 'admin'

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Dispatch Board</h1>
          <p className="page-subtitle">Warehouse order verification and dispatch control · Live</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div className="stat-card" style={{ padding: '0.5rem 1rem', borderColor: 'var(--brand-primary)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To Check</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, marginLeft: '0.5rem' }}>{pendingCheck.length}</span>
          </div>
          <div className="stat-card" style={{ padding: '0.5rem 1rem', borderColor: 'var(--yellow)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Final Approval</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, marginLeft: '0.5rem', color: 'var(--yellow)' }}>{pendingApproval.length}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', alignItems: 'start' }}>

        {/* Column 1: Warehouse Check Queue */}
        <div className="card" style={{ background: 'var(--bg-surface)', padding: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>🔍 Warehouse Check Queue</span>
            <span className="badge badge-brand">{pendingCheck.length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingCheck.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-title">No orders to check</div>
              </div>
            ) : pendingCheck.map(o => (
              <div key={o.id} style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{o.order_number}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {(o.customers as any)?.business_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Updated: {formatDate(o.updated_at)}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  {canCheck ? (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ justifyContent: 'center' }}
                      onClick={() => setSelectedOrder(o)}
                    >
                      🔍 Open Checklist
                    </button>
                  ) : (
                    <Link href={`/dashboard/orders/${o.id}`} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
                      View Order
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Final Approval */}
        <div className="card" style={{ background: 'var(--bg-surface)', padding: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--yellow)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>✅ Awaiting Final Approval</span>
            <span className="badge badge-yellow">{pendingApproval.length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingApproval.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-title">No pending approvals</div>
              </div>
            ) : pendingApproval.map(o => (
              <div key={o.id} style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{o.order_number}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {(o.customers as any)?.business_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginBottom: '0.75rem' }}>
                  ✅ Warehouse check completed
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  {canApprove && (
                    <button
                      className="btn btn-success btn-sm"
                      style={{ justifyContent: 'center' }}
                      onClick={() => approveAndDispatch(o).then(load)}
                    >
                      🚚 Approve &amp; Dispatch
                    </button>
                  )}
                  <Link href={`/dashboard/orders/${o.id}`} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Recent Activity */}
        <div className="card" style={{ background: 'var(--bg-surface)', padding: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--green)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>🚚 Recently Dispatched</span>
            <span className="badge badge-green">{dispatched.length + delivered.length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[...dispatched, ...delivered].slice(0, 6).map(o => (
              <div key={o.id} style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 600 }}>{o.order_number}</div>
                  <span className={`badge ${o.status === 'DELIVERED' ? 'badge-green' : 'badge-brand'}`} style={{ fontSize: '0.7rem' }}>
                    {o.status === 'DELIVERED' ? '📦 Delivered' : '🚚 Dispatched'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {(o.customers as any)?.business_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {o.dispatched_at ? formatDate(o.dispatched_at) : '—'}
                </div>
                <Link href={`/dashboard/orders/${o.id}`} style={{ fontSize: '0.8125rem', color: 'var(--brand-primary)', marginTop: '0.5rem', display: 'inline-block' }}>
                  View →
                </Link>
              </div>
            ))}
            {dispatched.length + delivered.length === 0 && (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-title">No recent dispatches</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Checklist Modal */}
      {selectedOrder && currentUser && (
        <DispatchChecklistModal
          order={selectedOrder}
          currentUser={currentUser}
          onClose={() => setSelectedOrder(null)}
          onDone={load}
        />
      )}
    </div>
  )
}
