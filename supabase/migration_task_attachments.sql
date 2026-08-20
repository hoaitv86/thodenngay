CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  file_size BIGINT NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_attachments_task_id_idx
  ON public.task_attachments(task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_can_access_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE jobs.id = p_task_id
      AND (
        jobs.customer_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.workers
          WHERE workers.id = jobs.worker_id
            AND workers.user_id = auth.uid()
        )
        OR public.current_user_can_access_worker_data(jobs.worker_id, ARRAY['owner','manager','technician']::TEXT[])
      )
  );
$$;

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
    FROM public.task_attachments
    WHERE task_attachments.storage_path = storage.objects.name
      AND public.current_user_can_access_task(task_attachments.task_id)
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
