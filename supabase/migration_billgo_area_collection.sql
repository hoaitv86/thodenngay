-- Shared area/sub-area structure for BillGo and future customer/job routing.
-- Safe for existing BillGo data: legacy customer_address is preserved.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  area_type TEXT NOT NULL DEFAULT 'commune' CHECK (area_type IN ('commune', 'ward', 'town', 'other')),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organization_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sub_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sub_area_type TEXT NOT NULL DEFAULT 'village' CHECK (sub_area_type IN ('village', 'hamlet', 'block', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.collector_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.areas(id) ON DELETE CASCADE,
  sub_area_id UUID REFERENCES public.sub_areas(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (area_id IS NOT NULL OR sub_area_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.billgo_area_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES public.billgo_subscriptions(id) ON DELETE CASCADE,
  old_area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  old_sub_area_id UUID REFERENCES public.sub_areas(id) ON DELETE SET NULL,
  new_area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  new_sub_area_id UUID REFERENCES public.sub_areas(id) ON DELETE SET NULL,
  old_address_detail TEXT,
  new_address_detail TEXT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.billgo_subscriptions
ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sub_area_id UUID REFERENCES public.sub_areas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS address_detail TEXT,
ADD COLUMN IF NOT EXISTS legacy_address TEXT;

UPDATE public.billgo_subscriptions
SET legacy_address = COALESCE(legacy_address, customer_address)
WHERE legacy_address IS NULL AND customer_address IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS areas_owner_name_idx
ON public.areas(COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS sub_areas_area_name_idx
ON public.sub_areas(area_id, lower(name));

CREATE INDEX IF NOT EXISTS areas_active_sort_idx ON public.areas(is_active, sort_order, name);
CREATE INDEX IF NOT EXISTS sub_areas_area_active_sort_idx ON public.sub_areas(area_id, is_active, sort_order, name);
CREATE INDEX IF NOT EXISTS collector_assignments_user_idx ON public.collector_assignments(user_id, is_active);
CREATE INDEX IF NOT EXISTS collector_assignments_area_idx ON public.collector_assignments(area_id, sub_area_id, is_active);
CREATE INDEX IF NOT EXISTS billgo_subscriptions_area_idx ON public.billgo_subscriptions(area_id, sub_area_id);
CREATE INDEX IF NOT EXISTS billgo_area_changes_subscription_idx ON public.billgo_area_changes(subscription_id, created_at DESC);

DROP TRIGGER IF EXISTS update_areas_updated_at ON public.areas;
CREATE TRIGGER update_areas_updated_at
BEFORE UPDATE ON public.areas
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_sub_areas_updated_at ON public.sub_areas;
CREATE TRIGGER update_sub_areas_updated_at
BEFORE UPDATE ON public.sub_areas
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_collector_assignments_updated_at ON public.collector_assignments;
CREATE TRIGGER update_collector_assignments_updated_at
BEFORE UPDATE ON public.collector_assignments
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE FUNCTION public.billgo_user_owns_area(p_area_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.areas area
    WHERE area.id = p_area_id
      AND area.owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.billgo_user_has_sub_area_assignment(p_area_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collector_assignments assignment
    JOIN public.sub_areas sub_area ON sub_area.id = assignment.sub_area_id
    WHERE sub_area.area_id = p_area_id
      AND assignment.user_id = p_user_id
      AND assignment.is_active
  );
$$;

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billgo_area_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all areas" ON public.areas;
DROP POLICY IF EXISTS "Workers view assigned or own areas" ON public.areas;
DROP POLICY IF EXISTS "Workers create own areas" ON public.areas;
DROP POLICY IF EXISTS "Workers update own areas" ON public.areas;
DROP POLICY IF EXISTS "Admins manage all sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Workers view assigned or own sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Workers create sub areas in own areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Workers update sub areas in own areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Admins manage collector assignments" ON public.collector_assignments;
DROP POLICY IF EXISTS "Workers view own collector assignments" ON public.collector_assignments;
DROP POLICY IF EXISTS "Admins manage BillGo area changes" ON public.billgo_area_changes;
DROP POLICY IF EXISTS "Workers view own BillGo area changes" ON public.billgo_area_changes;

CREATE POLICY "Admins manage all areas"
ON public.areas
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Workers view assigned or own areas"
ON public.areas
FOR SELECT
USING (is_active);

CREATE POLICY "Workers create own areas"
ON public.areas
FOR INSERT
WITH CHECK (
  owner_id = auth.uid()
  AND created_by = auth.uid()
);

CREATE POLICY "Workers update own areas"
ON public.areas
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins manage all sub areas"
ON public.sub_areas
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Workers view assigned or own sub areas"
ON public.sub_areas
FOR SELECT
USING (is_active);

CREATE POLICY "Workers create sub areas in own areas"
ON public.sub_areas
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND public.billgo_user_owns_area(sub_areas.area_id, auth.uid())
);

CREATE POLICY "Workers update sub areas in own areas"
ON public.sub_areas
FOR UPDATE
USING (public.billgo_user_owns_area(sub_areas.area_id, auth.uid()))
WITH CHECK (public.billgo_user_owns_area(sub_areas.area_id, auth.uid()));

CREATE POLICY "Admins manage collector assignments"
ON public.collector_assignments
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Workers view own collector assignments"
ON public.collector_assignments
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins manage BillGo area changes"
ON public.billgo_area_changes
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Workers view own BillGo area changes"
ON public.billgo_area_changes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.billgo_subscriptions subscription
    JOIN public.workers worker ON worker.id = subscription.worker_id
    WHERE subscription.id = billgo_area_changes.subscription_id
      AND worker.user_id = auth.uid()
  )
);
