'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order } from '@/lib/types'
import { formatCurrency, getDueStatus, formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function CreditMonitorPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*, customers(business_name, contact_person, contact_number)')
      .neq('payment_status', 'PAID')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })

    setOrders((data ?? []) as unknown as Order[])
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    // ✅ FIX 1: Real-time subscription so countdown + balances refresh instantly
    const ch = supabase.channel('credit-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  if (loading) return (
    <div className="loading-page" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  const aging = {
    current:    orders.filter(o => { const d = getDueStatus(o.due_date!); return d.daysRemaining >= 0 && d.daysRemaining <= 30 }),
    days31to60: orders.filter(o => { const d = getDueStatus(o.due_date!); return d.daysRemaining > 30 && d.daysRemaining <= 60 }),
    days61to90: orders.filter(o => { const d = getDueStatus(o.due_date!); return d.daysRemaining > 60 && d.daysRemaining <= 90 }),
    overdue:    orders.filter(o => getDueStatus(o.due_date!).daysRemaining < 0),
  }

  const totals = {
    current:    aging.current.reduce((a, b) => a + b.balance_due, 0),
    days31to60: aging.days31to60.reduce((a, b) => a + b.balance_due, 0),
    days61to90: aging.days61to90.reduce((a, b) => a + b.balance_due, 0),
    overdue:    aging.overdue.reduce((a, b) => a + b.balance_due, 0),
  }

  const totalExposure = Object.values(totals).reduce((a, b) => a + b, 0)

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Credit Monitor</h1>
          <p className="page-subtitle">
            Track payment due dates and overdue accounts
            <span style={{ marginLeft: '1rem', fontSize: '0.75rem', color: 'var(--green)' }}>
              ⚡ Live — updated {lastUpdated.toLocaleTimeString()}
            </span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Exposure</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-accent)' }}>{formatCurrency(totalExposure)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{orders.length} pending accounts</div>
        </div>
      </div>

      {/* Aging Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ borderColor: 'var(--green)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>🟢 Current (0–30 Days)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)', margin: '0.25rem 0' }}>{formatCurrency(totals.current)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aging.current.length} accounts</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'var(--yellow)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>🟡 31–60 Days</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--yellow)', margin: '0.25rem 0' }}>{formatCurrency(totals.days31to60)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aging.days31to60.length} accounts</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'var(--brand-primary)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>🟠 61–90 Days</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-primary)', margin: '0.25rem 0' }}>{formatCurrency(totals.days61to90)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aging.days61to90.length} accounts</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'var(--red)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--red)', fontWeight: 600 }}>🔴 OVERDUE</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--red)', margin: '0.25rem 0' }}>{formatCurrency(totals.overdue)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--red)' }}>{aging.overdue.length} accounts ❌</div>
        </div>
      </div>

      {/* Overdue Banner */}
      {aging.overdue.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <span>🚨</span>
          <span>
            <strong>{aging.overdue.length} overdue account{aging.overdue.length !== 1 ? 's' : ''}</strong> — Total overdue balance:{' '}
            <strong>{formatCurrency(totals.overdue)}</strong>. Immediate collection action required.
          </span>
        </div>
      )}

      {/* Due Today / This Week quick filters */}
      {(() => {
        const dueToday    = orders.filter(o => getDueStatus(o.due_date!).daysRemaining === 0)
        const dueThisWeek = orders.filter(o => { const d = getDueStatus(o.due_date!).daysRemaining; return d > 0 && d <= 7 })
        if (dueToday.length === 0 && dueThisWeek.length === 0) return null
        return (
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            {dueToday.length > 0 && (
              <div className="alert" style={{ flex: 1, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📅</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--red)' }}>Due Today: {dueToday.length} account{dueToday.length !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{formatCurrency(dueToday.reduce((a, b) => a + b.balance_due, 0))}</div>
                </div>
              </div>
            )}
            {dueThisWeek.length > 0 && (
              <div className="alert" style={{ flex: 1, background: 'rgba(234, 179, 8, 0.08)', border: '1px solid var(--yellow)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📆</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--yellow)' }}>Due This Week: {dueThisWeek.length} account{dueThisWeek.length !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{formatCurrency(dueThisWeek.reduce((a, b) => a + b.balance_due, 0))}</div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Full Table */}
      <div className="card">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>All Pending Receivables</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Due Date</th>
                <th>Countdown</th>
                <th>Balance Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon">✅</div>
                      <div className="empty-state-title">No pending receivables</div>
                      <div className="empty-state-desc">All accounts are paid up</div>
                    </div>
                  </td>
                </tr>
              ) : orders.map(o => {
                const st = getDueStatus(o.due_date!)
                return (
                  <tr key={o.id} style={st.status === 'overdue' ? { background: 'rgba(239,68,68,0.04)' } : st.status === 'warning' ? { background: 'rgba(234,179,8,0.04)' } : {}}>
                    <td>
                      <Link href={`/dashboard/orders/${o.id}`} style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                        {o.order_number}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 600 }}>{(o.customers as any)?.business_name}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {(o.customers as any)?.contact_person}<br />
                      {(o.customers as any)?.contact_number}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatDate(o.due_date!)}</td>
                    <td>
                      <span className={
                        st.status === 'overdue' ? 'due-badge-overdue' :
                        st.status === 'warning' ? 'due-badge-warning' :
                        'due-badge-active'
                      }>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: st.status === 'overdue' ? 'var(--red)' : 'inherit', fontSize: '1rem' }}>
                      {formatCurrency(o.balance_due)}
                    </td>
                    <td>
                      <Link href={`/dashboard/payments`} className="btn btn-secondary btn-sm">
                        Record Payment
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
