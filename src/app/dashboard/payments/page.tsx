'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Payment, Order, PaymentMethod } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'

function NewPaymentModal({ 
  orders, 
  onClose, 
  onSaved 
}: { 
  orders: Order[], 
  onClose: () => void, 
  onSaved: () => void 
}) {
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [refNo, setRefNo] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedOrder = orders.find(o => o.id === selectedOrderId)

  // Auto-fill amount when order selected
  useEffect(() => {
    if (selectedOrder) {
      setAmount(selectedOrder.balance_due.toString())
      setMethod(selectedOrder.payment_method)
      if (selectedOrder.payment_method === 'GCASH') setRefNo(selectedOrder.gcash_reference || '')
      if (selectedOrder.payment_method === 'CHECK') setRefNo(selectedOrder.check_number || '')
    }
  }, [selectedOrder])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOrderId) { setError('Select an order.'); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Amount must be greater than 0.'); return }
    if (amt > (selectedOrder?.balance_due || 0)) { setError('Payment cannot exceed balance due.'); return }
    if (method === 'GCASH' && !refNo.trim()) { setError('GCash Reference is required.'); return }
    if (method === 'CHECK' && !refNo.trim()) { setError('Check Number is required.'); return }

    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        order_id: selectedOrderId,
        amount: amt,
        payment_method: method,
        payment_date: date,
        reference_number: refNo.trim() || null,
        notes: notes.trim() || null,
        recorded_by: user?.id
      }

      const { error: pError } = await supabase.from('payments').insert(payload)
      if (pError) throw pError

      // Update Order balance and status
      const newAmountPaid = (selectedOrder?.amount_paid || 0) + amt
      const newBalanceDue = (selectedOrder?.total_amount || 0) - newAmountPaid
      const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIAL'

      await supabase.from('orders').update({
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue,
        payment_status: newStatus
      }).eq('id', selectedOrderId)

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action_type: 'RECORD_PAYMENT',
        module: 'payments',
        record_id: selectedOrderId,
        after_data: payload
      })

      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">💰 Record Payment</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><span>⚠️</span><span>{error}</span></div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">Select Order *</label>
            <SearchableSelect
              required
              placeholder="— Select Pending Order —"
              searchPlaceholder="Search by order no. or shop name..."
              value={selectedOrderId}
              onChange={setSelectedOrderId}
              options={orders.map(o => ({
                value: o.id,
                label: `${o.order_number} · ${(o.customers as any)?.business_name ?? '—'}`,
                sublabel: `Balance due: ${formatCurrency(o.balance_due)}`,
                badge: formatCurrency(o.balance_due),
                badgeColor: 'var(--red)',
              }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
             <div className="input-group">
               <label className="input-label">Amount (₱) *</label>
               <input type="number" step="0.01" min="0.01" max={selectedOrder?.balance_due || ''} className="input" value={amount} onChange={e => setAmount(e.target.value)} required />
             </div>
             <div className="input-group">
               <label className="input-label">Date *</label>
               <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
             </div>
          </div>

          <div className="input-group">
             <label className="input-label">Payment Method *</label>
             <select className="input" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
                <option value="CASH">Cash</option>
                <option value="GCASH">GCash</option>
                <option value="CHECK">Check</option>
             </select>
          </div>

          {method !== 'CASH' && (
             <div className="input-group">
                <label className="input-label">{method === 'GCASH' ? 'Reference Number' : 'Check Number'} *</label>
                <input className="input" value={refNo} onChange={e => setRefNo(e.target.value)} required />
             </div>
          )}

          <div className="input-group">
             <label className="input-label">Notes</label>
             <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional reference notes..." />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !selectedOrderId}>
              {loading ? <><div className="spinner" /><span>Saving...</span></> : '💾 Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [payRes, ordRes] = await Promise.all([
      supabase.from('payments').select('*, orders(order_number, customers(business_name)), user_profiles!payments_recorded_by_fkey(full_name)').order('created_at', { ascending: false }),
      supabase.from('orders').select('*, customers(business_name)').neq('payment_status', 'PAID').in('status', ['DISPATCHED', 'DELIVERED', 'CLOSED']).order('created_at')
    ])
    setPayments((payRes.data ?? []) as unknown as Payment[])
    setPendingOrders((ordRes.data ?? []) as unknown as Order[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase.channel('payments-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const filtered = payments.filter(p => {
    const q = search.toLowerCase()
    return !q || (p.orders as any)?.order_number.toLowerCase().includes(q) || (p.orders as any)?.customers?.business_name.toLowerCase().includes(q) || (p.reference_number || '').toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="loading-page" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track and record customer payments</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          ➕ Record Payment
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div className="input-icon-wrap" style={{ maxWidth: '400px' }}>
          <span className="input-icon">🔍</span>
          <input className="input" placeholder="Search by order, customer, or ref no..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order #</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Ref No.</th>
                <th>Amount</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon">💳</div>
                      <div className="empty-state-title">{search ? 'No payments found' : 'No payments recorded'}</div>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(p.payment_date)}</td>
                  <td>
                    <Link href={`/dashboard/orders/${p.order_id}`} style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                      {(p.orders as any)?.order_number}
                    </Link>
                  </td>
                  <td style={{ fontWeight: 600 }}>{(p.orders as any)?.customers?.business_name}</td>
                  <td>
                     <span className={`badge ${p.payment_method === 'CASH' ? 'badge-green' : p.payment_method === 'GCASH' ? 'badge-blue' : 'badge-yellow'}`}>
                        {p.payment_method}
                     </span>
                  </td>
                  <td className="mono" style={{ fontSize: '0.8125rem' }}>{p.reference_number || '—'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--green)' }}>{formatCurrency(p.amount)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{(p as any).user_profiles?.full_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <NewPaymentModal orders={pendingOrders} onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </div>
  )
}
