-- ============================================================
-- ACLC WMS — Complete RLS Fix
-- Fixes: quotations, orders, audit_logs, shop_pricing,
--        payments, order_items, stock_movements, and all
--        other tables that need authenticated access.
--
-- Run this entire script in the Supabase SQL Editor.
-- It is safe to run multiple times (DROP IF EXISTS first).
-- ============================================================

-- ── 1. ORDERS ─────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.orders;
DROP POLICY IF EXISTS "auth_manage" ON public.orders;

CREATE POLICY "auth_view"
  ON public.orders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_manage"
  ON public.orders FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 2. ORDER_ITEMS ────────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.order_items;
DROP POLICY IF EXISTS "auth_manage" ON public.order_items;

CREATE POLICY "auth_view"
  ON public.order_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_manage"
  ON public.order_items FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 3. QUOTATIONS ─────────────────────────────────────────────
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.quotations;
DROP POLICY IF EXISTS "auth_manage" ON public.quotations;
DROP POLICY IF EXISTS "auth_insert" ON public.quotations;

CREATE POLICY "auth_view"
  ON public.quotations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_manage"
  ON public.quotations FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 4. AUDIT_LOGS ─────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.audit_logs;
DROP POLICY IF EXISTS "auth_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "auth_manage" ON public.audit_logs;

-- Anyone logged in can insert audit records (needed for all actions)
CREATE POLICY "auth_insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only admin/owner can read audit logs
CREATE POLICY "auth_view"
  ON public.audit_logs FOR SELECT
  USING (get_user_role(auth.uid()) IN ('admin', 'owner'));

-- ── 5. PAYMENTS ───────────────────────────────────────────────
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.payments;
DROP POLICY IF EXISTS "auth_manage" ON public.payments;

CREATE POLICY "auth_view"
  ON public.payments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_manage"
  ON public.payments FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'accounting', 'owner'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'accounting', 'owner'));

-- ── 6. CUSTOMERS (shops) ──────────────────────────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.customers;
DROP POLICY IF EXISTS "auth_manage" ON public.customers;

CREATE POLICY "auth_view"
  ON public.customers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_manage"
  ON public.customers FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 7. PRODUCTS ───────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.products;
DROP POLICY IF EXISTS "auth_manage" ON public.products;

CREATE POLICY "auth_view"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_manage"
  ON public.products FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'owner', 'staff'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'owner', 'staff'));

-- ── 8. CATEGORIES ─────────────────────────────────────────────
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.categories;
DROP POLICY IF EXISTS "admin_manage" ON public.categories;

CREATE POLICY "auth_view"
  ON public.categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manage"
  ON public.categories FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'owner'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'owner'));

-- ── 9. STOCK_MOVEMENTS ────────────────────────────────────────
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.stock_movements;
DROP POLICY IF EXISTS "auth_manage" ON public.stock_movements;

CREATE POLICY "auth_view"
  ON public.stock_movements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_manage"
  ON public.stock_movements FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 10. SHOP_PRICING (new table from migration) ───────────────
ALTER TABLE public.shop_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view"   ON public.shop_pricing;
DROP POLICY IF EXISTS "auth_manage" ON public.shop_pricing;

CREATE POLICY "auth_view"
  ON public.shop_pricing FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_manage"
  ON public.shop_pricing FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'owner', 'accounting'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'owner', 'accounting'));

-- ── 11. SHOP_PRICING_HISTORY (new table from migration) ───────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_pricing_history') THEN
    EXECUTE 'ALTER TABLE public.shop_pricing_history ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "auth_view" ON public.shop_pricing_history';
    EXECUTE 'DROP POLICY IF EXISTS "auth_manage" ON public.shop_pricing_history';
    EXECUTE 'CREATE POLICY "auth_view" ON public.shop_pricing_history FOR SELECT USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "auth_manage" ON public.shop_pricing_history FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- ── 12. DISPATCH_CHECKLISTS ───────────────────────────────────
ALTER TABLE public.dispatch_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view_dispatch" ON public.dispatch_checklists;
DROP POLICY IF EXISTS "dispatch_manage"    ON public.dispatch_checklists;

CREATE POLICY "auth_view_dispatch"
  ON public.dispatch_checklists FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "dispatch_manage"
  ON public.dispatch_checklists FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'dispatch', 'owner'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'dispatch', 'owner'));

-- ── 13. DISPATCH_CHECKLIST_ITEMS ─────────────────────────────
ALTER TABLE public.dispatch_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_view_dispatch_items"   ON public.dispatch_checklist_items;
DROP POLICY IF EXISTS "dispatch_manage_items"      ON public.dispatch_checklist_items;

CREATE POLICY "auth_view_dispatch_items"
  ON public.dispatch_checklist_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "dispatch_manage_items"
  ON public.dispatch_checklist_items FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'dispatch', 'owner'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'dispatch', 'owner'));

-- ── 14. USER_PROFILES ─────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_view" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_manage"       ON public.user_profiles;
DROP POLICY IF EXISTS "self_insert"        ON public.user_profiles;
DROP POLICY IF EXISTS "self_update"        ON public.user_profiles;
DROP POLICY IF EXISTS "self_view"          ON public.user_profiles;

CREATE POLICY "authenticated_view"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manage"
  ON public.user_profiles FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "self_insert"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "self_update"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── VERIFY — show all active policies ─────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  CASE WHEN qual IS NOT NULL THEN left(qual, 60) ELSE '(no USING)' END AS using_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
