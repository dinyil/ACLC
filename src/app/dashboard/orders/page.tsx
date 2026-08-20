'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order } from '@/lib/types'
import { formatCurrency, formatDate, ORDER_STATUS_CONFIG } from '@/lib/utils'
import Link from 'next/link'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*, customers(business_name), user_profiles!orders_created_by_fkey(full_name)')
      .order('created_at', { ascending: false })
    setOrders((data ?? []) as unknown as Order[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase.channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const custName = ((o.customers as any)?.business_name ?? '').toLowerCase()
    const matchSearch = !q || o.order_number.toLowerCase().includes(q) || custName.includes(q)
    const matchStatus = filterStatus === 'ALL' || o.status === filterStatus
    return matchSearch && matchStatus
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
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Manage customer orders and workflow</p>
        </div>
        <Link href="/dashboard/orders/new" className="btn btn-primary">
          New Order
        </Link>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input className="input" placeholder="Search order number or customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="ALL">All Statuses</option>
            {Object.entries(ORDER_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {(search || filterStatus !== 'ALL') && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterStatus('ALL') }}>Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Total Amount</th>
              <th>Balance Due</th>
              <th>Status</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-title">{search ? 'No orders found' : 'No orders yet'}</div>
                    <div className="empty-state-desc">{!search && 'Click "New Order" to create one'}</div>
                  </div>
                </td>
              </tr>
            ) : filtered.map(o => {
              const st = ORDER_STATUS_CONFIG[o.status]
              return (
                <tr key={o.id}>
                  <td><Link href={`/dashboard/orders/${o.id}`} style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{o.order_number}</Link></td>
                  <td style={{ fontWeight: 600 }}>{(o.customers as any)?.business_name ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(o.created_at)}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(o.total_amount)}</td>
                  <td style={{ color: o.balance_due > 0 ? 'var(--red)' : 'var(--green)' }}>{formatCurrency(o.balance_due)}</td>
                  <td>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{(o as any).user_profiles?.full_name ?? '—'}</td>
                  <td>
                    <Link href={`/dashboard/orders/${o.id}`} className="btn btn-secondary btn-sm">
                      View
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
