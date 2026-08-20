'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Quotation, Order, OrderItem, UserProfile } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function QuotationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [allVersions, setAllVersions] = useState<Quotation[]>([])
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [locking, setLocking] = useState(false)
  const [markingFinal, setMarkingFinal] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
      setCurrentUser(p as UserProfile)
    }

    const { data: q } = await supabase
      .from('quotations')
      .select('*, user_profiles!quotations_created_by_fkey(full_name)')
      .eq('id', id)
      .single()

    if (q) {
      setQuotation(q as unknown as Quotation)
      const { data: o } = await supabase
        .from('orders')
        .select('*, customers(*)')
        .eq('id', q.order_id)
        .single()
      setOrder(o as unknown as Order)

      const { data: i } = await supabase
        .from('order_items')
        .select('*, products(*)')
        .eq('order_id', q.order_id)
      setItems((i ?? []) as unknown as OrderItem[])

      // ✅ FIX 2: Fetch ALL quotation versions for this order (version history)
      const { data: versions } = await supabase
        .from('quotations')
        .select('*, user_profiles!quotations_created_by_fkey(full_name)')
        .eq('order_id', q.order_id)
        .order('version_number', { ascending: true })
      setAllVersions((versions ?? []) as unknown as Quotation[])
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase.channel(`quotation-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  const handlePrint = () => window.print()

  const handleLock = async () => {
    if (!quotation || !currentUser) return
    setLocking(true)
    const supabase = createClient()
    await supabase.from('quotations').update({
      status: 'LOCKED',
      locked_at: new Date().toISOString(),
      locked_by: currentUser.id
    }).eq('id', quotation.id)
    await supabase.from('audit_logs').insert({
      user_id: currentUser.id,
      action_type: 'LOCK_QUOTATION',
      module: 'quotations',
      record_id: quotation.id,
      before_data: { status: 'DRAFT' },
      after_data: { status: 'LOCKED' }
    })
    setLocking(false)
    load()
  }

  // ✅ FIX 2: Mark as FINAL — supersedes all previous versions
  const handleMarkFinal = async () => {
    if (!quotation || !currentUser) return
    setMarkingFinal(true)
    const supabase = createClient()

    // Supersede all other versions
    await supabase
      .from('quotations')
      .update({ status: 'SUPERSEDED' })
      .eq('order_id', quotation.order_id)
      .neq('id', quotation.id)

    // Mark this one as FINAL + LOCKED
    await supabase.from('quotations').update({
      status: 'LOCKED',
      version_label: 'FINAL',
      locked_at: new Date().toISOString(),
      locked_by: currentUser.id
    }).eq('id', quotation.id)

    await supabase.from('audit_logs').insert({
      user_id: currentUser.id,
      action_type: 'MARK_QUOTATION_FINAL',
      module: 'quotations',
      record_id: quotation.id,
      after_data: { version_label: 'FINAL' }
    })
    setMarkingFinal(false)
    load()
  }

  if (loading) return <div className="spinner" style={{ margin: '2rem auto' }} />
  if (!quotation || !order) return (
    <div className="page-container">
      <div className="empty-state"><div className="empty-state-title">Quotation not found</div></div>
    </div>
  )

  const qidShort = `Q-${quotation.id.split('-')[0].toUpperCase()}`
  const isFinal = quotation.version_label === 'FINAL'
  const isLocked = quotation.status === 'LOCKED'
  const canManage = currentUser?.role === 'owner' || currentUser?.role === 'admin'

  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          .page-container { padding: 0 !important; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; }
          body { background: white; color: black; }
          .badge { border: 1px solid #ccc; color: black !important; background: transparent !important; }
        }
      `}} />

      <div className="no-print page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">
            Quotation {qidShort}
            {isFinal && <span className="badge badge-green" style={{ marginLeft: '0.75rem', fontSize: '0.875rem' }}>✅ FINAL</span>}
            {!isFinal && <span className="badge badge-muted" style={{ marginLeft: '0.75rem', fontSize: '0.875rem' }}>{quotation.version_label}</span>}
          </h1>
          <p className="page-subtitle">
            Order <Link href={`/dashboard/orders/${order.id}`} style={{ textDecoration: 'underline' }}>{order.order_number}</Link>
            {' '}· Status: <strong>{quotation.status}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {quotation.status === 'DRAFT' && canManage && (
            <button className="btn btn-success" onClick={handleLock} disabled={locking}>
              {locking ? <><div className="spinner" /><span>Locking...</span></> : '🔒 Approve & Lock'}
            </button>
          )}
          {isLocked && !isFinal && canManage && (
            <button className="btn btn-primary" onClick={handleMarkFinal} disabled={markingFinal}
              title="Mark this version as FINAL and supersede all previous versions">
              {markingFinal ? <><div className="spinner" /><span>Marking...</span></> : '🏆 Mark as FINAL'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={handlePrint}>🖨️ Print PDF</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Main Quotation Document */}
        <div>
          <div className="card" style={{ background: '#fff', color: '#000', padding: '3rem' }} id="printable-quotation">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2563eb', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#2563eb', margin: 0 }}>ACLC</h1>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>Motorcycle Parts &amp; Oils Warehouse</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#333' }}>
                  QUOTATION{isFinal ? ' — FINAL' : ''}
                </h2>
                <p style={{ margin: 0, fontWeight: 600, color: '#555', marginTop: '0.25rem' }}>#{qidShort}</p>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>Date: {formatDate(quotation.created_at)}</p>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>Version: {quotation.version_label}</p>
              </div>
            </div>

            {/* Customer + Terms */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <div style={{ width: '45%' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Quotation For:</h3>
                <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>{(order.customers as any)?.business_name}</div>
                <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Attn: {(order.customers as any)?.contact_person}</div>
                <div style={{ fontSize: '0.875rem' }}>{(order.customers as any)?.address}</div>
                <div style={{ fontSize: '0.875rem' }}>Phone: {(order.customers as any)?.contact_number}</div>
                {(order.customers as any)?.tin && <div style={{ fontSize: '0.875rem' }}>TIN: {(order.customers as any)?.tin}</div>}
              </div>
              <div style={{ width: '45%' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Terms &amp; Details:</h3>
                <table style={{ width: '100%', fontSize: '0.875rem' }}>
                  <tbody>
                    <tr><td style={{ padding: '0.25rem 0', color: '#666' }}>Payment Method:</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{order.payment_method}</td></tr>
                    <tr><td style={{ padding: '0.25rem 0', color: '#666' }}>Credit Terms:</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{(order.customers as any)?.credit_terms}</td></tr>
                    <tr><td style={{ padding: '0.25rem 0', color: '#666' }}>Valid Until:</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{formatDate(new Date(new Date(quotation.created_at).getTime() + 7 * 86400000))}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f0f4ff', borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#333' }}>SKU</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#333' }}>Description</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#333' }}>Qty</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#333' }}>Unit Price</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#333' }}>Disc %</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#333' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem', color: '#555' }}>{(item.products as any)?.sku}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{(item.products as any)?.name}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: item.discount_percent > 0 ? '#333' : '#aaa' }}>{item.discount_percent}%</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '3rem' }}>
              <div style={{ width: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '0.875rem', color: '#666' }}>
                  <span>Subtotal:</span><span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '0.875rem', color: '#666' }}>
                  <span>Discount:</span><span>- {formatCurrency(order.discount_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderTop: '2px solid #ccc', fontSize: '1.25rem', fontWeight: 800, color: '#2563eb' }}>
                  <span>Total Amount:</span><span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem', fontSize: '0.75rem', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: '#555' }}>Terms &amp; Conditions:</p>
                <ol style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem' }}>
                  <li>Quotation is valid for 7 days.</li>
                  <li>Prices are subject to change without prior notice.</li>
                  <li>Full payment required as per credit terms upon delivery.</li>
                </ol>
              </div>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ borderBottom: '1px solid #333', height: '40px' }} />
                <div style={{ marginTop: '0.5rem' }}>Authorized Signature</div>
              </div>
            </div>

            {/* DRAFT watermark */}
            {quotation.status === 'DRAFT' && (
              <div className="no-print" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-45deg)', fontSize: '8rem', color: 'rgba(239,68,68,0.1)', fontWeight: 900, pointerEvents: 'none' }}>
                DRAFT
              </div>
            )}
          </div>
        </div>

        {/* ✅ FIX 2: Version History Sidebar */}
        <div className="no-print">
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📋 Version History</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {allVersions.map((v, idx) => {
                const isActive = v.id === quotation.id
                const vIsFinal = v.version_label === 'FINAL'
                return (
                  <div key={v.id} style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: isActive ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    background: isActive ? 'rgba(37,99,235,0.08)' : 'var(--bg-input)',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--brand-primary)' : 'inherit' }}>
                        {vIsFinal ? '🏆 FINAL' : v.version_label}
                        {isActive && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--brand-primary)' }}>← Current</span>}
                      </div>
                      <span className={`badge ${v.status === 'DRAFT' ? 'badge-yellow' : v.status === 'LOCKED' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.7rem' }}>
                        {v.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {formatDate(v.created_at)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      By: {(v as any).user_profiles?.full_name ?? '—'}
                    </div>
                    {!isActive && (
                      <Link href={`/dashboard/quotations/${v.id}`}
                        style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', marginTop: '0.5rem', display: 'inline-block' }}>
                        View →
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>

            {allVersions.length === 1 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                Only one version exists. New versions are created from the order page.
              </p>
            )}
          </div>

          {/* Quick Info */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📌 Quotation Info</h2>
            <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <span className={`badge ${quotation.status === 'DRAFT' ? 'badge-yellow' : quotation.status === 'LOCKED' ? 'badge-green' : 'badge-red'}`}>
                  {quotation.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Version</span>
                <strong>{quotation.version_label}</strong>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Created</span>
                <span>{formatDate(quotation.created_at)}</span>
              </div>
              {quotation.locked_at && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Locked</span>
                  <span>{formatDate(quotation.locked_at)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Total</span>
                <strong style={{ color: 'var(--brand-primary)' }}>{formatCurrency(order.total_amount)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
