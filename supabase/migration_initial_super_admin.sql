-- Initial official Super Admin metadata and first-login password change flag.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN NOT NULL DEFAULT FALSE;

-- If the official Super Admin profile already exists, keep it as the only active Super Admin.
UPDATE public.profiles
SET is_super_admin = TRUE,
    role = 'admin',
    status = 'active'
WHERE email = 'superadmin@thodenngay.vn';

UPDATE public.profiles
SET is_super_admin = FALSE
WHERE role = 'admin'
  AND email <> 'superadmin@thodenngay.vn'
  AND EXISTS (
    SELECT 1
    FROM public.profiles official_super_admin
    WHERE official_super_admin.email = 'superadmin@thodenngay.vn'
      AND official_super_admin.role = 'admin'
      AND official_super_admin.is_super_admin = TRUE
      AND official_super_admin.status = 'active'
  );

UPDATE public.profiles
SET status = 'blocked'
WHERE email = 'admin@alotho.local'
  AND EXISTS (
    SELECT 1
    FROM public.profiles official_super_admin
    WHERE official_super_admin.email = 'superadmin@thodenngay.vn'
      AND official_super_admin.role = 'admin'
      AND official_super_admin.is_super_admin = TRUE
      AND official_super_admin.status = 'active'
  );

UPDATE public.user_roles
SET is_active = FALSE
WHERE role = 'admin'
  AND user_id IN (
    SELECT id FROM public.profiles WHERE email = 'admin@alotho.local' AND status = 'blocked'
  );
