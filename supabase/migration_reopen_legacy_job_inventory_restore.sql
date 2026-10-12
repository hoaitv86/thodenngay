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
  v_expected_product_count INTEGER := 0;
  v_expected_unit_count INTEGER := 0;
  v_invalid_completion_item_count INTEGER := 0;
  v_completed_material_count INTEGER := 0;
  v_completed_material_unit_count INTEGER := 0;
  v_restore_source TEXT := 'none';
  v_has_product BOOLEAN := FALSE;
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
  FROM (
    SELECT DISTINCT sales_order.id, sales_order.status
    FROM public.worker_sales_orders sales_order
    WHERE sales_order.worker_id = v_job.worker_id
      AND sales_order.completion_run_id IS NULL
      AND (
        sales_order.job_id = p_job_id
        OR EXISTS (
          SELECT 1
          FROM public.job_logs log
          WHERE log.job_id = p_job_id
            AND log.action = 'completed_with_materials'
            AND COALESCE(log.metadata->>'sales_order_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND (log.metadata->>'sales_order_id')::UUID = sales_order.id
        )
      )
  ) sales_order
  JOIN public.worker_sales_order_items item ON item.order_id = sales_order.id
  WHERE item.product_id IS NOT NULL;

  SELECT COUNT(*), COALESCE(SUM(item.quantity), 0)::INTEGER
  INTO v_completed_material_count, v_completed_material_unit_count
  FROM (
    SELECT DISTINCT sales_order.id, sales_order.status
    FROM public.worker_sales_orders sales_order
    WHERE sales_order.worker_id = v_job.worker_id
      AND sales_order.completion_run_id IS NULL
      AND (
        sales_order.job_id = p_job_id
        OR EXISTS (
          SELECT 1
          FROM public.job_logs log
          WHERE log.job_id = p_job_id
            AND log.action = 'completed_with_materials'
            AND COALESCE(log.metadata->>'sales_order_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND (log.metadata->>'sales_order_id')::UUID = sales_order.id
        )
      )
  ) sales_order
  JOIN public.worker_sales_order_items item ON item.order_id = sales_order.id
  WHERE sales_order.status = 'completed'
    AND item.product_id IS NOT NULL;

  WITH raw_completion_materials AS (
    SELECT item
    FROM jsonb_array_elements(COALESCE(v_job.completion_items, '[]'::jsonb)) item
    WHERE COALESCE(item->>'source', '') = 'inventory'
       OR NULLIF(COALESCE(item->>'inventoryProductId', item->>'productId'), '') IS NOT NULL
  )
  SELECT COUNT(*)
  INTO v_invalid_completion_item_count
  FROM raw_completion_materials
  WHERE CASE
    WHEN COALESCE(item->>'source', '') = 'inventory'
      AND COALESCE(item->>'inventoryProductId', item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND COALESCE(item->>'quantity', '') ~ '^[0-9]+$'
    THEN (item->>'quantity')::INTEGER <= 0
    ELSE TRUE
  END;

  IF v_invalid_completion_item_count > 0 THEN
    RAISE EXCEPTION 'Du lieu vat tu legacy khong hop le, khong the mo lai an toan.';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(quantity), 0)::INTEGER
  INTO v_expected_product_count, v_expected_unit_count
  FROM (
    SELECT
      NULLIF(COALESCE(item->>'inventoryProductId', item->>'productId'), '')::UUID AS product_id,
      SUM((item->>'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(COALESCE(v_job.completion_items, '[]'::jsonb)) item
    WHERE COALESCE(item->>'source', '') = 'inventory'
      AND COALESCE(item->>'inventoryProductId', item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND COALESCE(item->>'quantity', '') ~ '^[0-9]+$'
      AND (item->>'quantity')::INTEGER > 0
    GROUP BY NULLIF(COALESCE(item->>'inventoryProductId', item->>'productId'), '')::UUID
  ) expected;

  IF v_expected_unit_count > 0 AND v_completed_material_unit_count = 0 THEN
    RAISE EXCEPTION 'Cong viec legacy co vat tu trong phieu nhung khong co bang chung da tru kho.';
  END IF;

  IF v_expected_unit_count > 0 AND v_completed_material_unit_count > 0 THEN
    FOR v_item IN
      WITH expected AS (
        SELECT
          NULLIF(COALESCE(item->>'inventoryProductId', item->>'productId'), '')::UUID AS product_id,
          SUM((item->>'quantity')::INTEGER)::INTEGER AS quantity
        FROM jsonb_array_elements(COALESCE(v_job.completion_items, '[]'::jsonb)) item
        WHERE COALESCE(item->>'source', '') = 'inventory'
          AND COALESCE(item->>'inventoryProductId', item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND COALESCE(item->>'quantity', '') ~ '^[0-9]+$'
          AND (item->>'quantity')::INTEGER > 0
        GROUP BY NULLIF(COALESCE(item->>'inventoryProductId', item->>'productId'), '')::UUID
      ),
      completed AS (
        SELECT item.product_id, SUM(item.quantity)::INTEGER AS quantity
        FROM (
          SELECT DISTINCT sales_order.id, sales_order.status
          FROM public.worker_sales_orders sales_order
          WHERE sales_order.worker_id = v_job.worker_id
            AND sales_order.completion_run_id IS NULL
            AND (
              sales_order.job_id = p_job_id
              OR EXISTS (
                SELECT 1
                FROM public.job_logs log
                WHERE log.job_id = p_job_id
                  AND log.action = 'completed_with_materials'
                  AND COALESCE(log.metadata->>'sales_order_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  AND (log.metadata->>'sales_order_id')::UUID = sales_order.id
              )
            )
        ) sales_order
        JOIN public.worker_sales_order_items item ON item.order_id = sales_order.id
        WHERE sales_order.status = 'completed'
          AND item.product_id IS NOT NULL
        GROUP BY item.product_id
      )
      SELECT
        COALESCE(expected.product_id, completed.product_id) AS product_id,
        COALESCE(expected.quantity, 0) AS expected_quantity,
        COALESCE(completed.quantity, 0) AS completed_quantity
      FROM expected
      FULL OUTER JOIN completed ON completed.product_id = expected.product_id
      WHERE COALESCE(expected.quantity, 0) <> COALESCE(completed.quantity, 0)
    LOOP
      RAISE EXCEPTION 'Vat tu legacy khong khop lich su tru kho cho san pham %: phieu %, da tru %.',
        v_item.product_id,
        v_item.expected_quantity,
        v_item.completed_quantity;
    END LOOP;
  END IF;

  FOR v_item IN
    SELECT item.product_id, SUM(item.quantity)::INTEGER AS quantity, 'sales_order'::TEXT AS restore_source
    FROM (
      SELECT DISTINCT sales_order.id, sales_order.status
      FROM public.worker_sales_orders sales_order
      WHERE sales_order.worker_id = v_job.worker_id
        AND sales_order.completion_run_id IS NULL
        AND (
          sales_order.job_id = p_job_id
          OR EXISTS (
            SELECT 1
            FROM public.job_logs log
            WHERE log.job_id = p_job_id
              AND log.action = 'completed_with_materials'
              AND COALESCE(log.metadata->>'sales_order_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              AND (log.metadata->>'sales_order_id')::UUID = sales_order.id
          )
        )
    ) sales_order
    JOIN public.worker_sales_order_items item ON item.order_id = sales_order.id
    WHERE sales_order.status = 'completed'
      AND item.product_id IS NOT NULL
    GROUP BY item.product_id
  LOOP
    UPDATE public.worker_inventory_products
    SET stock_quantity = stock_quantity + v_item.quantity
    WHERE id = v_item.product_id
      AND worker_id = v_job.worker_id
    RETURNING TRUE INTO v_has_product;

    IF NOT COALESCE(v_has_product, FALSE) THEN
      RAISE EXCEPTION 'Khong tim thay vat tu % de hoan kho cho cong viec legacy.', v_item.product_id;
    END IF;

    v_restored_product_count := v_restored_product_count + 1;
    v_restored_unit_count := v_restored_unit_count + v_item.quantity;
    v_restore_source := v_item.restore_source;
    v_restored_quantities := jsonb_set(v_restored_quantities, ARRAY[v_item.product_id::TEXT], to_jsonb(v_item.quantity), TRUE);
    v_has_product := FALSE;
  END LOOP;

  IF v_expected_unit_count > 0 AND v_restored_unit_count <> v_expected_unit_count THEN
    RAISE EXCEPTION 'Khong hoan du vat tu legacy: can %, da hoan %.', v_expected_unit_count, v_restored_unit_count;
  END IF;

  IF v_expected_unit_count = 0 AND v_completed_material_unit_count > 0 AND v_restored_unit_count <> v_completed_material_unit_count THEN
    RAISE EXCEPTION 'Khong hoan du vat tu theo sales order legacy: can %, da hoan %.', v_completed_material_unit_count, v_restored_unit_count;
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
      'expected_unit_count', v_expected_unit_count,
      'completed_material_unit_count', v_completed_material_unit_count,
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
    'expected_unit_count', v_expected_unit_count,
    'completed_material_unit_count', v_completed_material_unit_count,
    'restored_product_count', v_restored_product_count,
    'restored_unit_count', v_restored_unit_count,
    'restored_quantities', v_restored_quantities
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_legacy_job_with_inventory(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_legacy_job_with_inventory(UUID, JSONB) TO authenticated;
