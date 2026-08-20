// Shared TypeScript types for the entire ACLC WMS system

export type UserRole = 'admin' | 'owner' | 'accounting' | 'staff' | 'dispatch'

export type CreditTermsType = 'CASH' | 'TERMS' | 'POST_DATED_CHECK'

export type PriceSource = 'REGULAR' | 'SHOP_SPECIFIC' | 'MANUAL'

export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_OWNER_APPROVAL'
  | 'QUOTATION_GENERATED'
  | 'PENDING_DISPATCH_CHECK'
  | 'PENDING_FINAL_APPROVAL'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CLOSED'
  | 'CANCELLED'

export type PaymentMethod = 'CASH' | 'GCASH' | 'CHECK'

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

export type DispatchStatus =
  | 'READY_FOR_DISPATCH'
  | 'CHECKED'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'DELIVERED'

// ─── DATABASE ENTITIES ────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  customer_code: string
  shop_code?: string            // optional manual shop code
  business_name: string
  contact_person: string
  contact_number?: string       // added by migration (was 'phone' in fresh_setup)
  phone?: string                // legacy column name
  address?: string
  tin?: string
  agent_name?: string           // legacy free-text agent
  agent_id?: string             // FK to user_profiles
  agent?: UserProfile           // joined
  credit_terms: CreditTermsType
  credit_limit?: number
  is_active: boolean
  notes?: string
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  category_id: string
  category?: Category
  brand?: string
  unit_price: number
  stock_quantity: number
  reorder_level: number
  unit_of_measure?: string      // schema.sql name
  unit?: string                 // fresh_setup.sql name
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  customer_id: string
  customer?: Customer
  status: OrderStatus
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  gcash_reference?: string
  check_number?: string
  check_date?: string
  check_bank?: string
  subtotal: number
  discount_amount: number
  total_amount: number
  amount_paid: number
  balance_due: number
  due_date?: string
  notes?: string
  payment_terms_snapshot?: string   // snapshot saved at order creation
  credit_terms_snapshot?: string    // snapshot saved at order creation
  approved_by?: string
  approved_at?: string
  dispatched_by?: string
  dispatched_at?: string
  created_by: string
  created_at: string
  updated_at: string
  items?: OrderItem[]
  // Supabase join aliases (returned from joined queries)
  customers?: Partial<Customer>        // alias when joined via .select('*, customers(*)')
  user_profiles?: Partial<UserProfile> // alias when joined via .select('*, user_profiles(*)')
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product?: Product
  quantity: number
  unit_price: number            // final price used
  discount_percent: number
  subtotal: number
  // Price snapshot fields (added by migration)
  regular_price_snapshot?: number   // product.unit_price at order time
  shop_price_snapshot?: number      // shop-specific price at order time (if applicable)
  price_source?: PriceSource        // 'REGULAR' | 'SHOP_SPECIFIC' | 'MANUAL'
  manual_reason?: string            // reason if price was manually overridden
  discount_amount?: number          // computed discount in pesos
  // Supabase join aliases (returned from joined queries)
  products?: Partial<Product>       // alias when joined via .select('*, products(*)')
}

export interface Quotation {
  id: string
  order_id: string
  order?: Order
  version_number: number
  version_label: string // v1, v2, FINAL
  status: 'DRAFT' | 'LOCKED' | 'SUPERSEDED'
  notes?: string
  created_by: string
  created_at: string
  locked_at?: string
  locked_by?: string
  // Supabase join aliases
  orders?: Partial<Order>
  user_profiles?: Partial<UserProfile>
}

// ─── SHOP PRICING ─────────────────────────────────────────────────────────────

export interface ShopPricing {
  id: string
  shop_id: string
  shop?: Customer
  product_id: string
  product?: Product
  regular_price: number         // snapshot of product.unit_price when created
  special_price: number         // the shop-specific selling price
  effective_date: string        // ISO date string
  is_active: boolean
  reason?: string
  created_by?: string
  created_by_user?: UserProfile
  updated_by?: string
  updated_by_user?: UserProfile
  created_at: string
  updated_at: string
}

export interface ShopPricingHistory {
  id: string
  shop_id: string
  shop?: Customer
  product_id: string
  product?: Product
  previous_price?: number
  new_price: number
  effective_date: string
  changed_by?: string
  changed_by_user?: UserProfile
  reason?: string
  created_at: string
}

// ─── LEGACY CUSTOMER PRICING (kept for backward compat) ──────────────────────

export interface CustomerPricing {
  id: string
  customer_id: string
  product_id: string
  product?: Product
  custom_price: number
  agent_name?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  order_id: string
  order?: Order
  amount: number
  payment_method: PaymentMethod
  payment_date: string
  reference_number?: string
  notes?: string
  recorded_by: string
  created_at: string
  // Supabase join aliases
  orders?: Partial<Order>
}

export interface StockMovement {
  id: string
  product_id: string
  product?: Product
  order_id?: string
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity_change: number
  quantity_before: number
  quantity_after: number
  reason: string
  created_by: string
  created_at: string
}

export interface DispatchChecklist {
  id: string
  order_id: string
  order?: Order
  checked_by?: string
  checked_at?: string
  approved_by?: string
  approved_at?: string
  status: DispatchStatus
  notes?: string
  items?: DispatchChecklistItem[]
  created_at: string
}

export interface DispatchChecklistItem {
  id: string
  checklist_id: string
  order_item_id: string
  order_item?: OrderItem
  quantity_verified: number
  is_verified: boolean
  notes?: string
}

export interface AuditLog {
  id: string
  user_id: string
  user?: UserProfile
  action_type: string
  module: string
  record_id?: string
  before_data?: Record<string, unknown>
  after_data?: Record<string, unknown>
  ip_address?: string
  created_at: string
}

// ─── DASHBOARD TYPES ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  totalRevenue: number
  overduePayments: number
  lowStockItems: number
  activeCustomers: number
}

export interface PaymentDueItem {
  order_id: string
  order_number: string
  customer_name: string
  total_amount: number
  balance_due: number
  due_date: string
  days_remaining: number
  status: 'active' | 'warning' | 'overdue'
}

// ─── AUTH TYPES ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  profile: UserProfile
}

// ─── API RESPONSE TYPES ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

// ─── PERMISSION MATRIX ────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'], // full access
  owner: [
    'orders:view', 'orders:approve', 'orders:reject',
    'customers:view', 'customers:create', 'customers:edit', 'customers:deactivate',
    'inventory:view', 'reports:view', 'dashboard:view',
    'pricing:view', 'pricing:approve', 'pricing:manage',
    'shops:pricing:view', 'shops:pricing:manage',
    'payments:view', 'quotations:view', 'dispatch:view',
    'orders:price:override',
  ],
  accounting: [
    'payments:view', 'payments:create', 'payments:edit',
    'orders:view', 'customers:view', 'reports:view',
    'dashboard:view', 'credit:view', 'credit:manage',
    'shops:pricing:view',
  ],
  staff: [
    'orders:view', 'orders:create', 'orders:edit',
    'customers:view', 'customers:create', 'customers:edit',
    'inventory:view', 'inventory:create', 'inventory:edit',
    'quotations:view', 'quotations:create', 'quotations:edit',
    'pricing:view', 'dashboard:view',
    'shops:pricing:view', 'shops:pricing:manage',
    'orders:price:override',
  ],
  dispatch: [
    'orders:view', 'dispatch:view', 'dispatch:check',
    'inventory:view', 'dashboard:view',
  ],
}

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role]
  return perms.includes('*') || perms.includes(permission)
}

// ─── PRICE SOURCE HELPERS ─────────────────────────────────────────────────────

export const PRICE_SOURCE_CONFIG: Record<PriceSource, { label: string; cls: string; description: string }> = {
  REGULAR:       { label: 'Regular Price',       cls: 'badge-blue',   description: 'Standard product price' },
  SHOP_SPECIFIC: { label: 'Shop-Specific Price',  cls: 'badge-green',  description: 'Special price set for this shop' },
  MANUAL:        { label: 'Manually Adjusted',    cls: 'badge-yellow', description: 'Price manually overridden during order creation' },
}

export const CREDIT_TERMS_DISPLAY: Record<CreditTermsType, { label: string; days: number }> = {
  CASH:            { label: 'Cash',            days: 0  },
  TERMS:           { label: 'Terms (60 days)', days: 60 },
  POST_DATED_CHECK:{ label: 'Post-Dated Check', days: 30 },
}
