'use client'

import { UserProfile } from '@/lib/types'

interface HeaderProps {
  title: string
  subtitle?: string
  user: UserProfile
  actions?: React.ReactNode
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="header">
      <div>
        <h1 className="header-title">{title}</h1>
        {subtitle && <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'1px' }}>{subtitle}</p>}
      </div>
      <div className="header-actions">
        {actions}
        <div style={{
          width:'8px', height:'8px', borderRadius:'50%',
          background:'var(--green)',
          boxShadow:'0 0 8px var(--green)',
        }} title="System Online" />
      </div>
    </header>
  )
}
