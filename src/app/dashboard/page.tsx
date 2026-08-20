'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardStats, PaymentDueItem } from '@/lib/types'
import { differenceInDays, format } from 'date-fns'

// Minimal SVG icon
function Icon({ d, size = 16, color }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color ?? 'currentColor'} strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const STAT_ICONS = {
  orders:    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 M9 5a2 2 0 012-2h2a2 2 0 012 2',
  pending:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  revenue:   'M12 2v20 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  overdue:   'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  stock:     'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  customers: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8',
}

function StatCard({ icon, label, value, sub, color }: {
  icon: keyof typeof STAT_ICONS
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${color ?? 'var(--brand-primary)'}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon d={STAT_ICONS[icon]} size={16} color={color ?? 'var(--brand-primary)'} />
        </div>
        {sub && <span className="badge badge-muted">{sub}</span>}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: color ?? 'var(--text-primary)', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function DueBadge({ days }: { days: number }) {
  if (days < 0)  return <span className="due-badge-overdue">Overdue {Math.abs(days)}d</span>
  if (days <= 3) return <span className="due-badge-warning">Due in {days}d</span>
  return <span className="due-badge-active">{days}d left</span>
}

function getStatusLabel(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT:                   { label: 'Draft',           cls: 'status-draft' },
    PENDING_OWNER_APPROVAL:  { label: 'Pending Approval',cls: 'status-pending-approval' },
    QUOTATION_GENERATED:     { label: 'Quotation',       cls: 'status-quotation' },
    PENDING_DISPATCH_CHECK:  { label: 'Dispatch Check',  cls: 'status-dispatch-check' },
    PENDING_FINAL_APPROVAL:  { label: 'Final Approval',  cls: 'status-final-approval' },
    DISPATCHED:              { label: 'Dispatched',      cls: 'status-dispatched' },
    DELIVERED:               { label: 'Delivered',       cls: 'status-delivered' },
    CLOSED:                  { label: 'Closed',          cls: 'status-closed' },
    CANCELLED:               { label: 'Cancelled',       cls: 'status-cancelled' },
  }
  return map[status] ?? { label: status, cls: 'status-draft' }
}

export default function DashboardPage() {
  const [stats, setStats]             = useState<DashboardStats | null>(null)
  const [dueItems, setDueItems]       = useState<PaymentDueItem[]>([])
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)

  const loadDashboard = useCallback(async () => {
    const supabase = createClient()
    const today    = new Date()

    const [ordersRes, paymentsRes, inventoryRes, customersRes] = await Promise.all([
      supabase.from('orders').select('id, status, total_amount, balance_due, due_date, order_number, created_at, customers(business_name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('orders').select('id, balance_due, due_date, order_number, customers(business_name), total_amount').not('due_date', 'is', null).neq('payment_status', 'PAID').order('due_date'),
      supabase.from('products').select('id, stock_quantity, reorder_level').lt('stock_quantity', 10),
      supabase.from('customers').select('id, is_active').eq('is_active', true),
    ])

    const orders       = ordersRes.data ?? []
    const unpaidOrders = paymentsRes.data ?? []
    const totalRevenue = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const pending      = orders.filter(o => ['DRAFT','PENDING_OWNER_APPROVAL','QUOTATION_GENERATED','PENDING_DISPATCH_CHECK','PENDING_FINAL_APPROVAL'].includes(o.status))
    const overdue      = unpaidOrders.filter(o => o.due_date && differenceInDays(new Date(o.due_date), today) < 0)

    setStats({
      totalOrders:      orders.length,
      pendingOrders:    pending.length,
      totalRevenue,
      overduePayments:  overdue.length,
      lowStockItems:    inventoryRes.data?.length ?? 0,
      activeCustomers:  customersRes.data?.length ?? 0,
    })

    const dueList: PaymentDueItem[] = unpaidOrders.map(o => {
      const days = differenceInDays(new Date(o.due_date!), today)
      return {
        order_id:      o.id,
        order_number:  o.order_number,
        customer_name: (o.customers as any)?.business_name ?? '—',
        total_amount:  o.total_amount,
        balance_due:   o.balance_due,
        due_date:      o.due_date!,
        days_remaining: days,
        status: days < 0 ? 'overdue' : days <= 3 ? 'warning' : 'active',
      }
    })
    setDueItems(dueList.slice(0, 8))
    setRecentOrders(orders.slice(0, 6))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDashboard()
    const supabase = createClient()
    const channel  = supabase.channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },   () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadDashboard())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadDashboard])

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  if (loading) return (
    <div className="loading-page" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  )

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--green)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
          Live
        </div>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <StatCard icon="orders"    label="Total Orders"      value={stats?.totalOrders ?? 0} />
        <StatCard icon="pending"   label="Pending Orders"    value={stats?.pendingOrders ?? 0}    color="var(--yellow)" />
        <StatCard icon="revenue"   label="Total Revenue"     value={fmt(stats?.totalRevenue ?? 0)} color="var(--green)" />
        <StatCard icon="overdue"   label="Overdue Payments"  value={stats?.overduePayments ?? 0}  color="var(--red)" />
        <StatCard icon="stock"     label="Low Stock Items"   value={stats?.lowStockItems ?? 0}    color="var(--yellow)" sub="Alert" />
        <StatCard icon="customers" label="Active Customers"  value={stats?.activeCustomers ?? 0}  color="var(--blue)" />
      </div>

      {/* Two-column panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Payment Due */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Payment Due</h2>
            <a href="/dashboard/credit" style={{ fontSize: '0.8125rem', color: 'var(--brand-primary)' }}>View all</a>
          </div>
          {dueItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-title">No pending dues</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {dueItems.map(item => (
                <div key={item.order_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.625rem 0.75rem',
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${item.status === 'overdue' ? 'rgba(239,68,68,0.2)' : item.status === 'warning' ? 'rgba(234,179,8,0.15)' : 'var(--border-subtle)'}`,
                }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{item.customer_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {item.order_number} · {fmt(item.balance_due)}
                    </div>
                  </div>
                  <DueBadge days={item.days_remaining} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Recent Orders</h2>
            <a href="/dashboard/orders" style={{ fontSize: '0.8125rem', color: 'var(--brand-primary)' }}>View all</a>
          </div>
          {recentOrders.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-title">No orders yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentOrders.map((o: any) => {
                const st = getStatusLabel(o.status)
                return (
                  <div key={o.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.625rem 0.75rem',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{o.order_number}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {(o.customers as any)?.business_name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{fmt(o.total_amount)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Aging Summary */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1.25rem' }}>Payment Aging</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
          {[
            { label: 'Current',    sub: '0 – 30 days',   color: 'var(--green)',          items: dueItems.filter(d => d.days_remaining >= 0 && d.days_remaining <= 30) },
            { label: '31 – 60d',  sub: 'Approaching',    color: 'var(--yellow)',          items: dueItems.filter(d => d.days_remaining > 30 && d.days_remaining <= 60) },
            { label: '61 – 90d',  sub: 'Elevated risk',  color: 'var(--brand-primary)',   items: dueItems.filter(d => d.days_remaining > 60 && d.days_remaining <= 90) },
            { label: 'Critical',  sub: '90+ or overdue', color: 'var(--red)',             items: dueItems.filter(d => d.days_remaining < 0 || d.days_remaining > 90) },
          ].map(b => (
            <div key={b.label} style={{
              padding: '1rem', background: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${b.color}22`,
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: b.color, letterSpacing: '-0.02em' }}>{b.items.length}</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{b.label}</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: 2 }}>{b.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
