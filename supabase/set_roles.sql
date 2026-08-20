-- ============================================================
-- ACLC WMS — Set Roles After Creating Users via Dashboard
-- Run this AFTER creating all 5 users in Supabase Dashboard
-- (Authentication → Users → Add User)
-- ============================================================

-- Set correct roles by email (works regardless of UUID)
UPDATE public.user_profiles SET role = 'admin'      WHERE email = 'admin@aclc.com';
UPDATE public.user_profiles SET role = 'owner'      WHERE email = 'owner@aclc.com';
UPDATE public.user_profiles SET role = 'accounting' WHERE email = 'accounting@aclc.com';
UPDATE public.user_profiles SET role = 'staff'      WHERE email = 'staff@aclc.com';
UPDATE public.user_profiles SET role = 'dispatch'   WHERE email = 'dispatch@aclc.com';

-- Also update full names
UPDATE public.user_profiles SET full_name = 'ACLC Administrator' WHERE email = 'admin@aclc.com';
UPDATE public.user_profiles SET full_name = 'ACLC Owner'         WHERE email = 'owner@aclc.com';
UPDATE public.user_profiles SET full_name = 'ACLC Accounting'    WHERE email = 'accounting@aclc.com';
UPDATE public.user_profiles SET full_name = 'ACLC Staff'         WHERE email = 'staff@aclc.com';
UPDATE public.user_profiles SET full_name = 'ACLC Dispatch'      WHERE email = 'dispatch@aclc.com';

-- Verify
SELECT email, full_name, role FROM public.user_profiles
WHERE email LIKE '%@aclc.com'
ORDER BY role;
