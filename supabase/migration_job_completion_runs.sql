-- Ensure worker access helper exists for older databases that have not run migration_worker_unit_role_access.sql yet.
DO $$
BEGIN
  IF to_regprocedure('public.current_user_can_access_worker_data(uuid,text[])') IS NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.current_user_can_access_worker_data(
        p_worker_id UUID,
        p_roles TEXT[] DEFAULT ARRAY['owner','manager','technician','bill_collector','sales_inventory']::TEXT[]
      )
      RETURNS BOOLEAN
      LANGUAGE SQL
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.workers worker
          WHERE worker.id = p_worker_id
            AND worker.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.worker_unit_members member
          JOIN public.worker_units unit ON unit.id = member.unit_id
          JOIN public.workers owner_worker ON owner_worker.user_id = unit.owner_id
          WHERE owner_worker.id = p_worker_id
            AND member.user_id = auth.uid()
            AND member.status = 'active'
            AND member.member_role = ANY(p_roles)
        );
      $body$;
    $fn$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.job_completion_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_status TEXT NOT NULL,
  previous_job_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'reverted')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reverted_at TIMESTAMPTZ,
  reverted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_completion_runs_job_status_idx
  ON public.job_completion_runs(job_id, status, completed_at DESC);

CREATE INDEX IF NOT EXISTS job_completion_runs_worker_idx
  ON public.job_completion_runs(worker_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.job_completion_run_device_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  completion_run_id UUID NOT NULL REFERENCES public.job_completion_runs(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.worker_customer_devices(id) ON DELETE CASCADE,
  previous_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(completion_run_id, device_id)
);

CREATE INDEX IF NOT EXISTS job_completion_run_device_snapshots_run_idx
  ON public.job_completion_run_device_snapshots(completion_run_id);

ALTER TABLE public.worker_sales_orders ADD COLUMN IF NOT EXISTS completion_run_id UUID REFERENCES public.job_completion_runs(id) ON DELETE SET NULL;
ALTER TABLE public.worker_product_warranties ADD COLUMN IF NOT EXISTS completion_run_id UUID REFERENCES public.job_completion_runs(id) ON DELETE SET NULL;
ALTER TABLE public.worker_customer_devices ADD COLUMN IF NOT EXISTS completion_run_id UUID REFERENCES public.job_completion_runs(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS reverted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS completion_run_id UUID REFERENCES public.job_completion_runs(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.billgo_subscriptions ADD COLUMN IF NOT EXISTS completion_run_id UUID REFERENCES public.job_completion_runs(id) ON DELETE SET NULL;
ALTER TABLE public.billgo_receivables ADD COLUMN IF NOT EXISTS completion_run_id UUID REFERENCES public.job_completion_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS worker_sales_orders_completion_run_id_idx ON public.worker_sales_orders(completion_run_id);
CREATE INDEX IF NOT EXISTS worker_product_warranties_completion_run_id_idx ON public.worker_product_warranties(completion_run_id);
CREATE INDEX IF NOT EXISTS worker_customer_devices_completion_run_id_idx ON public.worker_customer_devices(completion_run_id);
CREATE INDEX IF NOT EXISTS worker_customer_devices_reverted_at_idx ON public.worker_customer_devices(worker_id, reverted_at) WHERE reverted_at IS NULL;
CREATE INDEX IF NOT EXISTS payments_completion_run_id_idx ON public.payments(completion_run_id);
CREATE INDEX IF NOT EXISTS billgo_subscriptions_completion_run_id_idx ON public.billgo_subscriptions(completion_run_id);
CREATE INDEX IF NOT EXISTS billgo_receivables_completion_run_id_idx ON public.billgo_receivables(completion_run_id);

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'paid', 'void'));

ALTER TABLE public.job_completion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_completion_run_device_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own completion runs" ON public.job_completion_runs;
CREATE POLICY "Workers view own completion runs" ON public.job_completion_runs FOR SELECT USING (public.is_admin() OR public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[]));

DROP POLICY IF EXISTS "Workers create own completion runs" ON public.job_completion_runs;
CREATE POLICY "Workers create own completion runs" ON public.job_completion_runs FOR INSERT WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[]));

DROP POLICY IF EXISTS "Workers update own completion runs" ON public.job_completion_runs;
CREATE POLICY "Workers update own completion runs" ON public.job_completion_runs FOR UPDATE USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[])) WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[]));

DROP POLICY IF EXISTS "Workers view own completion device snapshots" ON public.job_completion_run_device_snapshots;
CREATE POLICY "Workers view own completion device snapshots" ON public.job_completion_run_device_snapshots FOR SELECT USING (EXISTS (SELECT 1 FROM public.job_completion_runs run WHERE run.id = job_completion_run_device_snapshots.completion_run_id AND (public.is_admin() OR public.current_user_can_access_worker_data(run.worker_id, ARRAY['owner','manager','technician']::TEXT[]))));

DROP POLICY IF EXISTS "Workers create own completion device snapshots" ON public.job_completion_run_device_snapshots;
CREATE POLICY "Workers create own completion device snapshots" ON public.job_completion_run_device_snapshots FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.job_completion_runs run WHERE run.id = job_completion_run_device_snapshots.completion_run_id AND public.current_user_can_access_worker_data(run.worker_id, ARRAY['owner','manager','technician']::TEXT[])));

CREATE OR REPLACE FUNCTION public.complete_worker_job_with_materials(
  p_job_id UUID,
  p_images TEXT[],
  p_completion_items JSONB,
  p_final_amount NUMERIC,
  p_warranty_days INTEGER,
  p_warranty_note TEXT,
  p_material_items JSONB,
  p_completion_run_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
  v_customer_id UUID;
  v_order_id UUID := NULL;
  v_item_id UUID;
  v_sale_code TEXT;
  v_item JSONB;
  v_product RECORD;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC(14, 2);
  v_line_total NUMERIC(14, 2);
  v_material_total NUMERIC(14, 2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ban chua dang nhap.';
  END IF;

  SELECT jobs.worker_id, jobs.customer_id INTO v_worker_id, v_customer_id
  FROM public.jobs
  WHERE jobs.id = p_job_id
    AND jobs.status IN ('assigned', 'in_progress')
    AND public.current_user_can_access_worker_data(jobs.worker_id, ARRAY['owner','manager','technician']::TEXT[])
  FOR UPDATE;

  IF v_worker_id IS NULL OR v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cong viec khong hop le hoac da hoan thanh.';
  END IF;

  IF p_completion_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.job_completion_runs run
    WHERE run.id = p_completion_run_id AND run.job_id = p_job_id AND run.worker_id = v_worker_id AND run.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Completion run khong hop le.';
  END IF;

  IF p_completion_items IS NULL OR jsonb_typeof(p_completion_items) <> 'array' OR jsonb_array_length(p_completion_items) = 0 THEN
    RAISE EXCEPTION 'Vui long nhap hang muc hoan thanh.';
  END IF;

  IF p_material_items IS NOT NULL AND jsonb_typeof(p_material_items) = 'array' AND jsonb_array_length(p_material_items) > 0 THEN
    v_sale_code := 'JOBSALE-' || to_char(NOW(), 'YYMMDD-HH24MISS') || '-' || upper(substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 6));

    INSERT INTO public.worker_sales_orders (worker_id, customer_id, job_id, completion_run_id, sale_code, total_amount, note, created_by)
    VALUES (v_worker_id, v_customer_id, p_job_id, p_completion_run_id, v_sale_code, 0, 'Vat tu su dung cho cong viec', auth.uid())
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_material_items)
    LOOP
      v_product_id := (v_item->>'productId')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;
      v_unit_price := (v_item->>'unitPrice')::NUMERIC(14, 2);

      IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_unit_price IS NULL OR v_unit_price < 0 THEN
        RAISE EXCEPTION 'Thong tin vat tu khong hop le.';
      END IF;

      SELECT * INTO v_product FROM public.worker_inventory_products WHERE id = v_product_id AND worker_id = v_worker_id FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Vat tu khong ton tai trong kho.';
      END IF;

      IF v_product.stock_quantity < v_quantity THEN
        RAISE EXCEPTION 'Vat tu % khong du ton kho.', v_product.name;
      END IF;

      UPDATE public.worker_inventory_products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_product.id;

      v_line_total := v_quantity * v_unit_price;
      v_material_total := v_material_total + v_line_total;

      INSERT INTO public.worker_sales_order_items (order_id, product_id, product_name, product_sku, category, unit, quantity, unit_price, line_total)
      VALUES (v_order_id, v_product.id, v_product.name, v_product.sku, v_product.category, v_product.unit, v_quantity, v_unit_price, v_line_total)
      RETURNING id INTO v_item_id;

      IF COALESCE(v_product.warranty_months, 0) > 0 THEN
        INSERT INTO public.worker_product_warranties (
          worker_id, customer_id, sales_order_id, sales_order_item_id, job_id, completion_run_id, product_id,
          product_name, product_sku, warranty_months, warranty_start, warranty_end, created_by
        )
        VALUES (
          v_worker_id, v_customer_id, v_order_id, v_item_id, p_job_id, p_completion_run_id, v_product.id,
          v_product.name, v_product.sku, v_product.warranty_months,
          CURRENT_DATE, (CURRENT_DATE + (v_product.warranty_months::TEXT || ' months')::INTERVAL)::DATE, auth.uid()
        );
      END IF;
    END LOOP;

    UPDATE public.worker_sales_orders SET total_amount = v_material_total WHERE id = v_order_id;
  END IF;

  UPDATE public.jobs
  SET status = 'completed',
      images = COALESCE(p_images, ARRAY[]::TEXT[]),
      completion_items = p_completion_items,
      final_amount = COALESCE(p_final_amount, 0),
      warranty_days = COALESCE(p_warranty_days, 0),
      warranty_note = NULLIF(trim(COALESCE(p_warranty_note, '')), '')
  WHERE id = p_job_id AND worker_id = v_worker_id;

  INSERT INTO public.job_logs (job_id, actor_id, action, metadata)
  VALUES (
    p_job_id,
    auth.uid(),
    'completed_with_materials',
    jsonb_build_object(
      'completion_run_id', p_completion_run_id,
      'sales_order_id', v_order_id,
      'material_total', v_material_total,
      'material_count', COALESCE(jsonb_array_length(p_material_items), 0),
      'source', 'worker_job_completion'
    )
  );

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_worker_job_with_materials(UUID, TEXT[], JSONB, NUMERIC, INTEGER, TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_worker_job_with_materials(UUID, TEXT[], JSONB, NUMERIC, INTEGER, TEXT, JSONB, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.revert_job_completion(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_run public.job_completion_runs%ROWTYPE;
  v_actor_id UUID := auth.uid();
  v_payment_count INTEGER := 0;
  v_sales_order_count INTEGER := 0;
  v_device_created_count INTEGER := 0;
  v_device_restored_count INTEGER := 0;
  v_receivable_count INTEGER := 0;
  v_subscription_count INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_item RECORD;
  v_snapshot RECORD;
  v_completion_run_text TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Ban chua dang nhap.';
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Khong tim thay cong viec.';
  END IF;

  IF v_job.status NOT IN ('completed', 'done') THEN
    RAISE EXCEPTION 'Chi co the hoan tac cong viec da hoan thanh.';
  END IF;

  IF NOT public.current_user_can_access_worker_data(v_job.worker_id, ARRAY['owner','manager','technician']::TEXT[]) THEN
    RAISE EXCEPTION 'Ban khong co quyen hoan tac cong viec nay.';
  END IF;

  v_completion_run_text := v_job.workflow_data->>'completionRunId';
  IF v_completion_run_text IS NULL OR v_completion_run_text = '' THEN
    RAISE EXCEPTION 'Cong viec cu chua co du lieu theo doi hoan tac.';
  END IF;

  SELECT * INTO v_run
  FROM public.job_completion_runs run
  WHERE run.job_id = p_job_id
    AND run.status = 'completed'
    AND run.id = v_completion_run_text::UUID
  ORDER BY run.completed_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cong viec cu chua co du lieu theo doi hoan tac.';
  END IF;

  FOR v_item IN
    SELECT item.product_id, item.quantity
    FROM public.worker_sales_orders sales_order
    JOIN public.worker_sales_order_items item ON item.order_id = sales_order.id
    WHERE sales_order.completion_run_id = v_run.id
      AND sales_order.status = 'completed'
      AND item.product_id IS NOT NULL
  LOOP
    UPDATE public.worker_inventory_products
    SET stock_quantity = stock_quantity + v_item.quantity
    WHERE id = v_item.product_id AND worker_id = v_run.worker_id;
  END LOOP;

  UPDATE public.worker_sales_orders
  SET status = 'cancelled',
      note = COALESCE(note, '') || CASE WHEN COALESCE(note, '') = '' THEN '' ELSE E'\n' END || 'Hoan tac hoan thanh job ' || p_job_id::TEXT,
      updated_at = v_now
  WHERE completion_run_id = v_run.id AND status = 'completed';
  GET DIAGNOSTICS v_sales_order_count = ROW_COUNT;

  UPDATE public.worker_product_warranties
  SET status = 'cancelled',
      note = COALESCE(note, '') || CASE WHEN COALESCE(note, '') = '' THEN '' ELSE E'\n' END || 'Hoan tac hoan thanh job ' || p_job_id::TEXT,
      updated_at = v_now
  WHERE completion_run_id = v_run.id AND status <> 'cancelled';

  UPDATE public.payments
  SET status = 'void',
      voided_at = v_now,
      voided_by = v_actor_id,
      note = COALESCE(note, '') || CASE WHEN COALESCE(note, '') = '' THEN '' ELSE E'\n' END || 'Hoan tac hoan thanh job ' || p_job_id::TEXT
  WHERE completion_run_id = v_run.id AND status <> 'void';
  GET DIAGNOSTICS v_payment_count = ROW_COUNT;

  FOR v_snapshot IN SELECT * FROM public.job_completion_run_device_snapshots WHERE completion_run_id = v_run.id
  LOOP
    UPDATE public.worker_customer_devices
    SET qr_code = v_snapshot.previous_data->>'qr_code',
        serial = v_snapshot.previous_data->>'serial',
        uid = v_snapshot.previous_data->>'uid',
        install_location = v_snapshot.previous_data->>'install_location',
        home_warranty_months = COALESCE(NULLIF(v_snapshot.previous_data->>'home_warranty_months', '')::INTEGER, 0),
        home_warranty_start = NULLIF(v_snapshot.previous_data->>'home_warranty_start', '')::DATE,
        home_warranty_end = NULLIF(v_snapshot.previous_data->>'home_warranty_end', '')::DATE,
        completion_run_id = NULLIF(v_snapshot.previous_data->>'completion_run_id', '')::UUID,
        updated_at = v_now
    WHERE id = v_snapshot.device_id AND worker_id = v_run.worker_id;
    v_device_restored_count := v_device_restored_count + 1;
  END LOOP;

  UPDATE public.worker_customer_devices
  SET reverted_at = v_now,
      reverted_by = v_actor_id,
      updated_at = v_now
  WHERE completion_run_id = v_run.id
    AND reverted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.job_completion_run_device_snapshots snapshot
      WHERE snapshot.completion_run_id = v_run.id AND snapshot.device_id = worker_customer_devices.id
    );
  GET DIAGNOSTICS v_device_created_count = ROW_COUNT;

  UPDATE public.billgo_receivables
  SET status = 'deleted', deleted_at = v_now, deleted_by = v_actor_id
  WHERE completion_run_id = v_run.id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_receivable_count = ROW_COUNT;

  UPDATE public.billgo_subscriptions
  SET status = 'deleted', deleted_at = v_now, last_changed_by = v_actor_id
  WHERE completion_run_id = v_run.id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_subscription_count = ROW_COUNT;

  UPDATE public.jobs
  SET status = v_run.previous_status,
      images = COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_run.previous_job_snapshot->'images')), ARRAY[]::TEXT[]),
      completion_items = COALESCE(v_run.previous_job_snapshot->'completion_items', '[]'::jsonb),
      final_amount = NULLIF(v_run.previous_job_snapshot->>'final_amount', '')::NUMERIC,
      warranty_days = COALESCE(NULLIF(v_run.previous_job_snapshot->>'warranty_days', '')::INTEGER, 0),
      warranty_note = NULLIF(v_run.previous_job_snapshot->>'warranty_note', ''),
      workflow_data = COALESCE(v_run.previous_job_snapshot->'workflow_data', '{}'::jsonb),
      updated_at = v_now
  WHERE id = p_job_id;

  UPDATE public.job_completion_runs
  SET status = 'reverted', reverted_at = v_now, reverted_by = v_actor_id
  WHERE id = v_run.id;

  INSERT INTO public.job_logs (job_id, actor_id, action, metadata)
  VALUES (
    p_job_id,
    v_actor_id,
    'completion_reverted',
    jsonb_build_object(
      'completion_run_id', v_run.id,
      'previous_status', v_run.previous_status,
      'payments_voided', v_payment_count,
      'sales_orders_cancelled', v_sales_order_count,
      'devices_created_reverted', v_device_created_count,
      'devices_restored', v_device_restored_count,
      'billgo_receivables_deleted', v_receivable_count,
      'billgo_subscriptions_deleted', v_subscription_count
    )
  );

  RETURN jsonb_build_object(
    'completionRunId', v_run.id,
    'restoredStatus', v_run.previous_status,
    'paymentsVoided', v_payment_count,
    'salesOrdersCancelled', v_sales_order_count,
    'devicesCreatedReverted', v_device_created_count,
    'devicesRestored', v_device_restored_count,
    'billgoReceivablesDeleted', v_receivable_count,
    'billgoSubscriptionsDeleted', v_subscription_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revert_job_completion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revert_job_completion(UUID) TO authenticated;
