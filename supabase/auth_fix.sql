-- ============================================================
-- ACLC WMS — Auth Fix
-- "Database error querying schema" during sign-in fix.
-- The handle_new_user trigger needs to be more defensive.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Drop and recreate the trigger cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Recreate with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth even if profile insert fails
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;

-- Also ensure user_profiles has proper grants
GRANT ALL ON public.user_profiles TO service_role;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;

-- Also fix the get_user_role function with proper search_path
DROP FUNCTION IF EXISTS get_user_role(UUID) CASCADE;
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.user_profiles WHERE id = user_id;
$$;

GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO service_role;

-- Verify trigger exists
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
