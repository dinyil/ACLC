import { differenceInDays, format, parseISO } from 'date-fns'
import { CreditTermsType, OrderStatus, PaymentStatus } from './types'

/** Format peso amounts */
export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Format date */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy')
}

/** Format datetime */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy h:mm a')
}

/** Compute payment due date based on credit terms */
export function computeDueDate(
  terms: CreditTermsType,
  orderDate: Date = new Date(),
  checkDate?: Date
): Date {
  const base = terms === 'POST_DATED_CHECK' && checkDate ? checkDate : orderDate
  const days = terms === 'TERMS' ? 60 : 30
  const due = new Date(base)
  due.setDate(due.getDate() + days)
  return due
}

/** Compute days remaining and status */
export function getDueStatus(dueDateStr: string): {
  daysRemaining: number
  status: 'active' | 'warning' | 'overdue'
  label: string
} {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = parseISO(dueDateStr)
  const days = differenceInDays(due, today)

  if (days < 0) return { daysRemaining: days, status: 'overdue', label: `Overdue ${Math.abs(days)}d` }
  if (days <= 3) return { daysRemaining: days, status: 'warning', label: `Due in ${days}d` }
  return { daysRemaining: days, status: 'active', label: `${days} days left` }
}

/** Order status display */
export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string; icon: string }> = {
  DRAFT:                  { label: 'Draft',            cls: 'status-draft',            icon: '' },
  PENDING_OWNER_APPROVAL: { label: 'Awaiting Approval',cls: 'status-pending-approval', icon: '' },
  QUOTATION_GENERATED:    { label: 'Quotation Ready',  cls: 'status-quotation',         icon: '' },
  PENDING_DISPATCH_CHECK: { label: 'Dispatch Check',   cls: 'status-dispatch-check',   icon: '' },
  PENDING_FINAL_APPROVAL: { label: 'Final Approval',   cls: 'status-final-approval',   icon: '' },
  DISPATCHED:             { label: 'Dispatched',       cls: 'status-dispatched',        icon: '' },
  DELIVERED:              { label: 'Delivered',        cls: 'status-delivered',         icon: '' },
  CLOSED:                 { label: 'Closed',           cls: 'status-closed',            icon: '' },
  CANCELLED:              { label: 'Cancelled',        cls: 'status-cancelled',         icon: '' },
}

/** Payment status badge */
export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; cls: string }> = {
  UNPAID:  { label: 'Unpaid',   cls: 'badge badge-red' },
  PARTIAL: { label: 'Partial',  cls: 'badge badge-yellow' },
  PAID:    { label: 'Paid',     cls: 'badge badge-green' },
}

/** Credit terms label */
export const CREDIT_TERMS_LABEL: Record<CreditTermsType, string> = {
  CASH:            'Cash (30 days)',
  TERMS:           'Terms (60 days)',
  POST_DATED_CHECK:'Post-Dated Check (30 days)',
}

/** Generate a unique SKU suggestion */
export function suggestSKU(brand: string, name: string): string {
  const b = brand.replace(/\s+/g, '').toUpperCase().slice(0, 3)
  const n = name.replace(/\s+/g, '').toUpperCase().slice(0, 4)
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `${b}-${n}-${rand}`
}

/** Truncate long text */
export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

/** Debounce */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}
