-- ===== ALO THỢ DATABASE SCHEMA (PHASE 1) =====

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Extends Auth.Users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    address TEXT,
    role TEXT NOT NULL CHECK (role IN ('customer', 'worker', 'admin')) DEFAULT 'customer',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. WORKERS (Specialized info for technicians)
CREATE TABLE public.workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    specialties TEXT[] DEFAULT '{}',
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'blocked')) DEFAULT 'pending',
    avg_rating DECIMAL(3,2) DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    certificates TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. SERVICES (Service Catalog)
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    scheduled_at TIMESTAMPTZ NOT NULL,
    description TEXT,
    quoted_price DECIMAL(12,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'in_progress', 'done', 'cancelled')) DEFAULT 'pending',
    source TEXT NOT NULL CHECK (source IN ('app', 'call')) DEFAULT 'app',
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
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
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view their own profile, Admins view all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Workers: Everyone can view active workers, Admins view all
CREATE POLICY "Public view active workers" ON public.workers FOR SELECT USING (status = 'active');
CREATE POLICY "Admins view all workers" ON public.workers FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Services: Everyone can view active services
CREATE POLICY "Public view active services" ON public.services FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins manage services" ON public.services FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Jobs: Customers view own jobs, Workers view assigned jobs, Admins view all
CREATE POLICY "Customers view own jobs" ON public.jobs FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Workers view assigned jobs" ON public.jobs FOR SELECT USING (
    worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage all jobs" ON public.jobs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

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
