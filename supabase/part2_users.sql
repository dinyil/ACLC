-- ============================================================
-- ACLC WMS — Part 2: Finish Setup (run after fresh_setup.sql fails)
-- The tables and triggers are already created.
-- This fixes categories and creates the users.
-- ============================================================

-- ─── Fix categories table (add missing code column) ──────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS code TEXT;
UPDATE categories SET code = UPPER(LEFT(name, 3)) WHERE code IS NULL;

-- ─── Seed Categories ─────────────────────────────────────────
INSERT INTO categories (name, code) VALUES
  ('Engine Parts',      'ENG'),
  ('Oils & Lubricants', 'OIL'),
  ('Brake System',      'BRK'),
  ('Electrical',        'ELC'),
  ('Body Parts',        'BDY'),
  ('Transmission',      'TRX'),
  ('Filters',           'FLT'),
  ('Accessories',       'ACC')
ON CONFLICT (name) DO NOTHING;

-- ─── Seed Users in auth.users ────────────────────────────────
DO $$
DECLARE
  uid_admin      UUID := 'a1000000-0000-0000-0000-000000000001';
  uid_owner      UUID := 'a2000000-0000-0000-0000-000000000002';
  uid_accounting UUID := 'a3000000-0000-0000-0000-000000000003';
  uid_staff      UUID := 'a4000000-0000-0000-0000-000000000004';
  uid_dispatch   UUID := 'a5000000-0000-0000-0000-000000000005';
BEGIN
  INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,role,aud,raw_user_meta_data,raw_app_meta_data,created_at,updated_at,confirmation_token,recovery_token)
  VALUES
    (uid_admin,      '00000000-0000-0000-0000-000000000000','admin@aclc.com',      crypt('Admin@ACLC2025!',    gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Administrator"}','{"provider":"email","providers":["email"]}',now(),now(),'',''),
    (uid_owner,      '00000000-0000-0000-0000-000000000000','owner@aclc.com',      crypt('Owner@ACLC2025!',    gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Owner"}',        '{"provider":"email","providers":["email"]}',now(),now(),'',''),
    (uid_accounting, '00000000-0000-0000-0000-000000000000','accounting@aclc.com', crypt('Acct@ACLC2025!',     gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Accounting"}',   '{"provider":"email","providers":["email"]}',now(),now(),'',''),
    (uid_staff,      '00000000-0000-0000-0000-000000000000','staff@aclc.com',      crypt('Staff@ACLC2025!',    gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Staff"}',        '{"provider":"email","providers":["email"]}',now(),now(),'',''),
    (uid_dispatch,   '00000000-0000-0000-0000-000000000000','dispatch@aclc.com',   crypt('Dispatch@ACLC2025!', gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Dispatch"}',     '{"provider":"email","providers":["email"]}',now(),now(),'','')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ─── Seed auth.identities ────────────────────────────────────
INSERT INTO auth.identities (id,user_id,provider_id,provider,identity_data,created_at,updated_at,last_sign_in_at)
SELECT gen_random_uuid(), id, email, 'email',
       json_build_object('sub', id::text, 'email', email),
       now(), now(), now()
FROM auth.users
WHERE email IN ('admin@aclc.com','owner@aclc.com','accounting@aclc.com','staff@aclc.com','dispatch@aclc.com')
ON CONFLICT DO NOTHING;

-- ─── Seed user_profiles with correct roles ───────────────────
INSERT INTO user_profiles (id, email, full_name, role, is_active)
VALUES
  ('a1000000-0000-0000-0000-000000000001','admin@aclc.com',      'ACLC Administrator','admin',      true),
  ('a2000000-0000-0000-0000-000000000002','owner@aclc.com',      'ACLC Owner',        'owner',      true),
  ('a3000000-0000-0000-0000-000000000003','accounting@aclc.com', 'ACLC Accounting',   'accounting', true),
  ('a4000000-0000-0000-0000-000000000004','staff@aclc.com',      'ACLC Staff',        'staff',      true),
  ('a5000000-0000-0000-0000-000000000005','dispatch@aclc.com',   'ACLC Dispatch',     'dispatch',   true)
ON CONFLICT (id) DO UPDATE SET
  role      = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = true;

-- ─── Verify ──────────────────────────────────────────────────
SELECT u.email, p.full_name, p.role,
       u.email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users u
JOIN user_profiles p ON p.id = u.id
WHERE u.email LIKE '%@aclc.com'
ORDER BY p.role;
