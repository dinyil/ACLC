-- ============================================================
-- ACLC WMS — Repair Patch
-- Run this in Supabase SQL Editor if you ran seed.sql BEFORE schema.sql
-- This manually creates the user_profiles rows that the trigger missed.
-- ============================================================

INSERT INTO user_profiles (id, email, full_name, role, is_active)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'admin@aclc.com',      'ACLC Administrator', 'admin',      true),
  ('a2000000-0000-0000-0000-000000000002', 'owner@aclc.com',      'ACLC Owner',         'owner',      true),
  ('a3000000-0000-0000-0000-000000000003', 'accounting@aclc.com', 'ACLC Accounting',    'accounting', true),
  ('a4000000-0000-0000-0000-000000000004', 'staff@aclc.com',      'ACLC Staff',         'staff',      true),
  ('a5000000-0000-0000-0000-000000000005', 'dispatch@aclc.com',   'ACLC Dispatch',      'dispatch',   true)
ON CONFLICT (id) DO UPDATE SET
  role       = EXCLUDED.role,
  full_name  = EXCLUDED.full_name,
  is_active  = true;

-- Verify
SELECT email, full_name, role, is_active FROM user_profiles ORDER BY role;
