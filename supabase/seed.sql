-- ============================================================
-- ACLC WMS — Production User Seed Script
-- Run this in Supabase SQL Editor AFTER running schema.sql
-- Requires: pgcrypto extension (enabled by default in Supabase)
-- ============================================================
-- ⚠️  SAVE THE CREDENTIALS BELOW BEFORE RUNNING ⚠️
-- ============================================================

-- Role          | Email                    | Password
-- --------------|--------------------------|-------------------
-- 👑 Admin      | admin@aclc.com           | Admin@ACLC2025!
-- 🏢 Owner      | owner@aclc.com           | Owner@ACLC2025!
-- 💰 Accounting | accounting@aclc.com      | Acct@ACLC2025!
-- 📦 Staff      | staff@aclc.com           | Staff@ACLC2025!
-- 🚚 Dispatch   | dispatch@aclc.com        | Dispatch@ACLC2025!

-- ============================================================

-- ─── STEP 1: Enable pgcrypto (needed for password hashing) ───
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── STEP 2: Insert Auth Users ───────────────────────────────
-- Fixed UUIDs so we can reference them in Step 3.

DO $$
DECLARE
  uid_admin       UUID := 'a1000000-0000-0000-0000-000000000001';
  uid_owner       UUID := 'a2000000-0000-0000-0000-000000000002';
  uid_accounting  UUID := 'a3000000-0000-0000-0000-000000000003';
  uid_staff       UUID := 'a4000000-0000-0000-0000-000000000004';
  uid_dispatch    UUID := 'a5000000-0000-0000-0000-000000000005';
BEGIN

  -- 👑 ADMIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, role, aud,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    uid_admin,
    '00000000-0000-0000-0000-000000000000',
    'admin@aclc.com',
    crypt('Admin@ACLC2025!', gen_salt('bf', 10)),
    now(), 'authenticated', 'authenticated',
    '{"full_name": "ACLC Administrator"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now(), '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- 🏢 OWNER
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, role, aud,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    uid_owner,
    '00000000-0000-0000-0000-000000000000',
    'owner@aclc.com',
    crypt('Owner@ACLC2025!', gen_salt('bf', 10)),
    now(), 'authenticated', 'authenticated',
    '{"full_name": "ACLC Owner"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now(), '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- 💰 ACCOUNTING
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, role, aud,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    uid_accounting,
    '00000000-0000-0000-0000-000000000000',
    'accounting@aclc.com',
    crypt('Acct@ACLC2025!', gen_salt('bf', 10)),
    now(), 'authenticated', 'authenticated',
    '{"full_name": "ACLC Accounting"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now(), '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- 📦 STAFF
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, role, aud,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    uid_staff,
    '00000000-0000-0000-0000-000000000000',
    'staff@aclc.com',
    crypt('Staff@ACLC2025!', gen_salt('bf', 10)),
    now(), 'authenticated', 'authenticated',
    '{"full_name": "ACLC Staff"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now(), '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- 🚚 DISPATCH
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, role, aud,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    uid_dispatch,
    '00000000-0000-0000-0000-000000000000',
    'dispatch@aclc.com',
    crypt('Dispatch@ACLC2025!', gen_salt('bf', 10)),
    now(), 'authenticated', 'authenticated',
    '{"full_name": "ACLC Dispatch"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now(), '', ''
  ) ON CONFLICT (id) DO NOTHING;

END $$;

-- ─── STEP 3: Set Correct Roles in user_profiles ──────────────
-- The handle_new_user trigger already created the rows with role='staff'
-- We just update the roles to their correct values.

UPDATE user_profiles SET role = 'admin'      WHERE id = 'a1000000-0000-0000-0000-000000000001';
UPDATE user_profiles SET role = 'owner'      WHERE id = 'a2000000-0000-0000-0000-000000000002';
UPDATE user_profiles SET role = 'accounting' WHERE id = 'a3000000-0000-0000-0000-000000000003';
UPDATE user_profiles SET role = 'staff'      WHERE id = 'a4000000-0000-0000-0000-000000000004';
UPDATE user_profiles SET role = 'dispatch'   WHERE id = 'a5000000-0000-0000-0000-000000000005';

-- ─── STEP 4: Insert identity records (required in newer Supabase) ─
INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at
)
SELECT
  gen_random_uuid(), id, email, 'email',
  json_build_object('sub', id::text, 'email', email),
  now(), now(), now()
FROM auth.users
WHERE email IN (
  'admin@aclc.com',
  'owner@aclc.com',
  'accounting@aclc.com',
  'staff@aclc.com',
  'dispatch@aclc.com'
)
ON CONFLICT DO NOTHING;

-- ─── VERIFY ───────────────────────────────────────────────────
SELECT
  u.email,
  p.full_name,
  p.role,
  p.is_active,
  u.email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users u
JOIN user_profiles p ON p.id = u.id
WHERE u.email LIKE '%@aclc.com'
ORDER BY p.role;
