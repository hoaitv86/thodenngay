-- Super Admin foundation. Safe to run multiple times; it preserves existing data.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'blocked'));

UPDATE public.profiles
SET is_super_admin = TRUE,
    status = 'active'
WHERE role = 'admin'
  AND (
    email = 'admin@alotho.local'
    OR email = 'admin@alotho.vn'
    OR is_super_admin = TRUE
  );

INSERT INTO public.user_roles (user_id, role, is_active)
SELECT id, 'admin', TRUE
FROM public.profiles
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
