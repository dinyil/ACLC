'use client'

import { useEffect, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string          // primary text shown in list
  sublabel?: string      // secondary text (smaller, muted)
  badge?: string         // optional badge text (e.g. balance, status)
  badgeColor?: string    // CSS color for badge
  disabled?: boolean
}

interface SearchableSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  required?: boolean
  disabled?: boolean
  id?: string
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '— Select —',
  searchPlaceholder = 'Type to search...',
  required,
  disabled,
  id,
}: SearchableSelectProps) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef             = useRef<HTMLDivElement>(null)
  const searchRef           = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = options.filter(o => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      o.label.toLowerCase().includes(q) ||
      (o.sublabel ?? '').toLowerCase().includes(q) ||
      (o.badge ?? '').toLowerCase().includes(q)
    )
  })

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open])

  function select(val: string) {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setSearch('') }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} id={id}>
      {/* Trigger */}
      <button
        type="button"
        className="input"
        disabled={disabled}
        style={{
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          background: open ? 'var(--bg-elevated, var(--bg-card))' : undefined,
          borderColor: open ? 'var(--brand-primary)' : undefined,
          boxShadow: open ? '0 0 0 3px var(--brand-glow)' : undefined,
        }}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={handleKeyDown}
      >
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          flex: 1,
        }}>
          {selected ? selected.label : placeholder}
          {selected?.sublabel && (
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.375rem', fontSize: '0.8125rem' }}>
              {selected.sublabel}
            </span>
          )}
        </span>
        {selected?.badge && (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: selected.badgeColor ?? 'var(--brand-accent)',
            flexShrink: 0,
            marginRight: '0.25rem',
          }}>
            {selected.badge}
          </span>
        )}
        <span style={{
          color: 'var(--text-muted)',
          flexShrink: 0,
          transition: 'transform 0.2s',
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'none',
          fontSize: '0.75rem',
        }}>▾</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 300,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          {/* Search box */}
          <div style={{ padding: '0.625rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '0.625rem', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)',
                fontSize: '0.875rem', pointerEvents: 'none',
              }}>🔍</span>
              <input
                ref={searchRef}
                className="input"
                style={{ paddingLeft: '2rem', fontSize: '0.875rem', padding: '0.5rem 0.75rem 0.5rem 2rem' }}
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Options list */}
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {/* Clear / empty option */}
            {!required && (
              <div
                onClick={() => select('')}
                style={{
                  padding: '0.625rem 0.875rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                  fontStyle: 'italic',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: value === '' ? 'rgba(37,99,235,0.08)' : undefined,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = value === '' ? 'rgba(37,99,235,0.08)' : '')}
              >
                {placeholder}
              </div>
            )}

            {filtered.length === 0 ? (
              <div style={{
                padding: '1.5rem 1rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
              }}>
                No results for &ldquo;{search}&rdquo;
              </div>
            ) : (
              filtered.map(opt => {
                const isSelected = opt.value === value
                return (
                  <div
                    key={opt.value}
                    onClick={() => !opt.disabled && select(opt.value)}
                    style={{
                      padding: '0.625rem 0.875rem',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: isSelected ? 'rgba(37,99,235,0.12)' : undefined,
                      borderLeft: isSelected ? '3px solid var(--brand-primary)' : '3px solid transparent',
                      opacity: opt.disabled ? 0.5 : 1,
                    }}
                    onMouseEnter={e => {
                      if (!isSelected && !opt.disabled)
                        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface)'
                    }}
                    onMouseLeave={e => {
                      if (!isSelected)
                        (e.currentTarget as HTMLDivElement).style.background = ''
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'var(--brand-accent)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    {opt.badge && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: opt.badgeColor ?? 'var(--brand-accent)',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}>
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span style={{ color: 'var(--brand-primary)', flexShrink: 0, fontSize: '0.875rem' }}>✓</span>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer count */}
          <div style={{
            padding: '0.375rem 0.875rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'right',
          }}>
            {filtered.length} of {options.length}
          </div>
        </div>
      )}
    </div>
  )
}
