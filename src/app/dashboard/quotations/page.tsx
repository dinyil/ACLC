'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Quotation } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('quotations')
      .select('*, orders(order_number, customers(business_name)), user_profiles!quotations_created_by_fkey(full_name)')
      .order('created_at', { ascending: false })
    setQuotations((data ?? []) as unknown as Quotation[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase.channel('quotations-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  if (loading) return (
    <div className="loading-page" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Quotations</h1>
          <p className="page-subtitle">View and manage generated quotations</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quotation ID</th>
                <th>Order #</th>
                <th>Customer</th>
                <th>Version</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📄</div>
                      <div className="empty-state-title">No quotations generated yet</div>
                      <div className="empty-state-desc">Quotations are generated from approved orders</div>
                    </div>
                  </td>
                </tr>
              ) : quotations.map(q => (
                <tr key={q.id}>
                  <td>
                    <Link href={`/dashboard/quotations/${q.id}`} style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                      Q-{q.id.split('-')[0].toUpperCase()}
                    </Link>
                  </td>
                  <td><Link href={`/dashboard/orders/${q.order_id}`} style={{ textDecoration: 'underline' }}>{(q.orders as any)?.order_number}</Link></td>
                  <td style={{ fontWeight: 600 }}>{(q.orders as any)?.customers?.business_name}</td>
                  <td><span className="badge badge-muted">{q.version_label}</span></td>
                  <td>
                    <span className={`badge ${q.status === 'DRAFT' ? 'badge-yellow' : q.status === 'LOCKED' ? 'badge-green' : 'badge-red'}`}>
                      {q.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{(q as any).user_profiles?.full_name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(q.created_at)}</td>
                  <td>
                     <Link href={`/dashboard/quotations/${q.id}`} className="btn btn-secondary btn-sm">
                       View
                     </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
