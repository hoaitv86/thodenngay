DROP POLICY IF EXISTS "Workers log legacy job reopens" ON public.job_logs;

CREATE POLICY "Workers log legacy job reopens"
ON public.job_logs
FOR INSERT
WITH CHECK (
  actor_id = auth.uid()
  AND action = 'legacy_job_reopened'
  AND metadata->>'source' = 'worker_history_detail'
  AND EXISTS (
    SELECT 1
    FROM public.jobs legacy_job
    WHERE legacy_job.id = job_id
      AND legacy_job.status IN ('completed', 'done')
      AND (
        public.is_admin()
        OR public.current_user_can_access_worker_data(
          legacy_job.worker_id,
          ARRAY['owner','manager','technician']::TEXT[]
        )
      )
  )
);
