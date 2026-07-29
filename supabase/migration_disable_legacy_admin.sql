-- Optional cleanup after the official Super Admin exists.
-- Keeps legacy admin@alotho.local only as migration history, then disables it.
UPDATE public.profiles
SET status = 'blocked',
    is_super_admin = FALSE
WHERE email IN ('admin@alotho.local', 'admin@thodenngay.vn')
  AND EXISTS (
    SELECT 1
    FROM public.profiles official_super_admin
    WHERE official_super_admin.role = 'admin'
      AND official_super_admin.is_super_admin = TRUE
      AND official_super_admin.status = 'active'
      AND official_super_admin.email NOT IN ('admin@alotho.local', 'admin@thodenngay.vn')
  );

UPDATE public.user_roles
SET is_active = FALSE
WHERE role = 'admin'
  AND user_id IN (
    SELECT id FROM public.profiles WHERE email IN ('admin@alotho.local', 'admin@thodenngay.vn') AND status = 'blocked'
  );
