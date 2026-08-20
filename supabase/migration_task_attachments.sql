-- Fix task attachment storage for the current tiengiaoviec schema.
-- This migration is safe to run more than once and does not reset existing data.
-- The current application schema stores work orders in public.jobs.

DO $$
BEGIN
  IF to_regclass('public.jobs') IS NULL THEN
    RAISE EXCEPTION 'Missing required table public.jobs. The current tiengiaoviec app stores assigned work in public.jobs, so this looks like the wrong Supabase project/schema or an older database. Aborting without creating public.jobs or changing data.';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Missing required table public.profiles. Aborting without changing data.';
  END IF;

  IF to_regclass('public.workers') IS NULL THEN
    RAISE EXCEPTION 'Missing required table public.workers. Aborting without changing data.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'public.jobs is missing required column id. Aborting without changing data.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'customer_id'
  ) THEN
    RAISE EXCEPTION 'public.jobs is missing required column customer_id. Aborting without changing data.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'worker_id'
  ) THEN
    RAISE EXCEPTION 'public.jobs is missing required column worker_id. Aborting without changing data.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workers' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workers' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'public.workers is missing required columns id/user_id. Aborting without changing data.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    RAISE EXCEPTION 'public.profiles is missing required columns id/role. Aborting without changing data.';
  END IF;
END $$;
DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION public.is_admin()
      RETURNS BOOLEAN
      LANGUAGE SQL
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND role = 'admin'
        );
      $body$;
    $fn$;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  file_size BIGINT NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'task_attachments_task_id_fkey'
      AND conrelid = 'public.task_attachments'::regclass
  ) THEN
    ALTER TABLE public.task_attachments
      ADD CONSTRAINT task_attachments_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES public.jobs(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS task_attachments_task_id_idx
  ON public.task_attachments(task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_can_access_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  can_access BOOLEAN := FALSE;
BEGIN
  IF to_regclass('public.jobs') IS NULL THEN
    RETURN FALSE;
  END IF;

  IF to_regprocedure('public.current_user_can_access_worker_data(uuid,text[])') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.jobs job
        WHERE job.id = $1
          AND (
            job.customer_id = auth.uid()
            OR public.is_admin()
            OR EXISTS (
              SELECT 1
              FROM public.workers worker
              WHERE worker.id = job.worker_id
                AND worker.user_id = auth.uid()
            )
            OR (
              job.worker_id IS NOT NULL
              AND public.current_user_can_access_worker_data(job.worker_id, ARRAY['owner','manager','technician']::TEXT[])
            )
          )
      )
    $sql$ INTO can_access USING p_task_id;
  ELSE
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.jobs job
        WHERE job.id = $1
          AND (
            job.customer_id = auth.uid()
            OR public.is_admin()
            OR EXISTS (
              SELECT 1
              FROM public.workers worker
              WHERE worker.id = job.worker_id
                AND worker.user_id = auth.uid()
            )
          )
      )
    $sql$ INTO can_access USING p_task_id;
  END IF;

  RETURN COALESCE(can_access, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_access_task(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_task(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users view task attachments by task access" ON public.task_attachments;
CREATE POLICY "Users view task attachments by task access"
ON public.task_attachments
FOR SELECT
USING (public.current_user_can_access_task(task_id));

DROP POLICY IF EXISTS "Admins manage task attachments" ON public.task_attachments;
CREATE POLICY "Admins manage task attachments"
ON public.task_attachments
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

DROP POLICY IF EXISTS "Users view task attachment files by task access" ON storage.objects;
CREATE POLICY "Users view task attachment files by task access"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.task_attachments attachment
    WHERE attachment.storage_path = storage.objects.name
      AND public.current_user_can_access_task(attachment.task_id)
  )
);

DROP POLICY IF EXISTS "Admins upload task attachment files" ON storage.objects;
CREATE POLICY "Admins upload task attachment files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'task-attachments' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update task attachment files" ON storage.objects;
CREATE POLICY "Admins update task attachment files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'task-attachments' AND public.is_admin())
WITH CHECK (bucket_id = 'task-attachments' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete task attachment files" ON storage.objects;
CREATE POLICY "Admins delete task attachment files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'task-attachments' AND public.is_admin());
