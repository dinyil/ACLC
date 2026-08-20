'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuditLog } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterModule, setFilterModule] = useState('ALL')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('audit_logs')
      .select('*, user_profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100)
    
    setLogs((data ?? []) as unknown as AuditLog[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    const user = ((l as any).user_profiles?.full_name || '').toLowerCase()
    const action = l.action_type.toLowerCase()
    const matchSearch = !q || user.includes(q) || action.includes(q) || l.module.toLowerCase().includes(q)
    const matchMod = filterModule === 'ALL' || l.module === filterModule
    return matchSearch && matchMod
  })

  if (loading) return (
    <div className="loading-page" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  const modules = Array.from(new Set(logs.map(l => l.module)))

  const getActionColor = (action: string) => {
     if (action.includes('CREATE') || action.includes('INSERT')) return 'var(--green)'
     if (action.includes('UPDATE') || action.includes('CHANGE')) return 'var(--blue)'
     if (action.includes('DELETE') || action.includes('DEACTIVATE')) return 'var(--red)'
     return 'var(--yellow)'
  }

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Immutable record of all system activity (Last 100 entries)</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="input-icon-wrap" style={{ flex: 1, minWidth: '200px' }}>
            <span className="input-icon">🔍</span>
            <input className="input" placeholder="Search user, action..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 'auto' }} value={filterModule} onChange={e => setFilterModule(e.target.value)}>
            <option value="ALL">All Modules</option>
            {modules.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Module</th>
                <th>Action</th>
                <th>Record ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <div className="empty-state-title">No audit logs found</div>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(l => (
                <tr key={l.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(l.created_at)}</td>
                  <td style={{ fontWeight: 600 }}>{(l as any).user_profiles?.full_name || 'System'}</td>
                  <td><span className="badge badge-muted">{l.module.toUpperCase()}</span></td>
                  <td style={{ fontWeight: 600, color: getActionColor(l.action_type) }}>{l.action_type}</td>
                  <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{l.record_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
