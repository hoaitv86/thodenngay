-- Module-level permissions for admin accounts. Safe to run multiple times.
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  module TEXT NOT NULL CHECK (module IN ('workers', 'customers', 'jobs', 'services', 'billgo', 'sales', 'content', 'analytics')),
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (admin_id, module)
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view admin permissions" ON public.admin_permissions;
DROP POLICY IF EXISTS "Super admins manage admin permissions" ON public.admin_permissions;

CREATE POLICY "Admins view admin permissions" ON public.admin_permissions
  FOR SELECT USING (
    admin_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.status <> 'blocked'
    )
  );

CREATE POLICY "Super admins manage admin permissions" ON public.admin_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.status <> 'blocked'
        AND profiles.is_super_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.status <> 'blocked'
        AND profiles.is_super_admin = TRUE
    )
  );

INSERT INTO public.admin_permissions (admin_id, module, can_view, can_manage)
SELECT profiles.id, modules.module_name, TRUE, TRUE
FROM public.profiles
CROSS JOIN (
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
WHERE profiles.role = 'admin'
ON CONFLICT (admin_id, module) DO NOTHING;
