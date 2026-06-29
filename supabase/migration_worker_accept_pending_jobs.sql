-- Allow active workers to request unassigned pending jobs.
-- The job remains pending so admins can approve it before it becomes active.

DROP POLICY IF EXISTS "Workers request pending jobs" ON public.jobs;

CREATE POLICY "Workers request pending jobs"
ON public.jobs
FOR UPDATE
USING (
  status = 'pending'
  AND worker_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.workers
    WHERE workers.user_id = auth.uid()
      AND workers.status = 'active'
  )
)
WITH CHECK (
  status = 'pending'
  AND worker_id IN (
    SELECT id
    FROM public.workers
    WHERE workers.user_id = auth.uid()
      AND workers.status = 'active'
  )
);
