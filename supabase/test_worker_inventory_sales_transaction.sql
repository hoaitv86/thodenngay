-- Transaction test for Worker Inventory -> Receiving -> Sales -> BillGo -> Profit.
-- Run only on an isolated test database or a restored production copy.
--
-- Required safety switch before running this file in the same SQL session:
--   SET app.worker_inventory_test.allow = 'true';
--
-- The script opens a transaction and finishes with ROLLBACK. It intentionally
-- creates temporary test rows inside that transaction to exercise the real RPCs.

BEGIN;

DO $$
DECLARE
  v_allowed TEXT := current_setting('app.worker_inventory_test.allow', TRUE);
  v_worker_id UUID;
  v_worker_user_id UUID;
  v_customer_id UUID;
  v_job_id UUID;
  v_receipt_id UUID;
  v_product_id UUID;
  v_cancel_receipt_id UUID;
  v_cancel_product_id UUID;
  v_order_id UUID;
  v_sale_item_id UUID;
  v_sku TEXT := 'TXN-INV-' || upper(substr(replace(uuid_generate_v4()::TEXT, '-', ''), 1, 10));
  v_cancel_sku TEXT := 'TXN-CANCEL-' || upper(substr(replace(uuid_generate_v4()::TEXT, '-', ''), 1, 10));
  v_reopen_order_id UUID;
  v_reopen_item_id UUID;
  v_reopen_result JSONB;
  v_roundtrip_job_id UUID;
  v_roundtrip_receipt_id UUID;
  v_roundtrip_product_id UUID;
  v_roundtrip_sku TEXT := 'TXN-ROUNDTRIP-' || upper(substr(replace(uuid_generate_v4()::TEXT, '-', ''), 1, 10));
  v_roundtrip_run_id UUID;
  v_roundtrip_order_id UUID;
  v_roundtrip_item_id UUID;
  v_roundtrip_result JSONB;
  v_blocked_no_history BOOLEAN := FALSE;
  v_blocked_fractional_quantity BOOLEAN := FALSE;
  v_blocked_mismatched_history BOOLEAN := FALSE;
  v_cycle TEXT;
  v_expected_billing_months INTEGER;
  v_expected_bonus_months INTEGER;
  v_expected_service_months INTEGER;
  v_subscription RECORD;
  v_receivable RECORD;
  v_cancelled_order_id UUID;
  v_blocked_receipt_cancel BOOLEAN := FALSE;
BEGIN
  IF v_allowed IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Refusing to run: set app.worker_inventory_test.allow=true on an isolated test database first.';
  END IF;

  v_worker_user_id := uuid_generate_v4();
  v_customer_id := uuid_generate_v4();

  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (
      v_worker_user_id,
      'authenticated',
      'authenticated',
      lower(v_sku) || '-worker@example.test',
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW()
    ),
    (
      v_customer_id,
      'authenticated',
      'authenticated',
      lower(v_sku) || '-customer@example.test',
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW()
    );

  INSERT INTO public.profiles (id, email, phone, full_name, address, role)
  VALUES
    (v_worker_user_id, lower(v_sku) || '-worker@example.test', '0900000001', 'Staging Inventory Worker', 'Test address', 'worker'),
    (v_customer_id, lower(v_sku) || '-customer@example.test', '0900000002', 'Staging Inventory Customer', 'Test address', 'customer')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      full_name = EXCLUDED.full_name,
      address = EXCLUDED.address,
      role = EXCLUDED.role;

  INSERT INTO public.workers (user_id, specialties, status, is_available, approved_at)
  VALUES (v_worker_user_id, ARRAY['Kho hang test'], 'active', TRUE, NOW())
  RETURNING id INTO v_worker_id;

  WITH test_service AS (
    INSERT INTO public.services (name, description, base_price, is_active)
    VALUES ('Staging Inventory Test Service', 'Synthetic service for transaction rollback test', 0, TRUE)
    RETURNING id
  )
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
  SELECT
    'JOB-' || v_sku,
    v_customer_id,
    v_worker_id,
    test_service.id,
    'Test address',
    NOW(),
    'Synthetic job for inventory transaction rollback test',
    0,
    'in_progress',
    'app',
    v_customer_id
  FROM test_service
  RETURNING id INTO v_job_id;

  PERFORM set_config('request.jwt.claim.sub', v_worker_user_id::TEXT, TRUE);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);
  PERFORM set_config('role', 'authenticated', TRUE);

  SELECT public.save_worker_inventory_receipt(
    v_worker_id,
    NULL,
    NULL,
    'TEST-' || v_sku,
    CURRENT_DATE,
    'transaction test receipt',
    'confirmed',
    jsonb_build_array(jsonb_build_object(
      'name', 'Transaction Test Device',
      'sku', v_sku,
      'category', 'Test',
      'unit', 'cai',
      'quantity', 5,
      'unitCost', 100000,
      'defaultSalePrice', 150000,
      'warrantyMonths', 12,
      'serials', jsonb_build_array(
        jsonb_build_object('serialCode', v_sku || '-S1', 'qrCode', v_sku || '-Q1'),
        jsonb_build_object('serialCode', v_sku || '-S2', 'qrCode', v_sku || '-Q2'),
        jsonb_build_object('serialCode', v_sku || '-S3', 'qrCode', v_sku || '-Q3'),
        jsonb_build_object('serialCode', v_sku || '-S4', 'qrCode', v_sku || '-Q4'),
        jsonb_build_object('serialCode', v_sku || '-S5', 'qrCode', v_sku || '-Q5')
      )
    ))
  )
  INTO v_receipt_id;

  SELECT id
  INTO v_product_id
  FROM public.worker_inventory_products
  WHERE worker_id = v_worker_id
    AND sku = v_sku;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Receipt RPC did not create the test product.';
  END IF;

  UPDATE public.worker_inventory_products
  SET is_recurring_billgo = TRUE,
      recurring_cycle = 'two_months'
  WHERE id = v_product_id;

  IF (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_product_id) <> 5 THEN
    RAISE EXCEPTION 'Confirmed receipt did not add stock correctly.';
  END IF;

  IF (SELECT COUNT(*) FROM public.worker_inventory_receipt_item_serials WHERE product_id = v_product_id AND status = 'in_stock') <> 5 THEN
    RAISE EXCEPTION 'Receipt serials were not created in stock.';
  END IF;

  FOREACH v_cycle IN ARRAY ARRAY['monthly', 'two_months', 'three_months', 'six_months', 'yearly']
  LOOP
    SELECT public.create_worker_sales_order(
      v_customer_id,
      'transaction test sale ' || v_cycle,
      jsonb_build_array(jsonb_build_object(
        'productId', v_product_id,
        'quantity', 1,
        'unitPrice', 150000
      )),
      TRUE,
      v_cycle,
      DATE '2026-01-15'
    )
    INTO v_order_id;

    v_expected_billing_months := CASE v_cycle
      WHEN 'two_months' THEN 2
      WHEN 'three_months' THEN 3
      WHEN 'six_months' THEN 6
      WHEN 'yearly' THEN 12
      ELSE 1
    END;
    v_expected_bonus_months := CASE v_cycle WHEN 'yearly' THEN 1 ELSE 0 END;
    v_expected_service_months := v_expected_billing_months + v_expected_bonus_months;

    SELECT *
    INTO v_subscription
    FROM public.billgo_subscriptions
    WHERE internet_account = 'SALE-' || v_order_id::TEXT;

    SELECT *
    INTO v_receivable
    FROM public.billgo_receivables
    WHERE subscription_id = v_subscription.id;

    IF v_subscription.id IS NULL OR v_receivable.id IS NULL THEN
      RAISE EXCEPTION 'BillGo rows were not created for cycle %.', v_cycle;
    END IF;

    IF v_subscription.cycle <> v_cycle
      OR v_subscription.current_cycle <> v_cycle
      OR v_receivable.cycle_at_collection <> v_cycle
      OR v_receivable.billing_months <> v_expected_billing_months
      OR v_receivable.bonus_months <> v_expected_bonus_months
      OR v_receivable.service_months <> v_expected_service_months
      OR v_receivable.paid_amount <> 0
      OR v_receivable.monthly_fee_at_collection <> 150000
    THEN
      RAISE EXCEPTION 'BillGo cycle metadata mismatch for cycle %.', v_cycle;
    END IF;

    IF v_receivable.due_date <> (date_trunc('month', v_receivable.period_end + INTERVAL '1 month')::DATE + 18) THEN
      RAISE EXCEPTION 'BillGo due date mismatch for cycle %.', v_cycle;
    END IF;

    SELECT id
    INTO v_sale_item_id
    FROM public.worker_sales_order_items
    WHERE order_id = v_order_id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.worker_sales_orders
      WHERE id = v_order_id
        AND total_amount = 150000
        AND cost_total = 100000
        AND gross_profit = 50000
    ) THEN
      RAISE EXCEPTION 'Sales order profit mismatch for cycle %.', v_cycle;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.worker_sales_order_items
      WHERE id = v_sale_item_id
        AND unit_cost = 100000
        AND cost_total = 100000
        AND gross_profit = 50000
    ) THEN
      RAISE EXCEPTION 'Sales item profit mismatch for cycle %.', v_cycle;
    END IF;

    IF (
      SELECT COUNT(*)
      FROM public.worker_inventory_receipt_item_serials
      WHERE product_id = v_product_id
        AND status = 'sold'
        AND sales_order_id = v_order_id
        AND sales_order_item_id = v_sale_item_id
        AND serial_code IS NOT NULL
        AND qr_code IS NOT NULL
    ) <> 1 THEN
      RAISE EXCEPTION 'Serial/QR was not linked to the sale item for cycle %.', v_cycle;
    END IF;
  END LOOP;

  IF (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_product_id) <> 0 THEN
    RAISE EXCEPTION 'Sales RPC did not decrement stock to zero.';
  END IF;

  IF (SELECT COUNT(*) FROM public.worker_inventory_receipt_item_serials WHERE product_id = v_product_id AND status = 'sold') <> 5 THEN
    RAISE EXCEPTION 'Sales RPC did not mark all serials as sold.';
  END IF;

  SELECT id
  INTO v_cancelled_order_id
  FROM public.worker_sales_orders
  WHERE note = 'transaction test sale monthly'
  LIMIT 1;

  PERFORM public.cancel_worker_sales_order(v_cancelled_order_id);

  IF (SELECT status FROM public.worker_sales_orders WHERE id = v_cancelled_order_id) <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancel sales RPC did not cancel the order.';
  END IF;

  IF (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_product_id) <> 1 THEN
    RAISE EXCEPTION 'Cancel sales RPC did not restore stock.';
  END IF;

  IF (SELECT COUNT(*) FROM public.worker_inventory_receipt_item_serials WHERE product_id = v_product_id AND status = 'in_stock') <> 1 THEN
    RAISE EXCEPTION 'Cancel sales RPC did not restore one serial.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.worker_inventory_receipt_item_serials
    WHERE product_id = v_product_id
      AND status = 'in_stock'
      AND (sales_order_id IS NOT NULL OR sales_order_item_id IS NOT NULL OR sold_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Cancel sales RPC did not unlink restored serials from the sale.';
  END IF;

  SELECT public.save_worker_inventory_receipt(
    v_worker_id,
    NULL,
    NULL,
    'TEST-CANCEL-' || v_cancel_sku,
    CURRENT_DATE,
    'transaction test receipt for reopen and double cancel',
    'confirmed',
    jsonb_build_array(jsonb_build_object(
      'name', 'Transaction Test Reopen Device',
      'sku', v_cancel_sku,
      'category', 'Test',
      'unit', 'cai',
      'quantity', 2,
      'unitCost', 80000,
      'defaultSalePrice', 120000,
      'warrantyMonths', 0,
      'serials', '[]'::jsonb
    ))
  )
  INTO v_cancel_receipt_id;

  SELECT id
  INTO v_cancel_product_id
  FROM public.worker_inventory_products
  WHERE worker_id = v_worker_id
    AND sku = v_cancel_sku;

  IF v_cancel_product_id IS NULL THEN
    RAISE EXCEPTION 'Receipt RPC did not create the reopen/double-cancel test product.';
  END IF;

  SELECT public.complete_worker_job_with_materials(
    v_job_id,
    ARRAY[]::TEXT[],
    jsonb_build_array(jsonb_build_object('title', 'Legacy reopen completion')),
    120000::NUMERIC,
    0::INTEGER,
    NULL::TEXT,
    jsonb_build_array(jsonb_build_object(
      'productId', v_cancel_product_id,
      'quantity', 1,
      'unitPrice', 120000
    )),
    NULL::UUID
  )
  INTO v_reopen_order_id;

  SELECT id
  INTO v_reopen_item_id
  FROM public.worker_sales_order_items
  WHERE order_id = v_reopen_order_id
    AND product_id = v_cancel_product_id;

  IF v_reopen_order_id IS NULL OR v_reopen_item_id IS NULL THEN
    RAISE EXCEPTION 'Job completion RPC did not create the linked material sale.';
  END IF;

  IF (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_cancel_product_id) <> 1 THEN
    RAISE EXCEPTION 'Job completion RPC did not decrement linked material stock before reopen.';
  END IF;

  SELECT public.reopen_legacy_job_with_inventory(
    v_job_id,
    jsonb_build_object('legacy_reopen_baseline', jsonb_build_object())
  )
  INTO v_reopen_result;

  IF (v_reopen_result->>'ok')::BOOLEAN IS DISTINCT FROM TRUE
    OR (v_reopen_result->>'restored_unit_count')::INTEGER <> 1
    OR (SELECT status FROM public.jobs WHERE id = v_job_id) <> 'in_progress'
    OR (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_cancel_product_id) <> 2
  THEN
    RAISE EXCEPTION 'Legacy reopen RPC did not restore linked inventory correctly.';
  END IF;

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
  SELECT
    'JOB-' || v_roundtrip_sku,
    v_customer_id,
    v_worker_id,
    jobs.service_id,
    'Test address',
    NOW(),
    'Synthetic job for 10-8-10-8-10 inventory reopen test',
    0,
    'completed',
    'app',
    v_customer_id
  FROM public.jobs
  WHERE id = v_job_id
  RETURNING id INTO v_roundtrip_job_id;

  SELECT public.save_worker_inventory_receipt(
    v_worker_id,
    NULL,
    NULL,
    'TEST-' || v_roundtrip_sku,
    CURRENT_DATE,
    'transaction test receipt for exact reopen roundtrip',
    'confirmed',
    jsonb_build_array(jsonb_build_object(
      'name', 'Transaction Test Roundtrip Device',
      'sku', v_roundtrip_sku,
      'category', 'Test',
      'unit', 'cai',
      'quantity', 10,
      'unitCost', 80000,
      'defaultSalePrice', 120000,
      'warrantyMonths', 0,
      'serials', '[]'::jsonb
    ))
  )
  INTO v_roundtrip_receipt_id;

  SELECT id
  INTO v_roundtrip_product_id
  FROM public.worker_inventory_products
  WHERE worker_id = v_worker_id
    AND sku = v_roundtrip_sku;

  IF (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_roundtrip_product_id) <> 10 THEN
    RAISE EXCEPTION 'Roundtrip receipt did not create stock 10.';
  END IF;

  UPDATE public.worker_inventory_products
  SET stock_quantity = stock_quantity - 2
  WHERE id = v_roundtrip_product_id;

  UPDATE public.jobs
  SET completion_items = jsonb_build_array(jsonb_build_object(
        'name', 'Roundtrip legacy material',
        'source', 'inventory',
        'inventoryProductId', v_roundtrip_product_id,
        'quantity', 2,
        'unitPrice', 120000
      )),
      final_amount = 240000,
      warranty_days = 0,
      workflow_data = '{}'::jsonb
  WHERE id = v_roundtrip_job_id;

  IF (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_roundtrip_product_id) <> 8 THEN
    RAISE EXCEPTION 'Roundtrip setup did not decrement stock 10 -> 8.';
  END IF;

  BEGIN
    PERFORM public.reopen_legacy_job_with_inventory(
      v_roundtrip_job_id,
      jsonb_build_object(
        'legacy_reopened', TRUE,
        'legacy_reopen_baseline', jsonb_build_object(
          'version', 1,
          'materialQuantities', jsonb_build_object(v_roundtrip_product_id::TEXT, 2),
          'inventoryRestored', FALSE
        )
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_blocked_no_history := TRUE;
  END;

  IF NOT v_blocked_no_history
    OR (SELECT status FROM public.jobs WHERE id = v_roundtrip_job_id) <> 'completed'
    OR (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_roundtrip_product_id) <> 8
  THEN
    RAISE EXCEPTION 'Legacy reopen without deduction history should fail and leave stock unchanged.';
  END IF;

  UPDATE public.jobs
  SET completion_items = jsonb_build_array(jsonb_build_object(
        'name', 'Roundtrip fractional material',
        'source', 'inventory',
        'inventoryProductId', v_roundtrip_product_id,
        'quantity', 1.5,
        'unitPrice', 120000
      ))
  WHERE id = v_roundtrip_job_id;

  BEGIN
    PERFORM public.reopen_legacy_job_with_inventory(
      v_roundtrip_job_id,
      jsonb_build_object(
        'legacy_reopened', TRUE,
        'legacy_reopen_baseline', jsonb_build_object(
          'version', 1,
          'materialQuantities', jsonb_build_object(v_roundtrip_product_id::TEXT, 1.5),
          'inventoryRestored', FALSE
        )
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_blocked_fractional_quantity := TRUE;
  END;

  IF NOT v_blocked_fractional_quantity
    OR (SELECT status FROM public.jobs WHERE id = v_roundtrip_job_id) <> 'completed'
    OR (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_roundtrip_product_id) <> 8
  THEN
    RAISE EXCEPTION 'Legacy reopen with fractional material quantity should fail and leave stock unchanged.';
  END IF;

  UPDATE public.jobs
  SET completion_items = jsonb_build_array(jsonb_build_object(
        'name', 'Roundtrip legacy material',
        'source', 'inventory',
        'inventoryProductId', v_roundtrip_product_id,
        'quantity', 2,
        'unitPrice', 120000
      ))
  WHERE id = v_roundtrip_job_id;

  INSERT INTO public.worker_sales_orders (
    worker_id,
    customer_id,
    job_id,
    completion_run_id,
    sale_code,
    total_amount,
    note,
    created_by
  )
  VALUES (
    v_worker_id,
    v_customer_id,
    NULL,
    NULL,
    'JOBSALE-MISMATCH-' || upper(substr(replace(uuid_generate_v4()::TEXT, '-', ''), 1, 10)),
    120000,
    'transaction test mismatched legacy material evidence',
    v_worker_user_id
  )
  RETURNING id INTO v_roundtrip_order_id;

  INSERT INTO public.job_logs (job_id, actor_id, action, metadata)
  VALUES (
    v_roundtrip_job_id,
    v_worker_user_id,
    'completed_with_materials',
    jsonb_build_object(
      'sales_order_id', v_roundtrip_order_id,
      'source', 'transaction_test_job_log_link',
      'material_count', 1
    )
  );

  INSERT INTO public.worker_sales_order_items (
    order_id,
    product_id,
    product_name,
    product_sku,
    category,
    unit,
    quantity,
    unit_price,
    line_total
  )
  VALUES (
    v_roundtrip_order_id,
    v_roundtrip_product_id,
    'Transaction Test Roundtrip Device',
    v_roundtrip_sku,
    'Test',
    'cai',
    1,
    120000,
    120000
  )
  RETURNING id INTO v_roundtrip_item_id;

  BEGIN
    PERFORM public.reopen_legacy_job_with_inventory(
      v_roundtrip_job_id,
      jsonb_build_object(
        'legacy_reopened', TRUE,
        'legacy_reopen_baseline', jsonb_build_object(
          'version', 1,
          'materialQuantities', jsonb_build_object(v_roundtrip_product_id::TEXT, 2),
          'inventoryRestored', FALSE
        )
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_blocked_mismatched_history := TRUE;
  END;

  IF NOT v_blocked_mismatched_history
    OR (SELECT status FROM public.jobs WHERE id = v_roundtrip_job_id) <> 'completed'
    OR (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_roundtrip_product_id) <> 8
  THEN
    RAISE EXCEPTION 'Legacy reopen with partial sales evidence should fail and leave stock unchanged.';
  END IF;

  UPDATE public.worker_sales_order_items
  SET quantity = 2,
      line_total = 240000
  WHERE id = v_roundtrip_item_id;

  UPDATE public.worker_sales_orders
  SET total_amount = 240000,
      note = 'transaction test matching legacy material evidence'
  WHERE id = v_roundtrip_order_id;

  SELECT public.reopen_legacy_job_with_inventory(
    v_roundtrip_job_id,
    jsonb_build_object(
      'legacy_reopened', TRUE,
      'legacy_reopen_baseline', jsonb_build_object(
        'version', 1,
        'materialQuantities', jsonb_build_object(v_roundtrip_product_id::TEXT, 2),
        'inventoryRestored', FALSE
      )
    )
  )
  INTO v_roundtrip_result;

  IF (v_roundtrip_result->>'ok')::BOOLEAN IS DISTINCT FROM TRUE
    OR (v_roundtrip_result->>'restored_unit_count')::INTEGER <> 2
    OR (v_roundtrip_result->>'restore_source') <> 'sales_order'
    OR (SELECT status FROM public.jobs WHERE id = v_roundtrip_job_id) <> 'in_progress'
    OR (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_roundtrip_product_id) <> 10
    OR COALESCE((SELECT (workflow_data->'legacy_reopen_baseline'->>'inventoryRestored')::BOOLEAN FROM public.jobs WHERE id = v_roundtrip_job_id), FALSE) IS DISTINCT FROM TRUE
  THEN
    RAISE EXCEPTION 'Legacy reopen with matching sales evidence did not restore stock 8 -> 10.';
  END IF;

  INSERT INTO public.job_completion_runs (
    job_id,
    worker_id,
    completed_by,
    previous_status,
    previous_job_snapshot
  )
  SELECT
    jobs.id,
    jobs.worker_id,
    v_worker_user_id,
    jobs.status,
    jsonb_build_object(
      'status', jobs.status,
      'images', COALESCE(to_jsonb(jobs.images), '[]'::jsonb),
      'completion_items', COALESCE(jobs.completion_items, '[]'::jsonb),
      'final_amount', jobs.final_amount,
      'warranty_days', jobs.warranty_days,
      'warranty_note', jobs.warranty_note,
      'workflow_data', COALESCE(jobs.workflow_data, '{}'::jsonb)
    )
  FROM public.jobs
  WHERE jobs.id = v_roundtrip_job_id
  RETURNING id INTO v_roundtrip_run_id;

  SELECT public.complete_worker_job_with_materials(
    v_roundtrip_job_id,
    ARRAY[]::TEXT[],
    jsonb_build_array(jsonb_build_object(
      'name', 'Roundtrip completed material',
      'source', 'inventory',
      'inventoryProductId', v_roundtrip_product_id,
      'quantity', 2,
      'unitPrice', 120000
    )),
    240000::NUMERIC,
    0::INTEGER,
    NULL::TEXT,
    jsonb_build_array(jsonb_build_object(
      'productId', v_roundtrip_product_id,
      'quantity', 2,
      'unitPrice', 120000
    )),
    v_roundtrip_run_id
  )
  INTO v_roundtrip_order_id;

  UPDATE public.jobs
  SET workflow_data = COALESCE(workflow_data, '{}'::jsonb) || jsonb_build_object('completionRunId', v_roundtrip_run_id)
  WHERE id = v_roundtrip_job_id;

  IF v_roundtrip_order_id IS NULL
    OR (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_roundtrip_product_id) <> 8
  THEN
    RAISE EXCEPTION 'Roundtrip completion rerun did not decrement stock 10 -> 8 exactly once.';
  END IF;

  SELECT public.revert_job_completion(v_roundtrip_job_id)
  INTO v_roundtrip_result;

  IF (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_roundtrip_product_id) <> 10
    OR (SELECT status FROM public.jobs WHERE id = v_roundtrip_job_id) <> 'in_progress'
    OR (SELECT status FROM public.job_completion_runs WHERE id = v_roundtrip_run_id) <> 'reverted'
  THEN
    RAISE EXCEPTION 'Roundtrip revert did not restore stock 8 -> 10.';
  END IF;

  PERFORM public.cancel_worker_inventory_receipt(v_cancel_receipt_id);

  IF (SELECT status FROM public.worker_inventory_receipts WHERE id = v_cancel_receipt_id) <> 'canceled' THEN
    RAISE EXCEPTION 'Receipt cancel RPC did not cancel the standalone receipt.';
  END IF;

  IF (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_cancel_product_id) <> 0 THEN
    RAISE EXCEPTION 'Receipt cancel RPC did not remove standalone receipt stock.';
  END IF;

  PERFORM public.cancel_worker_inventory_receipt(v_cancel_receipt_id);

  IF (SELECT stock_quantity FROM public.worker_inventory_products WHERE id = v_cancel_product_id) <> 0 THEN
    RAISE EXCEPTION 'Receipt cancel RPC double-restored or double-decremented stock.';
  END IF;

  BEGIN
    PERFORM public.cancel_worker_inventory_receipt(v_receipt_id);
  EXCEPTION
    WHEN OTHERS THEN
      v_blocked_receipt_cancel := TRUE;
  END;

  IF NOT v_blocked_receipt_cancel THEN
    RAISE EXCEPTION 'Receipt cancel should be blocked while serials remain sold.';
  END IF;
END;
$$;

ROLLBACK;
