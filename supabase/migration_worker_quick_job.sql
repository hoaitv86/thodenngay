-- Let active workers create and immediately accept a job for an existing customer.
-- The customer is matched by phone because worker-facing RLS should not expose profiles directly.

CREATE OR REPLACE FUNCTION public.worker_create_quick_job(
  p_customer_phone TEXT,
  p_service_id UUID,
  p_address TEXT,
  p_description TEXT DEFAULT NULL,
  p_quoted_price NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker public.workers%ROWTYPE;
  v_customer public.profiles%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_job_code TEXT;
  v_phone TEXT;
  v_price NUMERIC;
BEGIN
  SELECT *
  INTO v_worker
  FROM public.workers
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chỉ thợ đang hoạt động mới có thể tạo việc nhanh.';
  END IF;

  v_phone := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  IF length(v_phone) < 8 THEN
    RAISE EXCEPTION 'Số điện thoại khách hàng không hợp lệ.';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.profiles
  WHERE role = 'customer'
    AND regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy khách hàng với số điện thoại này. Khách cần đăng ký hoặc cập nhật SĐT trước.';
  END IF;

  SELECT *
  INTO v_service
  FROM public.services
  WHERE id = p_service_id
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dịch vụ không hợp lệ hoặc đã bị tắt.';
  END IF;

  IF trim(coalesce(p_address, '')) = '' THEN
    RAISE EXCEPTION 'Vui lòng nhập địa chỉ làm việc.';
  END IF;

  v_price := coalesce(p_quoted_price, v_service.base_price);
  IF v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'Giá dịch vụ không hợp lệ.';
  END IF;

  LOOP
    v_job_code := 'FAST' || floor(100000 + random() * 900000)::int::text;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.jobs WHERE job_code = v_job_code
    );
  END LOOP;

  INSERT INTO public.jobs (
    job_code,
    customer_id,
    worker_id,
    service_id,
    address,
    scheduled_at,
    description,
    quoted_price,
    status,
    source,
    created_by
  )
  VALUES (
    v_job_code,
    v_customer.id,
    v_worker.id,
    v_service.id,
    trim(p_address),
    now(),
    nullif(trim(coalesce(p_description, '')), ''),
    v_price,
    'assigned',
    'app',
    auth.uid()
  )
  RETURNING * INTO v_job;

  RETURN jsonb_build_object(
    'id', v_job.id,
    'job_code', v_job.job_code,
    'status', v_job.status,
    'worker_id', v_job.worker_id,
    'customer_id', v_job.customer_id,
    'customerName', v_customer.full_name,
    'customerPhone', v_customer.phone,
    'service_id', v_job.service_id,
    'serviceName', v_service.name,
    'address', v_job.address,
    'scheduled_at', v_job.scheduled_at,
    'description', v_job.description,
    'quoted_price', v_job.quoted_price,
    'images', coalesce(v_job.images, '{}')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_create_quick_job(TEXT, UUID, TEXT, TEXT, NUMERIC) TO authenticated;

-- Fallback policy for API routes that insert directly with the worker session.
-- This keeps quick-job creation limited to active workers and existing customers
-- who are already connected to that worker through a previous job.
CREATE OR REPLACE FUNCTION public.worker_has_customer(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs existing_jobs
    JOIN public.workers worker_self ON worker_self.id = existing_jobs.worker_id
    WHERE worker_self.user_id = auth.uid()
      AND existing_jobs.customer_id = p_customer_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.worker_has_customer(UUID) TO authenticated;

DROP POLICY IF EXISTS "Workers create quick jobs for known customers" ON public.jobs;
CREATE POLICY "Workers create quick jobs for known customers"
ON public.jobs
FOR INSERT
WITH CHECK (
  worker_id IN (
    SELECT id
    FROM public.workers
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
  AND created_by = auth.uid()
  AND status IN ('assigned', 'pending')
  AND public.worker_has_customer(customer_id)
);
