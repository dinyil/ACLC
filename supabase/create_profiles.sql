-- ============================================================
-- ACLC WMS — Create Missing User Profiles + Fix RLS
-- Run this in Supabase SQL Editor
-- Fixes: "Unable to load your profile" after login
-- ============================================================

-- Step 1: Insert user_profiles from actual auth.users UUIDs
-- (uses real UUIDs — safe regardless of how users were created)
INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)) AS full_name,
  'staff'::user_role AS role,
  true AS is_active
FROM auth.users u
WHERE u.email LIKE '%@aclc.com'
ON CONFLICT (id) DO NOTHING;

-- Step 2: Set correct roles + names by email
UPDATE public.user_profiles SET role = 'admin',      full_name = 'ACLC Administrator' WHERE email = 'admin@aclc.com';
UPDATE public.user_profiles SET role = 'owner',      full_name = 'ACLC Owner'         WHERE email = 'owner@aclc.com';
UPDATE public.user_profiles SET role = 'accounting', full_name = 'ACLC Accounting'    WHERE email = 'accounting@aclc.com';
UPDATE public.user_profiles SET role = 'staff',      full_name = 'ACLC Staff'         WHERE email = 'staff@aclc.com';
UPDATE public.user_profiles SET role = 'dispatch',   full_name = 'ACLC Dispatch'      WHERE email = 'dispatch@aclc.com';

-- Step 3: Add self-insert RLS so future users can create their own profile
-- (prevents "Unable to load profile" for any new accounts added later)
DROP POLICY IF EXISTS "self_insert" ON public.user_profiles;
CREATE POLICY "self_insert"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Step 4: Verify
SELECT email, full_name, role, is_active
FROM public.user_profiles
WHERE email LIKE '%@aclc.com'
ORDER BY role;
