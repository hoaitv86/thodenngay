-- Allow service catalog hierarchy and make admin write permissions explicit.
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS parent_service_id UUID REFERENCES public.services(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Admins manage services" ON public.services;
DROP POLICY IF EXISTS "Admins view all services" ON public.services;
DROP POLICY IF EXISTS "Admins create services" ON public.services;
DROP POLICY IF EXISTS "Admins update services" ON public.services;
DROP POLICY IF EXISTS "Admins delete services" ON public.services;

CREATE POLICY "Admins view all services"
ON public.services
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins create services"
ON public.services
FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update services"
ON public.services
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete services"
ON public.services
FOR DELETE
USING (public.is_admin());
