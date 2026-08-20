-- ============================================================
-- ACLC WMS — DATA RESET SCRIPT
-- Clears ALL business data but PRESERVES user accounts.
-- Safe to run multiple times.
-- ⚠️  This CANNOT be undone. Make sure you want to reset!
-- ============================================================

-- Disable triggers temporarily to avoid cascading issues
SET session_replication_role = replica;

-- ─── Clear in dependency order (children first) ──────────────

-- Shop pricing history
TRUNCATE TABLE shop_pricing_history RESTART IDENTITY CASCADE;

-- Shop pricing
TRUNCATE TABLE shop_pricing RESTART IDENTITY CASCADE;

-- Dispatch checklist items first, then checklists
TRUNCATE TABLE dispatch_checklist_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE dispatch_checklists      RESTART IDENTITY CASCADE;

-- Payments
TRUNCATE TABLE payments RESTART IDENTITY CASCADE;

-- Quotations
TRUNCATE TABLE quotations RESTART IDENTITY CASCADE;

-- Order items then orders
TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders      RESTART IDENTITY CASCADE;

-- Stock movements
TRUNCATE TABLE stock_movements RESTART IDENTITY CASCADE;

-- Audit logs
TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;

-- Customer pricing (legacy)
TRUNCATE TABLE customer_pricing RESTART IDENTITY CASCADE;

-- Customers / Shops
TRUNCATE TABLE customers RESTART IDENTITY CASCADE;

-- Products and categories
TRUNCATE TABLE products    RESTART IDENTITY CASCADE;
TRUNCATE TABLE categories  RESTART IDENTITY CASCADE;

-- Reset sequences
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'order_seq') THEN
    ALTER SEQUENCE order_seq RESTART WITH 1;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'customer_seq') THEN
    ALTER SEQUENCE customer_seq RESTART WITH 1;
  END IF;
END $$;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- ─── Verify what remains ─────────────────────────────────────
SELECT
  'user_profiles'         AS table_name, COUNT(*) AS remaining_rows FROM user_profiles
UNION ALL SELECT 'categories',        COUNT(*) FROM categories
UNION ALL SELECT 'products',          COUNT(*) FROM products
UNION ALL SELECT 'customers',         COUNT(*) FROM customers
UNION ALL SELECT 'orders',            COUNT(*) FROM orders
UNION ALL SELECT 'order_items',       COUNT(*) FROM order_items
UNION ALL SELECT 'payments',          COUNT(*) FROM payments
UNION ALL SELECT 'shop_pricing',      COUNT(*) FROM shop_pricing
UNION ALL SELECT 'audit_logs',        COUNT(*) FROM audit_logs;

-- user_profiles should be > 0 (accounts preserved)
-- all others should be 0
