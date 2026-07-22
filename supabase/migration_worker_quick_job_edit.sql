-- Allow active workers to edit quick-job customer, service, address, and note before completion.
-- Existing operational data such as images, materials, payments, and job logs is intentionally untouched.

CREATE OR REPLACE FUNCTION public.worker_update_quick_job(
  p_job_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_service_ids UUID[] DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
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
  v_phone TEXT;
  v_service_ids UUID[];
  v_service_id UUID;
BEGIN
  SELECT *
  INTO v_worker
  FROM public.workers
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chỉ thợ đang hoạt động mới có thể sửa công việc.';
  END IF;

  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
    AND worker_id = v_worker.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy công việc đang làm.';
  END IF;

  IF v_job.status NOT IN ('assigned', 'in_progress') THEN
    RAISE EXCEPTION 'Công việc đã hoàn thành hoặc đã khóa, không thể sửa thông tin này.';
  END IF;

  IF p_service_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn dịch vụ.';
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

  v_service_ids := coalesce(p_service_ids, ARRAY[p_service_id]::UUID[]);
  IF array_length(v_service_ids, 1) IS NULL THEN
    v_service_ids := ARRAY[p_service_id]::UUID[];
  END IF;

  FOREACH v_service_id IN ARRAY v_service_ids LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.services
      WHERE id = v_service_id
        AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Danh sách dịch vụ có mục không hợp lệ hoặc đã bị tắt.';
    END IF;
  END LOOP;

  IF p_customer_id IS NOT NULL THEN
    SELECT *
    INTO v_customer
    FROM public.profiles
    WHERE id = p_customer_id
      AND role = 'customer'
    LIMIT 1;
  ELSE
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
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy khách hàng đã có. Hãy chọn khách cũ để tránh tạo trùng.';
  END IF;

  IF trim(coalesce(p_address, '')) = '' THEN
    RAISE EXCEPTION 'Vui lòng nhập địa chỉ làm việc.';
  END IF;

  UPDATE public.jobs
  SET
    customer_id = v_customer.id,
    service_id = v_service.id,
    address = trim(p_address),
    description = nullif(trim(coalesce(p_description, '')), '')
  WHERE id = v_job.id
    AND worker_id = v_worker.id
    AND status IN ('assigned', 'in_progress')
  RETURNING * INTO v_job;

  DELETE FROM public.job_services
  WHERE job_id = v_job.id;

  INSERT INTO public.job_services (job_id, service_id, sort_order)
  SELECT v_job.id, service_id, ordinal - 1
  FROM unnest(v_service_ids) WITH ORDINALITY AS selected(service_id, ordinal)
  ON CONFLICT (job_id, service_id) DO UPDATE
  SET sort_order = EXCLUDED.sort_order;

  RETURN jsonb_build_object(
    'id', v_job.id,
    'job_code', v_job.job_code,
    'status', v_job.status,
    'worker_id', v_job.worker_id,
    'customer_id', v_job.customer_id,
    'customerName', v_customer.full_name,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'full_name', v_customer.full_name,
      'phone', v_customer.phone,
      'email', v_customer.email,
      'address', v_customer.address
    ),
    'service_id', v_job.service_id,
    'serviceName', v_service.name,
    'service', jsonb_build_object(
      'id', v_service.id,
      'name', v_service.name,
      'icon', v_service.icon,
      'base_price', v_service.base_price,
      'parent_service_id', v_service.parent_service_id
    ),
    'address', v_job.address,
    'description', v_job.description,
    'quoted_price', v_job.quoted_price,
    'workflow_data', v_job.workflow_data,
    'images', coalesce(v_job.images, '{}'),
    'job_services', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'service', jsonb_build_object(
              'id', service_items.id,
              'name', service_items.name,
              'icon', service_items.icon,
              'base_price', service_items.base_price,
              'parent_service_id', service_items.parent_service_id
            )
          )
          ORDER BY selected.ordinal
        ),
        '[]'::jsonb
      )
      FROM unnest(v_service_ids) WITH ORDINALITY AS selected(service_id, ordinal)
      JOIN public.services service_items ON service_items.id = selected.service_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_update_quick_job(UUID, UUID, TEXT, TEXT, UUID, UUID[], TEXT, TEXT) TO authenticated;
