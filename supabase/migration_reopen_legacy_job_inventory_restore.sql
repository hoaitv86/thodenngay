CREATE OR REPLACE FUNCTION public.reopen_legacy_job_with_inventory(
  p_job_id UUID,
  p_workflow_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_actor_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_item RECORD;
  v_next_workflow JSONB := COALESCE(p_workflow_data, '{}'::jsonb);
  v_restored_product_count INTEGER := 0;
  v_restored_unit_count INTEGER := 0;
  v_restored_quantities JSONB := '{}'::jsonb;
  v_linked_material_count INTEGER := 0;
  v_restore_source TEXT := 'none';
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Ban chua dang nhap.';
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Khong tim thay cong viec.';
  END IF;

  IF v_job.status NOT IN ('completed', 'done') THEN
    RAISE EXCEPTION 'Chi co the mo lai cong viec da hoan thanh.';
  END IF;

  IF NOT public.current_user_can_access_worker_data(v_job.worker_id, ARRAY['owner','manager','technician']::TEXT[]) THEN
    RAISE EXCEPTION 'Ban khong co quyen mo lai cong viec nay.';
  END IF;

  IF COALESCE(v_job.workflow_data->>'completionRunId', '') <> '' THEN
    RAISE EXCEPTION 'Cong viec nay da co completion run, hay dung hoan tac hoan thanh.';
  END IF;

  IF COALESCE(v_next_workflow->>'completionRunId', '') <> '' THEN
    RAISE EXCEPTION 'Workflow mo lai legacy khong duoc gan completion run.';
  END IF;

  SELECT COUNT(*)
  INTO v_linked_material_count
  FROM public.worker_sales_orders sales_order
  JOIN public.worker_sales_order_items item ON item.order_id = sales_order.id
  WHERE sales_order.job_id = p_job_id
    AND sales_order.worker_id = v_job.worker_id
    AND sales_order.completion_run_id IS NULL
    AND item.product_id IS NOT NULL;

  FOR v_item IN
    SELECT item.product_id, SUM(item.quantity)::INTEGER AS quantity, 'sales_order'::TEXT AS restore_source
    FROM public.worker_sales_orders sales_order
    JOIN public.worker_sales_order_items item ON item.order_id = sales_order.id
    WHERE sales_order.job_id = p_job_id
      AND sales_order.worker_id = v_job.worker_id
      AND sales_order.status = 'completed'
      AND sales_order.completion_run_id IS NULL
      AND item.product_id IS NOT NULL
    GROUP BY item.product_id
  LOOP
    UPDATE public.worker_inventory_products
    SET stock_quantity = stock_quantity + v_item.quantity
    WHERE id = v_item.product_id
      AND worker_id = v_job.worker_id;

    IF FOUND THEN
      v_restored_product_count := v_restored_product_count + 1;
      v_restored_unit_count := v_restored_unit_count + v_item.quantity;
      v_restore_source := v_item.restore_source;
      v_restored_quantities := jsonb_set(v_restored_quantities, ARRAY[v_item.product_id::TEXT], to_jsonb(v_item.quantity), TRUE);
    END IF;
  END LOOP;

  IF v_restored_unit_count = 0 AND v_linked_material_count = 0 THEN
    FOR v_item IN
      WITH completion_materials AS (
        SELECT
          NULLIF(COALESCE(item->>'inventoryProductId', item->>'productId'), '')::UUID AS product_id,
          FLOOR(NULLIF(item->>'quantity', '')::NUMERIC)::INTEGER AS quantity
        FROM jsonb_array_elements(COALESCE(v_job.completion_items, '[]'::jsonb)) item
        WHERE COALESCE(item->>'source', '') = 'inventory'
          AND COALESCE(item->>'inventoryProductId', item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND COALESCE(item->>'quantity', '') ~ '^[0-9]+(\.[0-9]+)?$'
      )
      SELECT product_id, SUM(quantity)::INTEGER AS quantity, 'completion_items'::TEXT AS restore_source
      FROM completion_materials
      WHERE product_id IS NOT NULL
        AND quantity > 0
      GROUP BY product_id
    LOOP
      UPDATE public.worker_inventory_products
      SET stock_quantity = stock_quantity + v_item.quantity
      WHERE id = v_item.product_id
        AND worker_id = v_job.worker_id;

      IF FOUND THEN
        v_restored_product_count := v_restored_product_count + 1;
        v_restored_unit_count := v_restored_unit_count + v_item.quantity;
        v_restore_source := v_item.restore_source;
        v_restored_quantities := jsonb_set(v_restored_quantities, ARRAY[v_item.product_id::TEXT], to_jsonb(v_item.quantity), TRUE);
      END IF;
    END LOOP;
  END IF;

  IF v_next_workflow ? 'legacy_reopen_baseline' THEN
    v_next_workflow := jsonb_set(
      v_next_workflow,
      '{legacy_reopen_baseline,inventoryRestored}',
      to_jsonb(v_restored_unit_count > 0),
      TRUE
    );
    v_next_workflow := jsonb_set(
      v_next_workflow,
      '{legacy_reopen_baseline,inventoryRestoredAt}',
      CASE WHEN v_restored_unit_count > 0 THEN to_jsonb(v_now) ELSE 'null'::jsonb END,
      TRUE
    );
  END IF;

  UPDATE public.jobs
  SET status = 'in_progress',
      workflow_data = v_next_workflow,
      updated_at = v_now
  WHERE id = p_job_id;

  INSERT INTO public.job_logs (job_id, actor_id, action, metadata)
  VALUES (
    p_job_id,
    v_actor_id,
    'legacy_job_reopened',
    jsonb_build_object(
      'source', 'reopen_legacy_job_with_inventory',
      'previous_status', v_job.status,
      'next_status', 'in_progress',
      'reopened_at', v_now,
      'inventory_restored', v_restored_unit_count > 0,
      'restore_source', v_restore_source,
      'linked_material_count', v_linked_material_count,
      'restored_product_count', v_restored_product_count,
      'restored_unit_count', v_restored_unit_count,
      'restored_quantities', v_restored_quantities
    )
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'status', 'in_progress',
    'updated_at', v_now,
    'workflow_data', v_next_workflow,
    'restore_source', v_restore_source,
    'linked_material_count', v_linked_material_count,
    'restored_product_count', v_restored_product_count,
    'restored_unit_count', v_restored_unit_count,
    'restored_quantities', v_restored_quantities
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_legacy_job_with_inventory(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_legacy_job_with_inventory(UUID, JSONB) TO authenticated;
