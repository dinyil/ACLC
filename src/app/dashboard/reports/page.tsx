'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import * as XLSX from 'xlsx'

export default function ReportsPage() {
  const [reportType, setReportType] = useState('inventory')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [reportTitle, setReportTitle] = useState('')

  async function generateReport() {
    setLoading(true)
    const supabase = createClient()
    let res
    let title = ''

    if (reportType === 'inventory') {
      res = await supabase
        .from('products')
        .select('sku, name, brand, stock_quantity, reorder_level, unit_price, unit_of_measure')
        .order('stock_quantity', { ascending: true })
      title = 'Inventory & Stock Level Report'
    } else if (reportType === 'sales') {
      res = await supabase
        .from('orders')
        .select('order_number, created_at, status, total_amount, amount_paid, balance_due, payment_status, customers(business_name)')
        .neq('status', 'DRAFT')
        .order('created_at', { ascending: false })
        .limit(200)
      title = 'Sales Performance Report'
    } else if (reportType === 'aging') {
      res = await supabase
        .from('orders')
        .select('order_number, due_date, balance_due, payment_status, customers(business_name)')
        .neq('payment_status', 'PAID')
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
      title = 'Payment Aging / Receivables Report'
    } else if (reportType === 'customer') {
      res = await supabase
        .from('customers')
        .select('customer_code, business_name, contact_person, contact_number, address, credit_terms, agent_name, created_at')
        .eq('is_active', true)
        .order('business_name')
      title = 'Customer History Report'
    }

    setData(res?.data ?? [])
    setReportTitle(title)
    setLoading(false)
  }

  function flattenData(raw: any[]) {
    return raw.map(row => {
      const newRow = { ...row }
      if (newRow.customers) {
        newRow.customer_name = newRow.customers.business_name
        delete newRow.customers
      }
      return newRow
    })
  }

  // ✅ FIX 5a: CSV Export
  function handleExportCSV() {
    if (data.length === 0) return
    const flat = flattenData(data)
    const keys = Object.keys(flat[0])
    const csvContent = [
      keys.join(','),
      ...flat.map(row => keys.map(k => `"${row[k] ?? ''}"`).join(','))
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `motowms_${reportType}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ✅ FIX 5b: Excel Export using SheetJS
  function handleExportExcel() {
    if (data.length === 0) return
    const flat = flattenData(data)
    const ws = XLSX.utils.json_to_sheet(flat)

    // Auto-width columns
    const colWidths = Object.keys(flat[0]).map(k => ({
      wch: Math.max(k.length, ...flat.map(r => String(r[k] ?? '').length)) + 2
    }))
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, reportTitle.slice(0, 31))
    XLSX.writeFile(wb, `motowms_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ✅ FIX 5c: PDF Export via print
  function handleExportPDF() {
    if (data.length === 0) return
    window.print()
  }

  const flat = flattenData(data)
  const columns = flat.length > 0 ? Object.keys(flat[0]) : []

  return (
    <>
      {/* Print styles — only shows the report table when printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; font-family: sans-serif; }
          .print-header { display: block !important; }
          .card { box-shadow: none !important; border: none !important; }
          table { font-size: 11px; }
          th, td { padding: 4px 8px !important; border: 1px solid #ccc !important; }
          thead tr { background: #f5f5f5 !important; }
        }
        .print-header { display: none; }
      `}} />

      <div className="page-container">
        {/* Print Header (hidden on screen) */}
        <div className="print-header" style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>ACLC</h1>
          <h2 style={{ fontSize: '1.125rem', margin: '0.25rem 0 0' }}>{reportTitle}</h2>
          <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0.25rem 0 0' }}>
            Generated: {new Date().toLocaleString()} · {data.length} records
          </p>
          <hr style={{ margin: '1rem 0' }} />
        </div>

        <div className="no-print page-header flex justify-between items-center">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">Generate and export business intelligence reports</p>
          </div>
        </div>

        {/* Controls */}
        <div className="no-print card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ width: '280px' }}>
            <label className="input-label">Report Type</label>
            <select className="input" value={reportType} onChange={e => { setReportType(e.target.value); setData([]) }}>
              <option value="inventory">📦 Inventory &amp; Stock Level</option>
              <option value="sales">💰 Sales Performance</option>
              <option value="aging">⏳ Payment Aging / Receivables</option>
              <option value="customer">👥 Customer History</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={generateReport} disabled={loading}>
            {loading ? <><div className="spinner" /><span>Generating...</span></> : '📊 Generate Report'}
          </button>

          {data.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={handleExportCSV} title="Download as CSV">
                📥 CSV
              </button>
              <button className="btn btn-secondary" onClick={handleExportExcel} title="Download as Excel (.xlsx)">
                📊 Excel
              </button>
              <button className="btn btn-secondary" onClick={handleExportPDF} title="Print / Save as PDF">
                🖨️ PDF
              </button>
            </div>
          )}
        </div>

        {data.length > 0 && (
          <div className="card">
            <div className="flex justify-between items-center no-print" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{reportTitle} — {data.length} records</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Export as:</span>
                <button className="btn btn-ghost btn-sm" onClick={handleExportCSV}>CSV</button>
                <button className="btn btn-ghost btn-sm" onClick={handleExportExcel}>Excel</button>
                <button className="btn btn-ghost btn-sm" onClick={handleExportPDF}>PDF</button>
              </div>
            </div>
            <div className="table-wrap" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    {columns.map(k => (
                      <th key={k}>{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flat.map((row, i) => (
                    <tr key={i}>
                      {columns.map((k, j) => (
                        <td key={j}>
                          {k === 'customers' ? row[k]?.business_name :
                           k.includes('amount') || k.includes('price') || k.includes('balance') ? formatCurrency(Number(row[k]) || 0) :
                           k.includes('date') || k === 'created_at' ? (row[k] ? formatDate(row[k]) : '—') :
                           k === 'stock_quantity' ? (
                             <span style={{ color: Number(row[k]) <= (row['reorder_level'] ?? 5) ? 'var(--red)' : 'inherit', fontWeight: Number(row[k]) <= (row['reorder_level'] ?? 5) ? 700 : 400 }}>
                               {row[k]} {Number(row[k]) <= (row['reorder_level'] ?? 5) ? '⚠️' : ''}
                             </span>
                           ) :
                           String(row[k] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.length === 0 && !loading && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
              <div className="empty-state-title">Select a report type and click Generate</div>
              <div className="empty-state-desc">Reports can be exported as CSV, Excel, or PDF</div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
