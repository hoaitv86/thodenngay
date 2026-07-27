-- Multi-role account model with phone-first registration.
-- Backward compatible: profiles.role remains the legacy default role for existing screens/data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF to_regclass('public.system_settings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT ''Thợ Đến Ngay''';
    EXECUTE 'ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS support_email TEXT DEFAULT ''support@thodenngay.vn''';
    EXECUTE 'ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS facebook_url TEXT DEFAULT ''https://facebook.com/thodenngay''';
    EXECUTE 'ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS zalo_url TEXT DEFAULT ''https://zalo.me/thodenngay''';
    EXECUTE 'ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS terms_url TEXT DEFAULT ''https://thodenngay.vn/terms''';
    EXECUTE 'ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS privacy_url TEXT DEFAULT ''https://thodenngay.vn/privacy''';
    EXECUTE 'ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS apk_backup_download_url TEXT DEFAULT ''https://raw.githubusercontent.com/tuananh9201/alo-tho/master/public/downloads/thodenngay.apk''';

    UPDATE public.system_settings
    SET
      app_name = CASE WHEN app_name IN ('Alo Thợ', 'Alo Thá»£') THEN 'Thợ Đến Ngay' ELSE app_name END,
      support_email = CASE WHEN support_email = 'support@alotho.vn' THEN 'support@thodenngay.vn' ELSE support_email END,
      facebook_url = CASE WHEN facebook_url = 'https://facebook.com/alotho' THEN 'https://facebook.com/thodenngay' ELSE facebook_url END,
      zalo_url = CASE WHEN zalo_url = 'https://zalo.me/alotho' THEN 'https://zalo.me/thodenngay' ELSE zalo_url END,
      terms_url = CASE WHEN terms_url = 'https://alotho.vn/terms' THEN 'https://thodenngay.vn/terms' ELSE terms_url END,
      privacy_url = CASE WHEN privacy_url = 'https://alotho.vn/privacy' THEN 'https://thodenngay.vn/privacy' ELSE privacy_url END,
      apk_backup_download_url = CASE
        WHEN COALESCE(apk_backup_download_url, '') = '' THEN 'https://raw.githubusercontent.com/tuananh9201/alo-tho/master/public/downloads/thodenngay.apk'
        ELSE apk_backup_download_url
      END
    WHERE id = 'default';
  END IF;
END;
$$;

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
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS profiles_normalized_phone_unique ON public.profiles(normalized_phone) WHERE normalized_phone IS NOT NULL';
  ELSE
    EXECUTE 'CREATE INDEX IF NOT EXISTS profiles_normalized_phone_idx ON public.profiles(normalized_phone) WHERE normalized_phone IS NOT NULL';
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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Owners view own units" ON public.worker_units;
CREATE POLICY "Owners view own units" ON public.worker_units
  FOR SELECT USING (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Owners create own units" ON public.worker_units;
CREATE POLICY "Owners create own units" ON public.worker_units
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners update own units" ON public.worker_units;
CREATE POLICY "Owners update own units" ON public.worker_units
  FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin()) WITH CHECK (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Members view unit teams" ON public.worker_teams;
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

DROP POLICY IF EXISTS "Owners manage unit teams" ON public.worker_teams;
CREATE POLICY "Owners manage unit teams" ON public.worker_teams
  FOR ALL USING (public.current_user_owns_unit(unit_id) OR public.is_admin())
  WITH CHECK (public.current_user_owns_unit(unit_id) OR public.is_admin());

DROP POLICY IF EXISTS "Members view memberships" ON public.worker_unit_members;
CREATE POLICY "Members view memberships" ON public.worker_unit_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.current_user_owns_unit(unit_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Owners manage memberships" ON public.worker_unit_members;
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

CREATE OR REPLACE FUNCTION public.request_worker_role(p_specialties TEXT[] DEFAULT '{}')
RETURNS public.workers AS $$
DECLARE
  existing_worker public.workers;
  requested_worker public.workers;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (auth.uid(), 'customer', TRUE)
  ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (auth.uid(), 'worker', TRUE)
  ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

  SELECT *
  INTO existing_worker
  FROM public.workers
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF existing_worker.id IS NOT NULL THEN
    UPDATE public.workers
    SET
      specialties = COALESCE(p_specialties, '{}'),
      status = CASE WHEN existing_worker.status = 'active' THEN existing_worker.status ELSE 'pending' END
    WHERE id = existing_worker.id
    RETURNING * INTO requested_worker;
  ELSE
    INSERT INTO public.workers (user_id, status, specialties)
    VALUES (auth.uid(), 'pending', COALESCE(p_specialties, '{}'))
    RETURNING * INTO requested_worker;
  END IF;

  RETURN requested_worker;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.request_worker_role(TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_worker_unit(
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_team_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  active_worker public.workers;
  created_unit_id UUID;
  created_team_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO active_worker
  FROM public.workers
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  IF active_worker.id IS NULL THEN
    RAISE EXCEPTION 'Only approved workers can create a worker unit';
  END IF;

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (auth.uid(), 'unit_owner', TRUE)
  ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

  INSERT INTO public.worker_units (owner_id, name, phone, normalized_phone, address)
  VALUES (
    auth.uid(),
    NULLIF(trim(p_name), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    public.normalize_phone(p_phone),
    NULLIF(trim(COALESCE(p_address, '')), '')
  )
  RETURNING id INTO created_unit_id;

  IF created_unit_id IS NULL THEN
    RAISE EXCEPTION 'Could not create worker unit';
  END IF;

  INSERT INTO public.worker_unit_members (unit_id, user_id, worker_id, member_role, status)
  VALUES (created_unit_id, auth.uid(), active_worker.id, 'owner', 'active')
  ON CONFLICT (unit_id, user_id) DO UPDATE
    SET member_role = 'owner',
        status = 'active',
        worker_id = active_worker.id;

  IF NULLIF(trim(COALESCE(p_team_name, '')), '') IS NOT NULL THEN
    INSERT INTO public.worker_teams (unit_id, lead_user_id, name)
    VALUES (created_unit_id, auth.uid(), trim(p_team_name))
    RETURNING id INTO created_team_id;

    UPDATE public.worker_unit_members
    SET team_id = created_team_id
    WHERE unit_id = created_unit_id
      AND user_id = auth.uid();
  END IF;

  RETURN created_unit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_worker_unit(TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_worker_unit_member_by_phone(
  p_unit_id UUID,
  p_phone TEXT,
  p_member_role TEXT DEFAULT 'worker',
  p_team_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  target_profile public.profiles;
  target_worker public.workers;
  created_member_id UUID;
  normalized_input_phone TEXT := public.normalize_phone(p_phone);
  safe_member_role TEXT := CASE
    WHEN p_member_role IN ('manager', 'lead_worker', 'assistant_worker', 'worker') THEN p_member_role
    ELSE 'worker'
  END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_user_owns_unit(p_unit_id) THEN
    RAISE EXCEPTION 'Only the unit owner can add members';
  END IF;

  IF normalized_input_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  SELECT *
  INTO target_profile
  FROM public.profiles
  WHERE normalized_phone = normalized_input_phone
     OR public.normalize_phone(phone) = normalized_input_phone
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'No existing account found for this phone number';
  END IF;

  SELECT *
  INTO target_worker
  FROM public.workers
  WHERE user_id = target_profile.id
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (target_profile.id, 'customer', TRUE)
  ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

  IF safe_member_role IN ('worker', 'lead_worker', 'assistant_worker') THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_profile.id, 'worker', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  IF safe_member_role = 'lead_worker' THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_profile.id, 'lead_worker', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  IF safe_member_role = 'assistant_worker' THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_profile.id, 'assistant_worker', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  IF safe_member_role = 'manager' THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_profile.id, 'unit_owner', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  INSERT INTO public.worker_unit_members (
    unit_id,
    team_id,
    user_id,
    worker_id,
    member_role,
    status,
    invited_phone,
    invited_normalized_phone
  )
  VALUES (
    p_unit_id,
    p_team_id,
    target_profile.id,
    target_worker.id,
    safe_member_role,
    'active',
    p_phone,
    normalized_input_phone
  )
  ON CONFLICT (unit_id, user_id) DO UPDATE
    SET team_id = EXCLUDED.team_id,
        worker_id = EXCLUDED.worker_id,
        member_role = EXCLUDED.member_role,
        status = 'active',
        invited_phone = EXCLUDED.invited_phone,
        invited_normalized_phone = EXCLUDED.invited_normalized_phone
  RETURNING id INTO created_member_id;

  RETURN created_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.add_worker_unit_member_by_phone(UUID, TEXT, TEXT, UUID) TO authenticated;

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
