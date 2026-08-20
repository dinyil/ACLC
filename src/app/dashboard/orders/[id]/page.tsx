'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Order, OrderItem, UserProfile } from '@/lib/types'
import { formatCurrency, formatDate, ORDER_STATUS_CONFIG, getDueStatus, PAYMENT_STATUS_CONFIG } from '@/lib/utils'
import Link from 'next/link'

// ── Modal key type lives OUTSIDE the component to prevent re-declaration issues
type ModalKey =
  | 'submit_approval' | 'approve_quotation' | 'reject_draft' | 'send_dispatch'
  | 'dispatch_info'   | 'mark_checked'      | 'approve_dispatch' | 'mark_delivered'
  | 'close_order'     | 'cancel_order'      | 'admin_unlock'

// ─── CONFIRMATION MODAL ───────────────────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmCls = 'btn-primary',
  icon,
  onConfirm,
  onCancel,
  loading,
  extra,
  error,
}: {
  title: string
  message: string
  confirmLabel: string
  confirmCls?: string
  icon?: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
  extra?: React.ReactNode
  error?: string | null
}) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !loading && onCancel()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {icon && <span style={{ marginRight: '0.5rem' }}>{icon}</span>}
            {title}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onCancel} disabled={loading}>✕</button>
        </div>
        <div style={{ padding: '0 1.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
          {message}
          {extra && <div style={{ marginTop: '1rem' }}>{extra}</div>}
          {error && (
            <div style={{
              marginTop: '1rem', padding: '0.75rem', background: 'var(--red-bg)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)',
              color: 'var(--red)', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start'
            }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={`btn ${confirmCls}`} onClick={onConfirm} disabled={loading}>
            {loading ? <><div className="spinner" /><span>Processing...</span></> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── INFO / REDIRECT MODAL ───────────────────────────────────────────────────
function InfoModal({
  title,
  icon,
  children,
  onClose,
  actions,
}: {
  title: string
  icon?: string
  children: React.ReactNode
  onClose: () => void
  actions?: React.ReactNode
}) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {icon && <span style={{ marginRight: '0.5rem' }}>{icon}</span>}
            {title}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '0 1.5rem 1rem' }}>
          {children}
        </div>
        {actions && <div className="modal-footer">{actions}</div>}
      </div>
    </div>
  )
}

// ─── DETAIL ROW HELPER ────────────────────────────────────────────────────────
function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [order, setOrder]               = useState<Order | null>(null)
  const [items, setItems]               = useState<OrderItem[]>([])
  const [currentUser, setCurrentUser]   = useState<UserProfile | null>(null)
  const [loading, setLoading]           = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError]   = useState<string | null>(null)
  const [activeModal, setActiveModal]   = useState<ModalKey | null>(null)

  const show = (m: ModalKey) => { setActiveModal(m); setActionError(null) }
  const hide = () => { setActiveModal(null); setActionError(null) }

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
      setCurrentUser(p as UserProfile)
    }
    const { data: o } = await supabase
      .from('orders')
      .select('*, customers(*), user_profiles!orders_created_by_fkey(full_name)')
      .eq('id', id)
      .single()
    if (o) {
      setOrder(o as unknown as Order)
      const { data: i } = await supabase.from('order_items').select('*, products(*)').eq('order_id', id)
      setItems((i ?? []) as unknown as OrderItem[])
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  // ─── STATUS UPDATE ────────────────────────────────────────────
  const updateStatus = async (newStatus: Order['status'], afterRedirect?: string) => {
    if (!order || !currentUser) {
      setActionError('Session error: please refresh the page and try again.')
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      const supabase = createClient()
      const updates: Partial<Order> = { status: newStatus }
      if (newStatus === 'DISPATCHED') {
        updates.dispatched_by = currentUser.id
        updates.dispatched_at = new Date().toISOString()
      }
      const { error: updateErr } = await supabase
        .from('orders').update(updates).eq('id', order.id)
      if (updateErr) throw new Error(updateErr.message)

      // Audit log — non-blocking (ignore error)
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id, action_type: 'STATUS_CHANGE',
        module: 'orders', record_id: order.id,
        before_data: { status: order.status }, after_data: { status: newStatus },
      })
      hide()
      if (afterRedirect) router.push(afterRedirect)
      else await load()
    } catch (e: any) {
      setActionError(e?.message ?? 'Update failed. Check your permissions.')
    } finally {
      setActionLoading(false)
    }
  }

  // ─── GENERATE QUOTATION ───────────────────────────────────────
  const generateQuotation = async () => {
    if (!order || !currentUser) {
      setActionError('Session error: please refresh the page and try again.')
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      const supabase = createClient()
      const { data: existingQuots } = await supabase
        .from('quotations').select('version_number').eq('order_id', order.id)
      const nextVer = existingQuots && existingQuots.length > 0
        ? Math.max(...existingQuots.map((q: any) => q.version_number)) + 1 : 1

      const { data: q, error: qErr } = await supabase.from('quotations').insert({
        order_id: order.id, version_number: nextVer, version_label: `v${nextVer}`,
        status: 'DRAFT', created_by: currentUser.id,
      }).select('id').single()

      if (qErr) throw new Error(qErr.message)
      if (!q?.id) throw new Error('Quotation was created but returned no ID. Check RLS policies.')

      const { error: orderErr } = await supabase
        .from('orders').update({ status: 'QUOTATION_GENERATED' }).eq('id', order.id)
      if (orderErr) throw new Error(orderErr.message)

      await supabase.from('audit_logs').insert({
        user_id: currentUser.id, action_type: 'GENERATE_QUOTATION',
        module: 'orders', record_id: order.id,
        after_data: { quotation_id: q.id, version: nextVer },
      })
      hide()
      router.push(`/dashboard/quotations/${q.id}`)
    } catch (e: any) {
      setActionError(e?.message ?? 'Failed to generate quotation.')
    } finally {
      setActionLoading(false)
    }
  }

  // ─── ADMIN UNLOCK ─────────────────────────────────────────────
  const adminUnlock = async () => {
    if (!order || !currentUser) {
      setActionError('Session error: please refresh the page and try again.')
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      const supabase = createClient()
      const { error: unlockErr } = await supabase
        .from('orders').update({ status: 'DRAFT' }).eq('id', order.id)
      if (unlockErr) throw new Error(unlockErr.message)

      await supabase.from('audit_logs').insert({
        user_id: currentUser.id, action_type: 'ADMIN_OVERRIDE_UNLOCK',
        module: 'orders', record_id: order.id,
        before_data: { status: order.status },
        after_data: { status: 'DRAFT', override_by: currentUser.id },
      })
      hide()
      await load()
    } catch (e: any) {
      setActionError(e?.message ?? 'Admin unlock failed.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="spinner" style={{ margin: '2rem auto' }} />
  if (!order) return <div className="page-container"><div className="empty-state"><div className="empty-state-title">Order not found</div></div></div>

  const st    = ORDER_STATUS_CONFIG[order.status]
  const paySt = PAYMENT_STATUS_CONFIG[order.payment_status]
  const cust  = (order as any).customers
  const role  = currentUser?.role

  // Reusable order summary to show inside info modals
  const orderSummary = (
    <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1rem' }}>
      <DetailRow label="Order" value={order.order_number} color="var(--brand-primary)" />
      <DetailRow label="Shop" value={cust?.business_name ?? '—'} />
      <DetailRow label="Total" value={formatCurrency(order.total_amount)} color="var(--brand-accent)" />
      <DetailRow label="Items" value={`${items.length} product${items.length !== 1 ? 's' : ''}`} />
    </div>
  )

  return (
    <div className="page-container" style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div className="page-header flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 className="page-title">Order {order.order_number}</h1>
          <p className="page-subtitle">Created on {formatDate(order.created_at)} by {(order as any).user_profiles?.full_name}</p>
        </div>
        <span className={`badge ${st.cls}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
          {st.icon} {st.label}
        </span>
      </div>

      {/* ─── Workflow Actions ─── */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-surface)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Workflow Actions</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>

          {/* DRAFT → submit for approval */}
          {order.status === 'DRAFT' && (
            <button className="btn btn-primary" onClick={() => show('submit_approval')} disabled={actionLoading}>
              ➡️ Submit for Owner Approval
            </button>
          )}

          {/* PENDING_OWNER_APPROVAL → approve or reject */}
          {order.status === 'PENDING_OWNER_APPROVAL' && (role === 'owner' || role === 'admin') && (
            <>
              <button className="btn btn-success" onClick={() => show('approve_quotation')} disabled={actionLoading}>
                ✅ Approve &amp; Generate Quotation
              </button>
              <button className="btn btn-danger" onClick={() => show('reject_draft')} disabled={actionLoading}>
                ❌ Reject (Back to Draft)
              </button>
            </>
          )}

          {/* QUOTATION_GENERATED → send to dispatch */}
          {order.status === 'QUOTATION_GENERATED' && (
            <button className="btn btn-primary" onClick={() => show('send_dispatch')} disabled={actionLoading}>
              🚛 Send to Dispatch Check
            </button>
          )}

          {/* PENDING_DISPATCH_CHECK — show info modal with redirect option */}
          {order.status === 'PENDING_DISPATCH_CHECK' && (
            <button className="btn btn-secondary" onClick={() => show('dispatch_info')} disabled={actionLoading}>
              📋 View Dispatch Details
            </button>
          )}

          {/* PENDING_DISPATCH_CHECK → mark checked (dispatch role) */}
          {order.status === 'PENDING_DISPATCH_CHECK' && (role === 'dispatch' || role === 'admin') && (
            <button className="btn btn-primary" onClick={() => show('mark_checked')} disabled={actionLoading}>
              🔍 Mark as Checked
            </button>
          )}

          {/* PENDING_FINAL_APPROVAL → approve & dispatch */}
          {order.status === 'PENDING_FINAL_APPROVAL' && (role === 'owner' || role === 'admin') && (
            <button className="btn btn-success" onClick={() => show('approve_dispatch')} disabled={actionLoading}>
              🚚 Approve &amp; Dispatch
            </button>
          )}

          {/* DISPATCHED → mark delivered */}
          {order.status === 'DISPATCHED' && (
            <button className="btn btn-success" onClick={() => show('mark_delivered')} disabled={actionLoading}>
              📦 Mark as Delivered
            </button>
          )}

          {/* DELIVERED → close */}
          {order.status === 'DELIVERED' && (
            <button className="btn btn-secondary" onClick={() => show('close_order')} disabled={actionLoading}>
              🔒 Close Order
            </button>
          )}

          {/* DRAFT → cancel */}
          {order.status === 'DRAFT' && (
            <button className="btn btn-danger" onClick={() => show('cancel_order')} disabled={actionLoading}>
              🚫 Cancel Order
            </button>
          )}

          {/* Admin Override */}
          {role === 'admin' && order.status !== 'DRAFT' && order.status !== 'CANCELLED' && (
            <button
              className="btn btn-danger"
              style={{ marginLeft: 'auto', borderStyle: 'dashed', opacity: 0.85 }}
              onClick={() => show('admin_unlock')}
              disabled={actionLoading}
              title="Admin only: Force-unlock this order back to DRAFT"
            >
              🔓 Admin Override — Unlock Order
            </button>
          )}
        </div>
      </div>

      {/* Customer + Payment Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Customer */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Customer</h2>
          <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--brand-primary)' }}>{cust?.business_name}</div>
            <div><strong>Contact:</strong> {cust?.contact_person} {cust?.contact_number && `(${cust.contact_number})`}</div>
            {cust?.address && <div style={{ color: 'var(--text-secondary)' }}>{cust.address}</div>}
            <div style={{ marginTop: '0.25rem' }}>
              <span className="badge badge-muted">Terms: {cust?.credit_terms}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Payment</h2>
          <div style={{ fontSize: '0.875rem' }}>
            <div className="flex justify-between" style={{ marginBottom: '0.5rem' }}>
              <span>Method:</span><strong>{order.payment_method}</strong>
            </div>
            <div className="flex justify-between" style={{ marginBottom: '0.5rem' }}>
              <span>Status:</span><span className={paySt.cls}>{paySt.label}</span>
            </div>
            {order.payment_method === 'GCASH' && (
              <div className="flex justify-between" style={{ marginBottom: '0.5rem' }}>
                <span>Ref No:</span><span className="mono">{order.gcash_reference}</span>
              </div>
            )}
            {order.payment_method === 'CHECK' && (
              <>
                <div className="flex justify-between" style={{ marginBottom: '0.5rem' }}>
                  <span>Check No:</span><span className="mono">{order.check_number}</span>
                </div>
                <div className="flex justify-between" style={{ marginBottom: '0.5rem' }}>
                  <span>Check Date:</span><span>{order.check_date ? formatDate(order.check_date) : '—'}</span>
                </div>
              </>
            )}
            {order.due_date && (
              <div className="flex justify-between" style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span>Due Date:</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{formatDate(order.due_date)}</div>
                  {order.payment_status !== 'PAID' && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: `var(--${getDueStatus(order.due_date).status === 'overdue' ? 'red' : getDueStatus(order.due_date).status === 'warning' ? 'yellow' : 'green'})` }}>
                      {getDueStatus(order.due_date).label}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Items</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Disc %</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{(item.products as any)?.name}</div>
                    <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(item.products as any)?.sku}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                  <td style={{ textAlign: 'right' }}>{item.discount_percent > 0 ? `${item.discount_percent}%` : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <div style={{ width: '300px', maxWidth: '100%' }}>
            <div className="flex justify-between" style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between" style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              <span>Discount</span><span style={{ color: 'var(--red)' }}>- {formatCurrency(order.discount_amount)}</span>
            </div>
            <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', fontSize: '1.25rem', fontWeight: 800 }}>
              <span>Total</span><span style={{ color: 'var(--brand-primary)' }}>{formatCurrency(order.total_amount)}</span>
            </div>
            <div className="flex justify-between" style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              <span>Amount Paid</span><span style={{ color: 'var(--green)' }}>{formatCurrency(order.amount_paid)}</span>
            </div>
            <div className="flex justify-between" style={{ marginTop: '0.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              <span>Balance Due</span>
              <span style={{ color: order.balance_due > 0 ? 'var(--red)' : 'var(--green)' }}>{formatCurrency(order.balance_due)}</span>
            </div>
          </div>
        </div>
      </div>

      {order.notes && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Notes</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{order.notes}</p>
        </div>
      )}

      {/* ══════════════ CONFIRMATION MODALS ══════════════ */}

      {/* Submit for approval */}
      {activeModal === 'submit_approval' && (
        <ConfirmModal
          icon="➡️" title="Submit for Owner Approval"
          message={`This will send order ${order.order_number} to the owner for review. You won't be able to edit it until reviewed.`}
          confirmLabel="Submit" confirmCls="btn-primary"
          loading={actionLoading}
          error={actionError}
          extra={orderSummary}
          onConfirm={() => updateStatus('PENDING_OWNER_APPROVAL')}
          onCancel={hide}
        />
      )}

      {/* Approve & Generate Quotation */}
      {activeModal === 'approve_quotation' && (
        <ConfirmModal
          icon="✅" title="Approve & Generate Quotation"
          message="This will approve the order and generate a quotation document. You'll be redirected to the quotation page."
          confirmLabel="Approve & Generate" confirmCls="btn-success"
          loading={actionLoading}
          error={actionError}
          extra={orderSummary}
          onConfirm={generateQuotation}
          onCancel={hide}
        />
      )}

      {/* Reject back to draft */}
      {activeModal === 'reject_draft' && (
        <ConfirmModal
          icon="❌" title="Reject — Return to Draft"
          message={`Order ${order.order_number} will be returned to DRAFT status. The sales staff will need to review and resubmit.`}
          confirmLabel="Reject & Return to Draft" confirmCls="btn-danger"
          loading={actionLoading}
          error={actionError}
          onConfirm={() => updateStatus('DRAFT')}
          onCancel={hide}
        />
      )}

      {/* Send to Dispatch Check */}
      {activeModal === 'send_dispatch' && (
        <ConfirmModal
          icon="🚛" title="Send to Dispatch Check"
          message="This will send the order to the Dispatch team for item verification. The dispatch checker will verify quantities before final approval."
          confirmLabel="Send to Dispatch" confirmCls="btn-primary"
          loading={actionLoading}
          error={actionError}
          extra={orderSummary}
          onConfirm={() => updateStatus('PENDING_DISPATCH_CHECK')}
          onCancel={hide}
        />
      )}

      {/* Dispatch Info Modal — with redirect button */}
      {activeModal === 'dispatch_info' && (
        <InfoModal
          icon="📋" title="Order Pending Dispatch Check"
          onClose={hide}
          actions={
            <>
              <button className="btn btn-secondary" onClick={hide}>Close</button>
              <button
                className="btn btn-primary"
                onClick={() => router.push('/dashboard/dispatch')}
              >
                🚛 Go to Dispatch Page
              </button>
            </>
          }
        >
          {orderSummary}
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
            This order is currently waiting for dispatch verification. A dispatch checker must confirm all items and quantities before it can proceed to final approval.
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(37,99,235,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(37,99,235,0.2)', fontSize: '0.875rem' }}>
            <strong style={{ color: 'var(--brand-accent)' }}>Tip:</strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>Go to the Dispatch page to check items and mark this order as verified.</span>
          </div>
        </InfoModal>
      )}

      {/* Mark as Checked (Dispatch role) */}
      {activeModal === 'mark_checked' && (
        <ConfirmModal
          icon="🔍" title="Mark as Checked"
          message="Confirm that all items and quantities for this order have been physically verified. This will send the order for Final Approval."
          confirmLabel="Mark as Checked" confirmCls="btn-primary"
          loading={actionLoading}
          error={actionError}
          extra={orderSummary}
          onConfirm={() => updateStatus('PENDING_FINAL_APPROVAL')}
          onCancel={hide}
        />
      )}

      {/* Approve & Dispatch */}
      {activeModal === 'approve_dispatch' && (
        <ConfirmModal
          icon="🚚" title="Approve & Dispatch"
          message={`This will mark order ${order.order_number} as DISPATCHED. Items will be released and sent to the customer. This cannot be undone without admin override.`}
          confirmLabel="Approve & Dispatch" confirmCls="btn-success"
          loading={actionLoading}
          error={actionError}
          extra={orderSummary}
          onConfirm={() => updateStatus('DISPATCHED')}
          onCancel={hide}
        />
      )}

      {/* Mark as Delivered */}
      {activeModal === 'mark_delivered' && (
        <ConfirmModal
          icon="📦" title="Mark as Delivered"
          message={`Confirm that order ${order.order_number} has been successfully delivered to ${cust?.business_name ?? 'the customer'}. This will update the order status to DELIVERED.`}
          confirmLabel="Confirm Delivery" confirmCls="btn-success"
          loading={actionLoading}
          error={actionError}
          extra={orderSummary}
          onConfirm={() => updateStatus('DELIVERED')}
          onCancel={hide}
        />
      )}

      {/* Close Order */}
      {activeModal === 'close_order' && (
        <ConfirmModal
          icon="🔒" title="Close Order"
          message="Closing this order marks it as fully completed. No further changes can be made unless an admin unlocks it."
          confirmLabel="Close Order" confirmCls="btn-secondary"
          loading={actionLoading}
          error={actionError}
          extra={
            order.balance_due > 0 ? (
              <div style={{ padding: '0.75rem', background: 'var(--yellow-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(234,179,8,0.3)', fontSize: '0.875rem', color: 'var(--yellow)' }}>
                ⚠️ This order still has an outstanding balance of <strong>{formatCurrency(order.balance_due)}</strong>. Make sure payment is recorded before closing.
              </div>
            ) : orderSummary
          }
          onConfirm={() => updateStatus('CLOSED')}
          onCancel={hide}
        />
      )}

      {/* Cancel Order */}
      {activeModal === 'cancel_order' && (
        <ConfirmModal
          icon="🚫" title="Cancel Order"
          message={`Are you sure you want to cancel order ${order.order_number}? This action cannot be undone unless an admin unlocks it.`}
          confirmLabel="Yes, Cancel Order" confirmCls="btn-danger"
          loading={actionLoading}
          error={actionError}
          onConfirm={() => updateStatus('CANCELLED')}
          onCancel={hide}
        />
      )}

      {/* Admin Override Unlock */}
      {activeModal === 'admin_unlock' && (
        <ConfirmModal
          icon="🔓" title="Admin Override — Unlock Order"
          message={`This will force-reset order ${order.order_number} back to DRAFT status. The action will be permanently recorded in the audit log.`}
          confirmLabel="Unlock to Draft" confirmCls="btn-danger"
          loading={actionLoading}
          error={actionError}
          extra={
            <div style={{ padding: '0.75rem', background: 'var(--red-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.875rem', color: 'var(--red)' }}>
              ⚠️ Admin override. Current status: <strong>{order.status.replace(/_/g, ' ')}</strong>. This will be logged.
            </div>
          }
          onConfirm={adminUnlock}
          onCancel={hide}
        />
      )}
    </div>
  )
}
