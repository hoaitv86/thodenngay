\set ON_ERROR_STOP on

-- Staging-only base schema for Tho Den Ngay inventory/BillGo bootstrap.
-- This intentionally does not run supabase/schema.sql because that file starts
-- with DROP ... CASCADE and later references feature tables before migrations
-- create them.

DO $$
BEGIN
  IF current_setting('app.bootstrap_project_ref', TRUE) <> 'ehlpxogxhahboeexfcpf' THEN
    RAISE EXCEPTION 'Refusing to run: pass -v ALLOW_STAGING_BOOTSTRAP=ehlpxogxhahboeexfcpf for the staging project.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  recovery_email TEXT,
  phone TEXT,
  normalized_phone TEXT,
  full_name TEXT NOT NULL,
  address TEXT,
  gps_location JSONB,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  last_location_at TIMESTAMPTZ,
  location_updated_at TIMESTAMPTZ,
  location_updated_by TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer', 'worker', 'admin')) DEFAULT 'customer',
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_normalized_phone_unique
  ON public.profiles(normalized_phone)
  WHERE normalized_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  specialties TEXT[] DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'blocked')) DEFAULT 'pending',
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  certificates TEXT,
  module_flags JSONB NOT NULL DEFAULT '{"billgo": false, "sales": false}'::jsonb,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

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
  module_flags JSONB NOT NULL DEFAULT '{"billgo": false, "sales": false}'::jsonb,
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
  member_role TEXT NOT NULL CHECK (member_role IN ('owner', 'manager', 'technician', 'bill_collector', 'sales_inventory')) DEFAULT 'technician',
  status TEXT NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'left')) DEFAULT 'active',
  invited_phone TEXT,
  invited_normalized_phone TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(unit_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  visible_to_customer BOOLEAN NOT NULL DEFAULT TRUE,
  visible_to_admin BOOLEAN NOT NULL DEFAULT TRUE,
  visible_to_worker BOOLEAN NOT NULL DEFAULT TRUE,
  home_warranty_12m_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (home_warranty_12m_price >= 0),
  home_warranty_24m_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (home_warranty_24m_price >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cms_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  display_locations TEXT[] NOT NULL DEFAULT '{footer}',
  content_type TEXT NOT NULL DEFAULT 'article' CHECK (content_type IN ('article', 'fixed_page')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.jobs (
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
  quoted_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'done', 'cancel_requested', 'cancelled')) DEFAULT 'pending',
  source TEXT NOT NULL CHECK (source IN ('app', 'call')) DEFAULT 'app',
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  images TEXT[] DEFAULT '{}',
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

CREATE TABLE IF NOT EXISTS public.job_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(job_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.profiles(id) NOT NULL,
  worker_id UUID REFERENCES public.workers(id) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_unit_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND COALESCE(status, 'active') <> 'blocked'
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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_cms_posts_updated_at ON public.cms_posts;
CREATE TRIGGER update_cms_posts_updated_at BEFORE UPDATE ON public.cms_posts FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_worker_units_updated_at ON public.worker_units;
CREATE TRIGGER update_worker_units_updated_at BEFORE UPDATE ON public.worker_units FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_worker_teams_updated_at ON public.worker_teams;
CREATE TRIGGER update_worker_teams_updated_at BEFORE UPDATE ON public.worker_teams FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_worker_unit_members_updated_at ON public.worker_unit_members;
CREATE TRIGGER update_worker_unit_members_updated_at BEFORE UPDATE ON public.worker_unit_members FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'requested_role', NEW.raw_user_meta_data->>'role', 'customer');
  phone_value TEXT := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone);
  worker_specs TEXT[] := '{}';
BEGIN
  INSERT INTO public.profiles (id, email, recovery_email, phone, normalized_phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'recovery_email', ''))), ''),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Anyone can view worker profiles" ON public.profiles;
CREATE POLICY "Anyone can view worker profiles" ON public.profiles FOR SELECT USING (
  role = 'worker'
  OR public.user_has_role(profiles.id, 'worker')
  OR public.user_has_role(profiles.id, 'lead_worker')
  OR public.user_has_role(profiles.id, 'assistant_worker')
);
DROP POLICY IF EXISTS "Workers view assigned customer profiles" ON public.profiles;
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
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
CREATE POLICY "Admins can delete all profiles" ON public.profiles FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Owners view own units" ON public.worker_units;
CREATE POLICY "Owners view own units" ON public.worker_units FOR SELECT USING (owner_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Owners create own units" ON public.worker_units;
CREATE POLICY "Owners create own units" ON public.worker_units FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "Owners update own units" ON public.worker_units;
CREATE POLICY "Owners update own units" ON public.worker_units FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin()) WITH CHECK (owner_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Members view unit teams" ON public.worker_teams;
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
DROP POLICY IF EXISTS "Owners manage unit teams" ON public.worker_teams;
CREATE POLICY "Owners manage unit teams" ON public.worker_teams FOR ALL USING (public.current_user_owns_unit(unit_id) OR public.is_admin()) WITH CHECK (public.current_user_owns_unit(unit_id) OR public.is_admin());
DROP POLICY IF EXISTS "Members view memberships" ON public.worker_unit_members;
CREATE POLICY "Members view memberships" ON public.worker_unit_members FOR SELECT USING (user_id = auth.uid() OR public.current_user_owns_unit(unit_id) OR public.is_admin());
DROP POLICY IF EXISTS "Owners manage memberships" ON public.worker_unit_members;
CREATE POLICY "Owners manage memberships" ON public.worker_unit_members FOR ALL USING (public.current_user_owns_unit(unit_id) OR public.is_admin()) WITH CHECK (public.current_user_owns_unit(unit_id) OR public.is_admin());

DROP POLICY IF EXISTS "Public view active workers" ON public.workers;
CREATE POLICY "Public view active workers" ON public.workers FOR SELECT USING (status = 'active');
DROP POLICY IF EXISTS "Workers view own record" ON public.workers;
CREATE POLICY "Workers view own record" ON public.workers FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Workers create own record" ON public.workers;
CREATE POLICY "Workers create own record" ON public.workers FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Workers update own record" ON public.workers;
CREATE POLICY "Workers update own record" ON public.workers FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins view all workers" ON public.workers;
CREATE POLICY "Admins view all workers" ON public.workers FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public view active services" ON public.services;
CREATE POLICY "Public view active services" ON public.services FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Admins manage all services" ON public.services;
CREATE POLICY "Admins manage all services" ON public.services FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Customers view own jobs" ON public.jobs;
CREATE POLICY "Customers view own jobs" ON public.jobs FOR SELECT USING (customer_id = auth.uid());
DROP POLICY IF EXISTS "Customers create jobs" ON public.jobs;
CREATE POLICY "Customers create jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = customer_id);
DROP POLICY IF EXISTS "Customers update own jobs" ON public.jobs;
CREATE POLICY "Customers update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = customer_id);
DROP POLICY IF EXISTS "Workers view assigned jobs" ON public.jobs;
CREATE POLICY "Workers view assigned jobs" ON public.jobs FOR SELECT USING (worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage all jobs" ON public.jobs;
CREATE POLICY "Admins manage all jobs" ON public.jobs FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Customers view own job services" ON public.job_services;
CREATE POLICY "Customers view own job services" ON public.job_services FOR SELECT USING (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_services.job_id AND jobs.customer_id = auth.uid()));
DROP POLICY IF EXISTS "Customers create own job services" ON public.job_services;
CREATE POLICY "Customers create own job services" ON public.job_services FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_services.job_id AND jobs.customer_id = auth.uid()));
DROP POLICY IF EXISTS "Workers view assigned job services" ON public.job_services;
CREATE POLICY "Workers view assigned job services" ON public.job_services FOR SELECT USING (EXISTS (SELECT 1 FROM public.jobs JOIN public.workers ON workers.id = jobs.worker_id WHERE jobs.id = job_services.job_id AND workers.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage all job services" ON public.job_services;
CREATE POLICY "Admins manage all job services" ON public.job_services FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
