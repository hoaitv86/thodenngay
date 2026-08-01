-- Restore the legacy admin profile without changing its user_id or chat links.
-- Safe to run multiple times. This migration updates public schema records only;
-- run scripts/restore-legacy-admin.mjs to also unban/update the Supabase Auth user.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
DECLARE
  legacy_admin_id UUID;
BEGIN
  SELECT profiles.id
  INTO legacy_admin_id
  FROM public.profiles
  WHERE lower(profiles.email) = lower(current_setting('app.restore_legacy_admin_email', TRUE))
     OR (
       current_setting('app.restore_legacy_admin_email', TRUE) IS NULL
       AND lower(profiles.email) = 'admin@alotho.local'
     )
  ORDER BY profiles.created_at ASC
  LIMIT 1;

  IF legacy_admin_id IS NULL THEN
    SELECT conversations.admin_id
    INTO legacy_admin_id
    FROM public.conversations
    JOIN public.profiles ON profiles.id = conversations.admin_id
    WHERE profiles.role = 'admin'
      AND profiles.is_super_admin = FALSE
      AND profiles.status = 'blocked'
    GROUP BY conversations.admin_id
    ORDER BY count(*) DESC
    LIMIT 1;
  END IF;

  IF legacy_admin_id IS NULL THEN
    RAISE NOTICE 'Legacy admin profile not found. No rows changed.';
    RETURN;
  END IF;

  UPDATE public.profiles
  SET email = COALESCE(NULLIF(current_setting('app.restore_legacy_admin_email', TRUE), ''), 'admin@alotho.local'),
      full_name = COALESCE(NULLIF(current_setting('app.restore_legacy_admin_name', TRUE), ''), 'Admin he thong'),
      role = 'admin',
      status = 'active',
      is_super_admin = FALSE,
      requires_password_change = FALSE,
      updated_at = NOW()
  WHERE id = legacy_admin_id;

  INSERT INTO public.user_roles (user_id, role, is_active, metadata)
  VALUES (legacy_admin_id, 'admin', TRUE, '{"restored_legacy_admin": true}'::jsonb)
  ON CONFLICT (user_id, role)
  DO UPDATE SET is_active = TRUE,
                metadata = public.user_roles.metadata || '{"restored_legacy_admin": true}'::jsonb;

  INSERT INTO public.admin_permissions (admin_id, module, can_view, can_manage, updated_at)
  SELECT legacy_admin_id, modules.module_name, TRUE, TRUE, NOW()
  FROM (
    VALUES
      ('workers'),
      ('customers'),
      ('jobs'),
      ('services'),
      ('billgo'),
      ('sales'),
      ('content'),
      ('analytics')
  ) AS modules(module_name)
  ON CONFLICT (admin_id, module)
  DO UPDATE SET can_view = TRUE,
                can_manage = TRUE,
                updated_at = NOW();
END $$;
