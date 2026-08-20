'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserProfile } from '@/lib/types'

// SVG icon components
function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  orders: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 M9 5a2 2 0 012-2h2a2 2 0 012 2 M9 12h6 M9 16h4',
  quotations: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  customers: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  inventory: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
  dispatch: 'M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  payments: 'M2 5h20v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5z M2 10h20',
  credit: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  reports: 'M18 20V10 M12 20V4 M6 20v-6',
  audit: 'M11 17l-5-5 5-5 M18 17l-5-5 5-5',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9',
  menu: 'M3 12h18 M3 6h18 M3 18h18',
  close: 'M18 6L6 18 M6 6l12 12',
}

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/dashboard/orders',     icon: 'orders',     label: 'Orders' },
      { href: '/dashboard/quotations', icon: 'quotations', label: 'Quotations' },
      { href: '/dashboard/customers',  icon: 'customers',  label: 'Customers' },
    ],
  },
  {
    label: 'Warehouse',
    items: [
      { href: '/dashboard/inventory', icon: 'inventory', label: 'Inventory' },
      { href: '/dashboard/dispatch',  icon: 'dispatch',  label: 'Dispatch' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/payments', icon: 'payments', label: 'Payments' },
      { href: '/dashboard/credit',   icon: 'credit',   label: 'Credit Monitor' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/dashboard/reports',    icon: 'reports', label: 'Reports' },
      { href: '/dashboard/audit-logs', icon: 'audit',   label: 'Audit Logs' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/settings', icon: 'settings', label: 'Settings' },
    ],
  },
]

const ROLE_ALLOWED: Record<string, string[]> = {
  admin:      ['*'],
  owner:      ['/dashboard','/dashboard/orders','/dashboard/quotations','/dashboard/customers','/dashboard/inventory','/dashboard/payments','/dashboard/credit','/dashboard/reports','/dashboard/audit-logs'],
  accounting: ['/dashboard','/dashboard/payments','/dashboard/credit','/dashboard/customers','/dashboard/reports'],
  staff:      ['/dashboard','/dashboard/orders','/dashboard/quotations','/dashboard/customers','/dashboard/inventory'],
  dispatch:   ['/dashboard','/dashboard/dispatch','/dashboard/inventory'],
}

const ROLE_LABELS: Record<string, string> = {
  admin:      'Admin',
  owner:      'Owner',
  accounting: 'Accounting',
  staff:      'Staff',
  dispatch:   'Dispatch',
}

interface SidebarProps {
  user: UserProfile
  onLogout: () => void
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ user, onLogout, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const allowed  = ROLE_ALLOWED[user.role] ?? []
  const isAllowed = (href: string) =>
    allowed.includes('*') ||
    allowed.includes(href) ||
    allowed.some(a => a !== '/dashboard' && pathname.startsWith(a + '/'))

  return (
    <>
      {/* Mobile overlay — tap to close */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-label="Close menu"
        />
      )}

      <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
        {/* Logo + mobile close button */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z"
                fill="white" fillOpacity="0.9"/>
              <path d="M9 12l2 2 4-4" stroke="#2563eb" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="sidebar-logo-text">ACLC</div>
            <div className="sidebar-logo-sub">Parts &amp; Oils WMS</div>
          </div>
          {/* Close button — visible on mobile only */}
          <button
            className="btn btn-ghost btn-icon sidebar-close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map(section => {
            const visible = section.items.filter(i => isAllowed(i.href))
            if (!visible.length) return null
            return (
              <div key={section.label}>
                <div className="nav-section-label">{section.label}</div>
                {visible.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                    onClick={onClose}  // close sidebar on nav click (mobile)
                  >
                    <span className="nav-item-icon">
                      <Icon d={ICONS[item.icon as keyof typeof ICONS]} />
                    </span>
                    <span className="nav-label">{item.label}</span>
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">
              {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="user-info">
              <div className="user-name">{user.full_name}</div>
              <div className="user-role">{ROLE_LABELS[user.role] ?? user.role}</div>
            </div>
            <button
              onClick={onLogout}
              className="btn btn-ghost btn-icon"
              title="Sign out"
              style={{ color: 'var(--text-muted)' }}
            >
              <Icon d={ICONS.logout} size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
