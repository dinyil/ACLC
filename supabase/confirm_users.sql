-- ============================================================
-- ACLC WMS — Confirm Emails + Reset Passwords
-- Run this in Supabase SQL Editor
-- Fixes "Invalid login credentials" after creating users via Dashboard
-- ============================================================

-- Step 1: Confirm all ACLC email addresses
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at         = now()
WHERE email LIKE '%@aclc.com';

-- Step 2: Reset passwords to our known values
-- (in case dashboard used different passwords)
UPDATE auth.users SET encrypted_password = crypt('Admin@ACLC2025!',    gen_salt('bf', 10)) WHERE email = 'admin@aclc.com';
UPDATE auth.users SET encrypted_password = crypt('Owner@ACLC2025!',    gen_salt('bf', 10)) WHERE email = 'owner@aclc.com';
UPDATE auth.users SET encrypted_password = crypt('Acct@ACLC2025!',     gen_salt('bf', 10)) WHERE email = 'accounting@aclc.com';
UPDATE auth.users SET encrypted_password = crypt('Staff@ACLC2025!',    gen_salt('bf', 10)) WHERE email = 'staff@aclc.com';
UPDATE auth.users SET encrypted_password = crypt('Dispatch@ACLC2025!', gen_salt('bf', 10)) WHERE email = 'dispatch@aclc.com';

-- Step 3: Verify — email_confirmed_at should NOT be null
SELECT email, email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users
WHERE email LIKE '%@aclc.com'
ORDER BY email;
