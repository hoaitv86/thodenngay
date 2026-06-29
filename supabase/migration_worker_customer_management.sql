-- Let a worker view only customer profiles connected to jobs assigned to that worker.
DROP POLICY IF EXISTS "Workers view assigned customer profiles" ON public.profiles;

CREATE POLICY "Workers view assigned customer profiles"
ON public.profiles
FOR SELECT
USING (
  role = 'customer'
  AND EXISTS (
    SELECT 1
    FROM public.jobs
    JOIN public.workers ON public.workers.id = public.jobs.worker_id
    WHERE public.jobs.customer_id = public.profiles.id
      AND public.workers.user_id = auth.uid()
  )
);
