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
  v_receipt_id UUID;
  v_product_id UUID;
  v_order_id UUID;
  v_sale_item_id UUID;
  v_sku TEXT := 'TXN-INV-' || upper(substr(replace(uuid_generate_v4()::TEXT, '-', ''), 1, 10));
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
    'completed',
    'app',
    v_customer_id
  FROM test_service;

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
