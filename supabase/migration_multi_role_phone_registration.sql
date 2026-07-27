-- Multi-role account model with phone-first registration.
-- Backward compatible: profiles.role remains the legacy default role for existing screens/data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.normalize_phone(input_phone TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(regexp_replace(COALESCE(input_phone, ''), '\D', '', 'g'), '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS normalized_phone TEXT;

UPDATE public.profiles
SET normalized_phone = public.normalize_phone(phone)
WHERE normalized_phone IS NULL
  AND public.normalize_phone(phone) IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE normalized_phone IS NOT NULL
    GROUP BY normalized_phone
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_normalized_phone_unique
      ON public.profiles(normalized_phone)
      WHERE normalized_phone IS NOT NULL;
  ELSE
    CREATE INDEX IF NOT EXISTS profiles_normalized_phone_idx
      ON public.profiles(normalized_phone)
      WHERE normalized_phone IS NOT NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'worker', 'admin', 'unit_owner', 'lead_worker', 'assistant_worker')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.worker_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  normalized_phone TEXT,
  address TEXT,
  gps_location JSONB,
  status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'blocked')) DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.worker_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES public.worker_units(id) ON DELETE CASCADE NOT NULL,
  lead_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  service_area TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.worker_unit_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES public.worker_units(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.worker_teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  member_role TEXT NOT NULL CHECK (member_role IN ('owner', 'manager', 'lead_worker', 'assistant_worker', 'worker')) DEFAULT 'worker',
  status TEXT NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'left')) DEFAULT 'active',
  invited_phone TEXT,
  invited_normalized_phone TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(unit_id, user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_unit_members ENABLE ROW LEVEL SECURITY;

INSERT INTO public.user_roles (user_id, role, is_active)
SELECT id, role, TRUE
FROM public.profiles
WHERE role IN ('customer', 'worker', 'admin')
ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

INSERT INTO public.user_roles (user_id, role, is_active)
SELECT user_id, 'worker', TRUE
FROM public.workers
ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

INSERT INTO public.user_roles (user_id, role, is_active)
SELECT id, 'customer', TRUE
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_profile_normalized_phone()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_phone = public.normalize_phone(NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_profiles_normalized_phone ON public.profiles;
CREATE TRIGGER sync_profiles_normalized_phone
  BEFORE INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_normalized_phone();

CREATE OR REPLACE FUNCTION public.user_has_role(check_user_id UUID, check_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = check_role
      AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Anyone can view worker profiles" ON public.profiles;
CREATE POLICY "Anyone can view worker profiles" ON public.profiles
  FOR SELECT USING (
    role = 'worker'
    OR public.user_has_role(profiles.id, 'worker')
    OR public.user_has_role(profiles.id, 'lead_worker')
    OR public.user_has_role(profiles.id, 'assistant_worker')
  );

CREATE OR REPLACE FUNCTION public.current_user_owns_unit(check_unit_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.worker_units
    WHERE id = check_unit_id
      AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Owners view own units" ON public.worker_units
  FOR SELECT USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "Owners create own units" ON public.worker_units
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update own units" ON public.worker_units
  FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin()) WITH CHECK (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Members view unit teams" ON public.worker_teams
  FOR SELECT USING (
    public.current_user_owns_unit(unit_id)
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.worker_unit_members
      WHERE worker_unit_members.unit_id = worker_teams.unit_id
        AND worker_unit_members.user_id = auth.uid()
        AND worker_unit_members.status = 'active'
    )
  );
CREATE POLICY "Owners manage unit teams" ON public.worker_teams
  FOR ALL USING (public.current_user_owns_unit(unit_id) OR public.is_admin())
  WITH CHECK (public.current_user_owns_unit(unit_id) OR public.is_admin());

CREATE POLICY "Members view memberships" ON public.worker_unit_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.current_user_owns_unit(unit_id)
    OR public.is_admin()
  );
CREATE POLICY "Owners manage memberships" ON public.worker_unit_members
  FOR ALL USING (public.current_user_owns_unit(unit_id) OR public.is_admin())
  WITH CHECK (public.current_user_owns_unit(unit_id) OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Workers create own record" ON public.workers;
CREATE POLICY "Workers create own record" ON public.workers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'requested_role', NEW.raw_user_meta_data->>'role', 'customer');
  phone_value TEXT := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone);
  worker_specs TEXT[] := '{}';
BEGIN
  INSERT INTO public.profiles (id, email, phone, normalized_phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    phone_value,
    public.normalize_phone(phone_value),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nguoi dung'),
    CASE WHEN requested_role = 'admin' THEN 'admin' ELSE 'customer' END
  );

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (NEW.id, 'customer', TRUE)
  ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

  IF requested_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (NEW.id, 'admin', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  IF requested_role = 'worker' THEN
    IF NEW.raw_user_meta_data ? 'specialties'
      AND NEW.raw_user_meta_data->'specialties' IS NOT NULL
      AND jsonb_typeof(NEW.raw_user_meta_data->'specialties') = 'array' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'specialties')) INTO worker_specs;
    END IF;

    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (NEW.id, 'worker', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

    INSERT INTO public.workers (user_id, status, specialties)
    VALUES (NEW.id, 'pending', worker_specs)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
