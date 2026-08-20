-- ============================================================
-- ACLC WMS — Database Diagnostic
-- Run this FIRST in Supabase SQL Editor to see what exists
-- ============================================================

SELECT
  EXISTS(SELECT FROM information_schema.tables  WHERE table_schema = 'public' AND table_name = 'user_profiles')  AS has_user_profiles,
  EXISTS(SELECT FROM information_schema.tables  WHERE table_schema = 'public' AND table_name = 'products')        AS has_products,
  EXISTS(SELECT FROM information_schema.tables  WHERE table_schema = 'public' AND table_name = 'orders')          AS has_orders,
  EXISTS(SELECT FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'handle_new_user') AS has_trigger_fn,
  (SELECT COUNT(*) FROM auth.users WHERE email LIKE '%@aclc.com')::INT AS auth_user_count;
