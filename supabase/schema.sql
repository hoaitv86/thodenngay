-- ===== ALO THỢ DATABASE CLEAN RESET =====
-- Dọn dẹp các đối tượng cũ (Sử dụng CASCADE để xóa sạch các phụ thuộc)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.job_logs CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.ratings CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.worker_unit_members CASCADE;
DROP TABLE IF EXISTS public.worker_teams CASCADE;
DROP TABLE IF EXISTS public.worker_units CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.workers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ===== ALO THỢ DATABASE SCHEMA (PHASE 1) =====

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Extends Auth.Users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    normalized_phone TEXT,
    full_name TEXT NOT NULL,
    address TEXT,
    gps_location JSONB,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    last_location_at TIMESTAMPTZ,
    location_updated_by TEXT,
    role TEXT NOT NULL CHECK (role IN ('customer', 'worker', 'admin')) DEFAULT 'customer',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX profiles_normalized_phone_unique
  ON public.profiles(normalized_phone)
  WHERE normalized_phone IS NOT NULL;

-- 2. WORKERS (Specialized info for technicians)
CREATE TABLE public.workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    specialties TEXT[] DEFAULT '{}',
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'blocked')) DEFAULT 'pending',
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    certificates TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.user_roles (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'worker', 'admin', 'unit_owner', 'lead_worker', 'assistant_worker')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE public.worker_units (
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

CREATE TABLE public.worker_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES public.worker_units(id) ON DELETE CASCADE NOT NULL,
  lead_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  service_area TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.worker_unit_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES public.worker_units(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.worker_teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  member_role TEXT NOT NULL CHECK (member_role IN ('owner', 'manager', 'technician', 'bill_collector', 'sales_inventory')) DEFAULT 'technician',
  status TEXT NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'left')) DEFAULT 'active',
  invited_phone TEXT,
  invited_normalized_phone TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(unit_id, user_id)
);

-- 3. SERVICES (Service Catalog)
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    base_price DECIMAL(12,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. JOBS (Transactions)
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_code TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.profiles(id) NOT NULL,
    worker_id UUID REFERENCES public.workers(id),
    service_id UUID REFERENCES public.services(id) NOT NULL,
    address TEXT NOT NULL,
    gps_location JSONB DEFAULT '{"lat": 10.762622, "lng": 106.660172}',
    customer_gps_location JSONB,
    worker_gps_location JSONB,
    assigned_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ NOT NULL,
    description TEXT,
    quoted_price DECIMAL(12,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'done', 'cancel_requested', 'cancelled')) DEFAULT 'pending',
    source TEXT NOT NULL CHECK (source IN ('app', 'call')) DEFAULT 'app',
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    completion_items JSONB DEFAULT '[]'::jsonb,
    workflow_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    final_amount DECIMAL(12,2),
    warranty_days INTEGER DEFAULT 0,
    warranty_note TEXT,
    cancellation_reason TEXT,
    cancellation_requested_by UUID REFERENCES public.profiles(id),
    cancellation_requested_at TIMESTAMPTZ,
    cancellation_reviewed_by UUID REFERENCES public.profiles(id),
    cancellation_reviewed_at TIMESTAMPTZ,
    cancellation_review_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.job_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(job_id, service_id)
);

-- 5. RATINGS
CREATE TABLE public.ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.profiles(id) NOT NULL,
    worker_id UUID REFERENCES public.workers(id) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. PAYMENTS (Logging only for Phase 1)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('cash', 'transfer')) DEFAULT 'cash',
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. JOB LOGS (Audit Trail)
CREATE TABLE public.job_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ===== RLS (ROW LEVEL SECURITY) =====

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_unit_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;

-- Function to check if user is admin (prevents recursion in profiles policy)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.normalize_phone(input_phone TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(regexp_replace(COALESCE(input_phone, ''), '\D', '', 'g'), '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

-- Profiles: Users can view their own profile, Admins view all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Anyone can view worker profiles" ON public.profiles FOR SELECT USING (
  role = 'worker'
  OR public.user_has_role(profiles.id, 'worker')
  OR public.user_has_role(profiles.id, 'lead_worker')
  OR public.user_has_role(profiles.id, 'assistant_worker')
);
CREATE POLICY "Workers view assigned customer profiles" ON public.profiles FOR SELECT USING (
  role = 'customer'
  AND EXISTS (
    SELECT 1
    FROM public.jobs
    JOIN public.workers ON public.workers.id = public.jobs.worker_id
    WHERE public.jobs.customer_id = public.profiles.id
      AND public.workers.user_id = auth.uid()
  )
);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete all profiles" ON public.profiles FOR DELETE USING (public.is_admin());

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Owners view own units" ON public.worker_units FOR SELECT USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "Owners create own units" ON public.worker_units FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update own units" ON public.worker_units FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin()) WITH CHECK (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Members view unit teams" ON public.worker_teams FOR SELECT USING (
  public.current_user_owns_unit(unit_id)
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.worker_unit_members
    WHERE worker_unit_members.unit_id = worker_teams.unit_id
      AND worker_unit_members.user_id = auth.uid()
      AND worker_unit_members.status = 'active'
  )
);
CREATE POLICY "Owners manage unit teams" ON public.worker_teams FOR ALL USING (public.current_user_owns_unit(unit_id) OR public.is_admin()) WITH CHECK (public.current_user_owns_unit(unit_id) OR public.is_admin());

CREATE POLICY "Members view memberships" ON public.worker_unit_members FOR SELECT USING (
  user_id = auth.uid()
  OR public.current_user_owns_unit(unit_id)
  OR public.is_admin()
);
CREATE POLICY "Owners manage memberships" ON public.worker_unit_members FOR ALL USING (public.current_user_owns_unit(unit_id) OR public.is_admin()) WITH CHECK (public.current_user_owns_unit(unit_id) OR public.is_admin());

-- Workers: Everyone can view active workers, Admins view all
CREATE POLICY "Public view active workers" ON public.workers FOR SELECT USING (status = 'active');
CREATE POLICY "Workers view own record" ON public.workers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Workers create own record" ON public.workers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Workers update own record" ON public.workers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins view all workers" ON public.workers FOR ALL USING (public.is_admin());

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
  p_member_role TEXT DEFAULT 'technician',
  p_team_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  target_profile public.profiles;
  target_worker public.workers;
  created_member_id UUID;
  normalized_input_phone TEXT := public.normalize_phone(p_phone);
  safe_member_role TEXT := CASE
    WHEN p_member_role IN ('manager', 'technician', 'bill_collector', 'sales_inventory') THEN p_member_role
    WHEN p_member_role IN ('lead_worker', 'assistant_worker', 'worker') THEN 'technician'
    ELSE 'technician'
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

  IF safe_member_role IN ('technician', 'bill_collector', 'sales_inventory') THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_profile.id, 'worker', TRUE)
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

CREATE OR REPLACE FUNCTION public.update_worker_unit_member_role(
  p_member_id UUID,
  p_member_role TEXT
)
RETURNS UUID AS $$
DECLARE
  target_member public.worker_unit_members;
  safe_member_role TEXT := CASE
    WHEN p_member_role IN ('manager', 'technician', 'bill_collector', 'sales_inventory') THEN p_member_role
    WHEN p_member_role IN ('lead_worker', 'assistant_worker', 'worker') THEN 'technician'
    ELSE NULL
  END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF safe_member_role IS NULL THEN
    RAISE EXCEPTION 'Invalid member role';
  END IF;

  SELECT *
  INTO target_member
  FROM public.worker_unit_members
  WHERE id = p_member_id;

  IF target_member.id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF target_member.member_role = 'owner' THEN
    RAISE EXCEPTION 'Owner role cannot be changed';
  END IF;

  IF NOT public.current_user_owns_unit(target_member.unit_id) THEN
    RAISE EXCEPTION 'Only the unit owner can update members';
  END IF;

  UPDATE public.worker_unit_members
  SET member_role = safe_member_role,
      updated_at = NOW()
  WHERE id = p_member_id
  RETURNING * INTO target_member;

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (target_member.user_id, 'customer', TRUE)
  ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

  IF safe_member_role IN ('technician', 'bill_collector', 'sales_inventory') THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_member.user_id, 'worker', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  IF safe_member_role = 'manager' THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_member.user_id, 'unit_owner', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  RETURN target_member.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_worker_unit_member_role(UUID, TEXT) TO authenticated;


-- Services: Everyone can view active services, admins can manage the catalog
CREATE POLICY "Public view active services" ON public.services FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins view all services" ON public.services FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins create services" ON public.services FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins update services" ON public.services FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete services" ON public.services FOR DELETE USING (public.is_admin());

-- Jobs: Customers view/create/update own jobs, Workers view assigned jobs, Admins manage all
CREATE POLICY "Customers view own jobs" ON public.jobs FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Customers create jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = customer_id);
CREATE POLICY "Workers view assigned jobs" ON public.jobs FOR SELECT USING (
    worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage all jobs" ON public.jobs FOR ALL USING (public.is_admin());

CREATE POLICY "Customers view own job services" ON public.job_services FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_services.job_id AND jobs.customer_id = auth.uid())
);
CREATE POLICY "Customers create own job services" ON public.job_services FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_services.job_id AND jobs.customer_id = auth.uid())
);
CREATE POLICY "Workers view assigned job services" ON public.job_services FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.jobs
        JOIN public.workers ON workers.id = jobs.worker_id
        WHERE jobs.id = job_services.job_id AND workers.user_id = auth.uid()
    )
);
CREATE POLICY "Admins manage all job services" ON public.job_services FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

/*

-- 8. AUTO-CREATE PROFILE ON SIGN UP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Người dùng'), 
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  
  -- If worker, also create worker record
  IF (NEW.raw_user_meta_data->>'role') = 'worker' THEN
    DECLARE
      worker_specs TEXT[] := '{}';
    BEGIN
      IF NEW.raw_user_meta_data ? 'specialties' AND NEW.raw_user_meta_data->'specialties' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'specialties') = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'specialties')) INTO worker_specs;
      END IF;

      INSERT INTO public.workers (user_id, status, specialties)
      VALUES (NEW.id, 'pending', worker_specs);
    END;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

*/

CREATE TRIGGER update_worker_units_updated_at BEFORE UPDATE ON public.worker_units FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_worker_teams_updated_at BEFORE UPDATE ON public.worker_teams FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_worker_unit_members_updated_at BEFORE UPDATE ON public.worker_unit_members FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_profile_normalized_phone()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_phone = public.normalize_phone(NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_profiles_normalized_phone
  BEFORE INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_normalized_phone();

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
    VALUES (NEW.id, 'pending', worker_specs);
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Worker unit role access policies appended from migration_worker_unit_role_access.sql
-- Enforce worker unit roles across data access, not just UI visibility.

CREATE OR REPLACE FUNCTION public.current_user_can_access_worker_data(
  p_worker_id UUID,
  p_roles TEXT[] DEFAULT ARRAY['owner','manager','technician','bill_collector','sales_inventory']::TEXT[]
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = p_worker_id
      AND worker.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.worker_unit_members member
    JOIN public.worker_units unit ON unit.id = member.unit_id
    JOIN public.workers owner_worker ON owner_worker.user_id = unit.owner_id
    WHERE owner_worker.id = p_worker_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role = ANY(p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_billgo_assignment(
  p_area_id UUID,
  p_sub_area_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collector_assignments assignment
    WHERE assignment.user_id = auth.uid()
      AND assignment.is_active
      AND (
        (p_sub_area_id IS NOT NULL AND assignment.sub_area_id = p_sub_area_id)
        OR (p_area_id IS NOT NULL AND assignment.area_id = p_area_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_billgo_row(
  p_worker_id UUID,
  p_area_id UUID,
  p_sub_area_id UUID,
  p_write BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_can_access_worker_data(p_worker_id, ARRAY['owner','manager']::TEXT[])
    OR (
      NOT p_write
      AND public.current_user_can_access_worker_data(p_worker_id, ARRAY['bill_collector']::TEXT[])
      AND public.current_user_has_billgo_assignment(p_area_id, p_sub_area_id)
    )
    OR (
      p_write
      AND public.current_user_can_access_worker_data(p_worker_id, ARRAY['bill_collector']::TEXT[])
      AND public.current_user_has_billgo_assignment(p_area_id, p_sub_area_id)
    );
$$;

-- Areas and assignments
DROP POLICY IF EXISTS "Workers view assigned or own areas" ON public.areas;
DROP POLICY IF EXISTS "Workers create own areas" ON public.areas;
DROP POLICY IF EXISTS "Workers update own areas" ON public.areas;
DROP POLICY IF EXISTS "Workers view assigned or own sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Workers create sub areas in own areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Workers update sub areas in own areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Workers view own collector assignments" ON public.collector_assignments;
DROP POLICY IF EXISTS "Unit managers view own or assigned areas" ON public.areas;
DROP POLICY IF EXISTS "Unit managers create own areas" ON public.areas;
DROP POLICY IF EXISTS "Unit managers update own areas" ON public.areas;
DROP POLICY IF EXISTS "Unit managers view own or assigned sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Unit managers create own sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Unit managers update own sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Unit members view collector assignments" ON public.collector_assignments;
DROP POLICY IF EXISTS "Unit managers manage collector assignments" ON public.collector_assignments;

CREATE POLICY "Unit managers view own or assigned areas" ON public.areas
FOR SELECT USING (
  public.is_admin()
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.worker_unit_members member
    JOIN public.worker_units unit ON unit.id = member.unit_id
    WHERE unit.owner_id = areas.owner_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
  OR public.current_user_has_billgo_assignment(id, NULL)
  OR EXISTS (
    SELECT 1 FROM public.collector_assignments assignment
    JOIN public.sub_areas sub_area ON sub_area.id = assignment.sub_area_id
    WHERE sub_area.area_id = areas.id
      AND assignment.user_id = auth.uid()
      AND assignment.is_active
  )
);

CREATE POLICY "Unit managers create own areas" ON public.areas
FOR INSERT WITH CHECK (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.worker_unit_members member
    JOIN public.worker_units unit ON unit.id = member.unit_id
    WHERE unit.owner_id = areas.owner_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit managers update own areas" ON public.areas
FOR UPDATE USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.worker_unit_members member
    JOIN public.worker_units unit ON unit.id = member.unit_id
    WHERE unit.owner_id = areas.owner_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
) WITH CHECK (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.worker_unit_members member
    JOIN public.worker_units unit ON unit.id = member.unit_id
    WHERE unit.owner_id = areas.owner_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit managers view own or assigned sub areas" ON public.sub_areas
FOR SELECT USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.areas area WHERE area.id = sub_areas.area_id AND area.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = sub_areas.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
  OR public.current_user_has_billgo_assignment(area_id, id)
);

CREATE POLICY "Unit managers create own sub areas" ON public.sub_areas
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.areas area WHERE area.id = sub_areas.area_id AND area.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = sub_areas.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit managers update own sub areas" ON public.sub_areas
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.areas area WHERE area.id = sub_areas.area_id AND area.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = sub_areas.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.areas area WHERE area.id = sub_areas.area_id AND area.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = sub_areas.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit members view collector assignments" ON public.collector_assignments
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = collector_assignments.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit managers manage collector assignments" ON public.collector_assignments
FOR ALL USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = collector_assignments.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
) WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = collector_assignments.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

-- BillGo data
DROP POLICY IF EXISTS "Workers view own BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Workers create own BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Workers update own BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Workers view own BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Workers create own BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Workers update own BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Unit members view BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Unit managers manage BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Unit members view BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Unit collectors update assigned BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Unit managers manage BillGo receivables" ON public.billgo_receivables;

CREATE POLICY "Unit members view BillGo subscriptions" ON public.billgo_subscriptions
FOR SELECT USING (public.current_user_can_access_billgo_row(worker_id, area_id, sub_area_id, FALSE));

CREATE POLICY "Unit managers manage BillGo subscriptions" ON public.billgo_subscriptions
FOR ALL USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager']::TEXT[]));

CREATE POLICY "Unit members view BillGo receivables" ON public.billgo_receivables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.billgo_subscriptions subscription
    WHERE subscription.id = billgo_receivables.subscription_id
      AND public.current_user_can_access_billgo_row(billgo_receivables.worker_id, subscription.area_id, subscription.sub_area_id, FALSE)
  )
);

CREATE POLICY "Unit collectors update assigned BillGo receivables" ON public.billgo_receivables
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.billgo_subscriptions subscription
    WHERE subscription.id = billgo_receivables.subscription_id
      AND public.current_user_can_access_billgo_row(billgo_receivables.worker_id, subscription.area_id, subscription.sub_area_id, TRUE)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.billgo_subscriptions subscription
    WHERE subscription.id = billgo_receivables.subscription_id
      AND public.current_user_can_access_billgo_row(billgo_receivables.worker_id, subscription.area_id, subscription.sub_area_id, TRUE)
  )
);

CREATE POLICY "Unit managers manage BillGo receivables" ON public.billgo_receivables
FOR ALL USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager']::TEXT[]));

-- Inventory and sales
DROP POLICY IF EXISTS "Workers view own inventory products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Workers create own inventory products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Workers update own inventory products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Workers delete own inventory products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Unit inventory members view products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Unit inventory members manage products" ON public.worker_inventory_products;

CREATE POLICY "Unit inventory members view products" ON public.worker_inventory_products
FOR SELECT USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));
CREATE POLICY "Unit inventory members manage products" ON public.worker_inventory_products
FOR ALL USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));

DROP POLICY IF EXISTS "Workers view own sales orders" ON public.worker_sales_orders;
DROP POLICY IF EXISTS "Workers view own sales order items" ON public.worker_sales_order_items;
DROP POLICY IF EXISTS "Unit sales members view orders" ON public.worker_sales_orders;
DROP POLICY IF EXISTS "Unit sales members view order items" ON public.worker_sales_order_items;

CREATE POLICY "Unit sales members view orders" ON public.worker_sales_orders
FOR SELECT USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));
CREATE POLICY "Unit sales members view order items" ON public.worker_sales_order_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_sales_orders sales_order
    WHERE sales_order.id = worker_sales_order_items.order_id
      AND public.current_user_can_access_worker_data(sales_order.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[])
  )
);

-- Jobs: technicians only their assigned worker rows; owner/manager can inspect unit-owner rows.
DROP POLICY IF EXISTS "Workers view own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Workers update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Unit job members view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Unit job members update jobs" ON public.jobs;

CREATE POLICY "Unit job members view jobs" ON public.jobs
FOR SELECT USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[]));
CREATE POLICY "Unit job members update jobs" ON public.jobs
FOR UPDATE USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[]));

-- Unit-aware sales order RPC for sales/inventory members.
CREATE OR REPLACE FUNCTION public.create_worker_sales_order(
  p_customer_id UUID,
  p_note TEXT,
  p_items JSONB,
  p_create_billgo BOOLEAN DEFAULT FALSE,
  p_billgo_cycle TEXT DEFAULT 'monthly',
  p_billgo_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
  v_order_id UUID;
  v_item_id UUID;
  v_sale_code TEXT;
  v_item JSONB;
  v_product RECORD;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC(14, 2);
  v_line_total NUMERIC(14, 2);
  v_total_amount NUMERIC(14, 2) := 0;
  v_billgo_total NUMERIC(14, 2) := 0;
  v_billgo_period_end DATE;
  v_billgo_due_date DATE;
  v_subscription_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ban chua dang nhap.';
  END IF;

  SELECT owner_worker.id INTO v_worker_id
  FROM public.worker_unit_members member
  JOIN public.worker_units unit ON unit.id = member.unit_id
  JOIN public.workers owner_worker ON owner_worker.user_id = unit.owner_id
  WHERE member.user_id = auth.uid()
    AND member.status = 'active'
    AND member.member_role IN ('owner', 'manager', 'sales_inventory')
  ORDER BY CASE member.member_role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_worker_id IS NULL THEN
    SELECT id INTO v_worker_id
    FROM public.workers
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay ho so tho hoac don vi duoc cap quyen.';
  END IF;

  IF p_billgo_cycle NOT IN ('monthly', 'three_months', 'six_months', 'yearly') THEN
    RAISE EXCEPTION 'Chu ky BillGo khong hop le.';
  END IF;

  IF p_customer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_customer_id AND role = 'customer'
  ) THEN
    RAISE EXCEPTION 'Khach hang khong hop le.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs WHERE worker_id = v_worker_id AND customer_id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'Khach hang chua nam trong danh sach phuc vu cua tho.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Vui long chon it nhat mot san pham.';
  END IF;

  v_sale_code := 'SALE-' || to_char(NOW(), 'YYMMDD-HH24MISS') || '-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6));

  INSERT INTO public.worker_sales_orders (worker_id, customer_id, sale_code, total_amount, note, created_by)
  VALUES (v_worker_id, p_customer_id, v_sale_code, 0, NULLIF(trim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unitPrice')::NUMERIC(14, 2);

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Thong tin san pham khong hop le.';
    END IF;

    SELECT * INTO v_product
    FROM public.worker_inventory_products
    WHERE id = v_product_id AND worker_id = v_worker_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'San pham khong ton tai trong kho.';
    END IF;

    IF v_product.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'San pham % khong du ton kho.', v_product.name;
    END IF;

    UPDATE public.worker_inventory_products
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_product.id;

    v_line_total := v_quantity * v_unit_price;
    v_total_amount := v_total_amount + v_line_total;

    INSERT INTO public.worker_sales_order_items (
      order_id, product_id, product_name, product_sku, category, unit, quantity, unit_price, line_total
    )
    VALUES (
      v_order_id, v_product.id, v_product.name, v_product.sku, v_product.category, v_product.unit,
      v_quantity, v_unit_price, v_line_total
    )
    RETURNING id INTO v_item_id;

    IF COALESCE(v_product.warranty_months, 0) > 0 THEN
      INSERT INTO public.worker_product_warranties (
        worker_id, customer_id, sales_order_id, sales_order_item_id, product_id,
        product_name, product_sku, warranty_months, warranty_start, warranty_end, created_by
      )
      VALUES (
        v_worker_id, p_customer_id, v_order_id, v_item_id, v_product.id,
        v_product.name, v_product.sku, v_product.warranty_months,
        CURRENT_DATE, (CURRENT_DATE + (v_product.warranty_months::TEXT || ' months')::INTERVAL)::DATE, auth.uid()
      );
    END IF;

    IF p_create_billgo AND COALESCE(v_product.is_recurring_billgo, FALSE) THEN
      v_billgo_total := v_billgo_total + v_line_total;
    END IF;
  END LOOP;

  UPDATE public.worker_sales_orders SET total_amount = v_total_amount WHERE id = v_order_id;

  IF p_create_billgo AND v_billgo_total > 0 THEN
    v_billgo_period_end := CASE p_billgo_cycle
      WHEN 'three_months' THEN (p_billgo_start_date + INTERVAL '3 months')::DATE
      WHEN 'six_months' THEN (p_billgo_start_date + INTERVAL '6 months')::DATE
      WHEN 'yearly' THEN (p_billgo_start_date + INTERVAL '12 months')::DATE
      ELSE (p_billgo_start_date + INTERVAL '1 month')::DATE
    END;
    v_billgo_due_date := (date_trunc('month', v_billgo_period_end)::DATE + INTERVAL '1 month 19 days')::DATE;

    INSERT INTO public.billgo_subscriptions (
      customer_id, worker_id, customer_name, internet_account, customer_address,
      package_name, service_type, cycle, amount_per_cycle, start_date, next_due_date, note, created_by
    )
    SELECT
      p_customer_id, v_worker_id, profiles.full_name, 'SALE-' || v_order_id::TEXT, profiles.address,
      'Thu định kỳ đơn ' || v_sale_code, 'sales_recurring', p_billgo_cycle, v_billgo_total,
      p_billgo_start_date, v_billgo_due_date, 'Tao tu don ban ' || v_sale_code, auth.uid()
    FROM public.profiles
    WHERE profiles.id = p_customer_id
    RETURNING id INTO v_subscription_id;

    INSERT INTO public.billgo_receivables (
      customer_id, worker_id, subscription_id, type, title, total_amount, due_date,
      period_start, period_end, billing_months, status, note, created_by
    )
    VALUES (
      p_customer_id, v_worker_id, v_subscription_id, 'subscription_fee',
      'Thu định kỳ đơn ' || v_sale_code, v_billgo_total, v_billgo_due_date,
      p_billgo_start_date, v_billgo_period_end,
      CASE p_billgo_cycle WHEN 'three_months' THEN 3 WHEN 'six_months' THEN 6 WHEN 'yearly' THEN 12 ELSE 1 END,
      'unpaid', 'Tao tu don ban ' || v_sale_code, auth.uid()
    );
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB, BOOLEAN, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB, BOOLEAN, TEXT, DATE) TO authenticated;
