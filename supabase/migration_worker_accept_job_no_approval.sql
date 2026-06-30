-- Accept worker jobs atomically without admin approval.
-- In the current schema, "pending" is the unassigned/new job state.

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Workers request pending jobs" ON public.jobs;

DROP POLICY IF EXISTS "Workers view unassigned pending jobs" ON public.jobs;
CREATE POLICY "Workers view unassigned pending jobs"
ON public.jobs
FOR SELECT
USING (
  status = 'pending'
  AND worker_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.workers
    WHERE workers.user_id = auth.uid()
      AND workers.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.worker_accept_job(
  p_job_id UUID,
  p_customer_gps_location JSONB DEFAULT NULL,
  p_worker_gps_location JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker public.workers%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_customer public.profiles%ROWTYPE;
  v_service public.services%ROWTYPE;
BEGIN
  SELECT *
  INTO v_worker
  FROM public.workers
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKER_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.jobs
  SET
    worker_id = v_worker.id,
    status = 'assigned',
    assigned_at = NOW(),
    customer_gps_location = COALESCE(p_customer_gps_location, customer_gps_location),
    worker_gps_location = COALESCE(p_worker_gps_location, worker_gps_location),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'pending'
    AND worker_id IS NULL
  RETURNING *
  INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOB_ALREADY_ACCEPTED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.job_logs (job_id, actor_id, action, metadata)
  VALUES (
    v_job.id,
    auth.uid(),
    'assigned',
    jsonb_build_object(
      'source', 'worker_accept_job',
      'worker_id', v_worker.id,
      'previous_status', 'pending',
      'new_status', 'assigned',
      'assigned_at', v_job.assigned_at,
      'approval_required', false
    )
  );

  SELECT *
  INTO v_customer
  FROM public.profiles
  WHERE id = v_job.customer_id;

  SELECT *
  INTO v_service
  FROM public.services
  WHERE id = v_job.service_id;

  RETURN to_jsonb(v_job)
    || jsonb_build_object(
      'customerName', COALESCE(v_customer.full_name, 'Khách hàng'),
      'customer', jsonb_build_object('phone', v_customer.phone),
      'serviceName', COALESCE(v_service.name, 'Dịch vụ'),
      'approvalRequired', false
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_accept_job(UUID, JSONB, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
