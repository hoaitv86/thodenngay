-- Smart Service Workflow Engine.
-- Adds multi-service jobs and structured workflow data while preserving legacy jobs.service_id.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS workflow_data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.job_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, service_id)
);

CREATE INDEX IF NOT EXISTS job_services_job_id_idx ON public.job_services(job_id);
CREATE INDEX IF NOT EXISTS job_services_service_id_idx ON public.job_services(service_id);

INSERT INTO public.job_services (job_id, service_id, sort_order)
SELECT jobs.id, jobs.service_id, 0
FROM public.jobs
WHERE jobs.service_id IS NOT NULL
ON CONFLICT (job_id, service_id) DO NOTHING;

ALTER TABLE public.job_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers view own job services" ON public.job_services;
DROP POLICY IF EXISTS "Customers create own job services" ON public.job_services;
DROP POLICY IF EXISTS "Workers view assigned job services" ON public.job_services;
DROP POLICY IF EXISTS "Admins manage all job services" ON public.job_services;

CREATE POLICY "Customers view own job services"
ON public.job_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_services.job_id
      AND jobs.customer_id = auth.uid()
  )
);

CREATE POLICY "Customers create own job services"
ON public.job_services
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_services.job_id
      AND jobs.customer_id = auth.uid()
  )
);

CREATE POLICY "Workers view assigned job services"
ON public.job_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs
    JOIN public.workers ON workers.id = jobs.worker_id
    WHERE jobs.id = job_services.job_id
      AND workers.user_id = auth.uid()
  )
);

DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins manage all job services" ON public.job_services;
    CREATE POLICY "Admins manage all job services"
    ON public.job_services
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.billgo_subscriptions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Workers create own BillGo subscriptions" ON public.billgo_subscriptions';
    EXECUTE '
      CREATE POLICY "Workers create own BillGo subscriptions"
      ON public.billgo_subscriptions
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.workers
          WHERE workers.id = billgo_subscriptions.worker_id
            AND workers.user_id = auth.uid()
        )
      )
    ';
  END IF;

  IF to_regclass('public.billgo_receivables') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Workers create own BillGo receivables" ON public.billgo_receivables';
    EXECUTE '
      CREATE POLICY "Workers create own BillGo receivables"
      ON public.billgo_receivables
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.workers
          WHERE workers.id = billgo_receivables.worker_id
            AND workers.user_id = auth.uid()
        )
      )
    ';
  END IF;
END $$;
