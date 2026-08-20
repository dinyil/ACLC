-- ============================================================
-- ACLC WMS — Fix RLS on user_profiles
-- Root cause: RLS policy blocks users from reading their own profile
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop all old user_profiles policies (clean slate)
DROP POLICY IF EXISTS "self_view"            ON public.user_profiles;
DROP POLICY IF EXISTS "admin_manage"         ON public.user_profiles;
DROP POLICY IF EXISTS "self_insert"          ON public.user_profiles;
DROP POLICY IF EXISTS "self_update"          ON public.user_profiles;
DROP POLICY IF EXISTS "authenticated_view"   ON public.user_profiles;

-- Policy 1: Any logged-in user can READ all profiles
-- (This is an internal staff system — all users are trusted employees)
CREATE POLICY "authenticated_view"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy 2: Admin can do everything (INSERT/UPDATE/DELETE)
CREATE POLICY "admin_manage"
  ON public.user_profiles
  FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- Policy 3: User can insert their own profile (for auto-create)
CREATE POLICY "self_insert"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 4: User can update their own profile (name, etc.)
CREATE POLICY "self_update"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Verify policies are in place
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;
