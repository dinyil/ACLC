-- ============================================================
-- ACLC WMS — CLEAN SLATE AUTH RESET (Fixed)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Remove the broken auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Step 2: Wipe broken SQL-inserted users
-- (cast uuid to text to match varchar columns)
DELETE FROM auth.identities
WHERE user_id::text IN (SELECT id::text FROM auth.users WHERE email LIKE '%@aclc.com');

DELETE FROM auth.sessions
WHERE user_id::text IN (SELECT id::text FROM auth.users WHERE email LIKE '%@aclc.com');

DELETE FROM auth.refresh_tokens
WHERE user_id::text IN (SELECT id::text FROM auth.users WHERE email LIKE '%@aclc.com');

DELETE FROM public.user_profiles
WHERE email LIKE '%@aclc.com';

DELETE FROM auth.users WHERE email LIKE '%@aclc.com';

-- Step 3: Verify — both should show 0
SELECT
  (SELECT count(*) FROM auth.users        WHERE email LIKE '%@aclc.com')::int AS auth_users_remaining,
  (SELECT count(*) FROM public.user_profiles WHERE email LIKE '%@aclc.com')::int AS profiles_remaining;
