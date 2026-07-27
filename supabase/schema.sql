-- ===== ALO THỢ DATABASE CLEAN RESET =====
-- Dọn dẹp các đối tượng cũ (Sử dụng CASCADE để xóa sạch các phụ thuộc)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.job_logs CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.ratings CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
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
  member_role TEXT NOT NULL CHECK (member_role IN ('owner', 'manager', 'lead_worker', 'assistant_worker', 'worker')) DEFAULT 'worker',
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
