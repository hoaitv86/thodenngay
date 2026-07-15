-- Align worker sales BillGo creation with the multi-cycle BillGo lifecycle.
-- This keeps existing sales behavior intact and only updates cycle support/metadata.

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  IF to_regclass('public.worker_inventory_products') IS NULL THEN
    RETURN;
  END IF;

  FOR constraint_record IN
    SELECT constraint_name
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'worker_inventory_products'
      AND column_name = 'recurring_cycle'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.worker_inventory_products DROP CONSTRAINT IF EXISTS %I',
      constraint_record.constraint_name
    );
  END LOOP;

  ALTER TABLE public.worker_inventory_products
    ADD CONSTRAINT worker_inventory_products_recurring_cycle_check
    CHECK (recurring_cycle IN ('monthly', 'two_months', 'three_months', 'six_months', 'yearly'));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_worker_sales_order(
  p_customer_id UUID,
  p_note TEXT,
  p_items JSONB,
  p_create_billgo BOOLEAN DEFAULT FALSE,
  p_billgo_cycle TEXT DEFAULT 'monthly',
  p_billgo_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
  v_order_id UUID;
  v_item_id UUID;
  v_sale_code TEXT;
  v_item JSONB;
  v_product RECORD;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC(14, 2);
  v_line_total NUMERIC(14, 2);
  v_total_amount NUMERIC(14, 2) := 0;
  v_billgo_total NUMERIC(14, 2) := 0;
  v_billgo_period_end DATE;
  v_billgo_due_date DATE;
  v_billgo_collection_month DATE;
  v_billgo_next_period_start DATE;
  v_billgo_next_due_date DATE;
  v_billgo_paid_months INTEGER := 1;
  v_billgo_bonus_months INTEGER := 0;
  v_billgo_service_months INTEGER := 1;
  v_subscription_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ban chua dang nhap.';
  END IF;

  SELECT id INTO v_worker_id
  FROM public.workers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay ho so tho.';
  END IF;

  IF p_billgo_cycle NOT IN ('monthly', 'two_months', 'three_months', 'six_months', 'yearly') THEN
    RAISE EXCEPTION 'Chu ky BillGo khong hop le.';
  END IF;

  IF p_customer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_customer_id AND role = 'customer'
  ) THEN
    RAISE EXCEPTION 'Khach hang khong hop le.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs WHERE worker_id = v_worker_id AND customer_id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'Khach hang chua nam trong danh sach phuc vu cua tho.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Vui long chon it nhat mot san pham.';
  END IF;

  v_sale_code := 'SALE-' || to_char(NOW(), 'YYMMDD-HH24MISS') || '-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6));

  INSERT INTO public.worker_sales_orders (worker_id, customer_id, sale_code, total_amount, note, created_by)
  VALUES (v_worker_id, p_customer_id, v_sale_code, 0, NULLIF(trim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unitPrice')::NUMERIC(14, 2);

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Thong tin san pham khong hop le.';
    END IF;

    SELECT * INTO v_product
    FROM public.worker_inventory_products
    WHERE id = v_product_id AND worker_id = v_worker_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'San pham khong ton tai trong kho.';
    END IF;

    IF v_product.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'San pham % khong du ton kho.', v_product.name;
    END IF;

    UPDATE public.worker_inventory_products
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_product.id;

    v_line_total := v_quantity * v_unit_price;
    v_total_amount := v_total_amount + v_line_total;

    INSERT INTO public.worker_sales_order_items (
      order_id, product_id, product_name, product_sku, category, unit, quantity, unit_price, line_total
    )
    VALUES (
      v_order_id, v_product.id, v_product.name, v_product.sku, v_product.category, v_product.unit,
      v_quantity, v_unit_price, v_line_total
    )
    RETURNING id INTO v_item_id;

    IF COALESCE(v_product.warranty_months, 0) > 0 THEN
      INSERT INTO public.worker_product_warranties (
        worker_id, customer_id, sales_order_id, sales_order_item_id, product_id,
        product_name, product_sku, warranty_months, warranty_start, warranty_end, created_by
      )
      VALUES (
        v_worker_id, p_customer_id, v_order_id, v_item_id, v_product.id,
        v_product.name, v_product.sku, v_product.warranty_months,
        CURRENT_DATE, (CURRENT_DATE + (v_product.warranty_months::TEXT || ' months')::INTERVAL)::DATE, auth.uid()
      );
    END IF;

    IF p_create_billgo AND COALESCE(v_product.is_recurring_billgo, FALSE) THEN
      v_billgo_total := v_billgo_total + v_line_total;
    END IF;
  END LOOP;

  UPDATE public.worker_sales_orders SET total_amount = v_total_amount WHERE id = v_order_id;

  IF p_create_billgo AND v_billgo_total > 0 THEN
    v_billgo_paid_months := CASE p_billgo_cycle
      WHEN 'two_months' THEN 2
      WHEN 'three_months' THEN 3
      WHEN 'six_months' THEN 6
      WHEN 'yearly' THEN 12
      ELSE 1
    END;
    v_billgo_bonus_months := CASE p_billgo_cycle WHEN 'yearly' THEN 1 ELSE 0 END;
    v_billgo_service_months := v_billgo_paid_months + v_billgo_bonus_months;
    v_billgo_period_end := (p_billgo_start_date + make_interval(months => v_billgo_service_months) - INTERVAL '1 day')::DATE;
    v_billgo_due_date := (date_trunc('month', v_billgo_period_end + INTERVAL '1 month')::DATE + 18);
    v_billgo_collection_month := date_trunc('month', v_billgo_period_end + INTERVAL '1 month')::DATE;
    v_billgo_next_period_start := (v_billgo_period_end + INTERVAL '1 day')::DATE;
    v_billgo_next_due_date := (
      date_trunc(
        'month',
        (v_billgo_next_period_start + make_interval(months => v_billgo_service_months) - INTERVAL '1 day') + INTERVAL '1 month'
      )::DATE + 18
    );

    INSERT INTO public.billgo_subscriptions (
      customer_id, worker_id, customer_name, internet_account, customer_address,
      package_name, service_type, cycle, current_cycle, amount_per_cycle, monthly_fee,
      start_date, next_due_date, next_period_start, note, created_by, last_changed_by
    )
    SELECT
      p_customer_id, v_worker_id, profiles.full_name, 'SALE-' || v_order_id::TEXT, profiles.address,
      'Thu dinh ky don ' || v_sale_code, 'sales_recurring', p_billgo_cycle, p_billgo_cycle,
      v_billgo_total, v_billgo_total, p_billgo_start_date, v_billgo_due_date,
      p_billgo_start_date, 'Tao tu don ban ' || v_sale_code, auth.uid(), auth.uid()
    FROM public.profiles
    WHERE profiles.id = p_customer_id
    RETURNING id INTO v_subscription_id;

    INSERT INTO public.billgo_receivables (
      customer_id, worker_id, subscription_id, type, title, total_amount, due_date,
      period_start, period_end, collection_month, usage_month, billing_month, billing_year,
      cycle_at_collection, billing_months, bonus_months, service_months, paid_amount,
      monthly_fee_at_collection, next_period_start, next_due_date, status, note, created_by
    )
    VALUES (
      p_customer_id, v_worker_id, v_subscription_id, 'subscription_fee',
      'Thu dinh ky don ' || v_sale_code, v_billgo_total, v_billgo_due_date,
      p_billgo_start_date, v_billgo_period_end, v_billgo_collection_month,
      date_trunc('month', p_billgo_start_date)::DATE,
      EXTRACT(MONTH FROM v_billgo_collection_month)::INTEGER,
      EXTRACT(YEAR FROM v_billgo_collection_month)::INTEGER,
      p_billgo_cycle, v_billgo_paid_months, v_billgo_bonus_months, v_billgo_service_months, 0,
      v_billgo_total, v_billgo_next_period_start, v_billgo_next_due_date,
      'unpaid', 'Tao tu don ban ' || v_sale_code, auth.uid()
    );
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB, BOOLEAN, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB, BOOLEAN, TEXT, DATE) TO authenticated;
