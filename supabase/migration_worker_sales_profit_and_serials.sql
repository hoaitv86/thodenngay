ALTER TABLE public.worker_sales_orders
  ADD COLUMN IF NOT EXISTS cost_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (cost_total >= 0),
  ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.worker_sales_order_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  ADD COLUMN IF NOT EXISTS cost_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (cost_total >= 0),
  ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.worker_inventory_receipt_item_serials
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES public.worker_sales_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_order_item_id UUID REFERENCES public.worker_sales_order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'worker_inventory_receipt_item_serials_status_check'
      AND conrelid = 'public.worker_inventory_receipt_item_serials'::regclass
  ) THEN
    ALTER TABLE public.worker_inventory_receipt_item_serials
      ADD CONSTRAINT worker_inventory_receipt_item_serials_status_check
      CHECK (status IN ('in_stock', 'sold', 'canceled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worker_inventory_receipt_item_serials_status_idx
  ON public.worker_inventory_receipt_item_serials(product_id, status);
CREATE INDEX IF NOT EXISTS worker_inventory_receipt_item_serials_sales_item_idx
  ON public.worker_inventory_receipt_item_serials(sales_order_item_id);

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  IF to_regclass('public.worker_inventory_products') IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'worker_inventory_products'
        AND column_name = 'recurring_cycle'
    )
  THEN
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

UPDATE public.worker_sales_order_items
SET gross_profit = line_total - cost_total
WHERE cost_total <> 0
  AND gross_profit = 0;

UPDATE public.worker_sales_orders sales_order
SET cost_total = COALESCE(item_totals.cost_total, 0),
    gross_profit = sales_order.total_amount - COALESCE(item_totals.cost_total, 0)
FROM (
  SELECT order_id, SUM(cost_total) AS cost_total
  FROM public.worker_sales_order_items
  GROUP BY order_id
) item_totals
WHERE item_totals.order_id = sales_order.id
  AND COALESCE(item_totals.cost_total, 0) <> 0;

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
SET search_path = public, extensions
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
  v_unit_cost NUMERIC(14, 2);
  v_line_total NUMERIC(14, 2);
  v_cost_total NUMERIC(14, 2);
  v_gross_profit NUMERIC(14, 2);
  v_total_amount NUMERIC(14, 2) := 0;
  v_total_cost NUMERIC(14, 2) := 0;
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
  v_total_serial_count INTEGER;
  v_available_serial_count INTEGER;
  v_marked_serial_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ban chua dang nhap.';
  END IF;

  SELECT owner_worker.id INTO v_worker_id
  FROM public.worker_unit_members member
  JOIN public.worker_units unit ON unit.id = member.unit_id
  JOIN public.workers owner_worker ON owner_worker.user_id = unit.owner_id
  WHERE member.user_id = auth.uid()
    AND member.status = 'active'
    AND member.member_role IN ('owner', 'manager', 'sales_inventory')
  ORDER BY CASE member.member_role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_worker_id IS NULL THEN
    SELECT id INTO v_worker_id
    FROM public.workers
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay ho so tho hoac don vi duoc cap quyen.';
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

  INSERT INTO public.worker_sales_orders (worker_id, customer_id, sale_code, total_amount, cost_total, gross_profit, note, created_by)
  VALUES (v_worker_id, p_customer_id, v_sale_code, 0, 0, 0, NULLIF(trim(coalesce(p_note, '')), ''), auth.uid())
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

    SELECT COUNT(*) INTO v_total_serial_count
    FROM public.worker_inventory_receipt_item_serials serial
    WHERE serial.product_id = v_product.id;

    SELECT COUNT(*) INTO v_available_serial_count
    FROM public.worker_inventory_receipt_item_serials serial
    WHERE serial.product_id = v_product.id
      AND serial.status = 'in_stock';

    IF v_total_serial_count > 0 AND v_available_serial_count < v_quantity THEN
      RAISE EXCEPTION 'Serial/QR cua san pham % khong du de ban.', v_product.name;
    END IF;

    UPDATE public.worker_inventory_products
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_product.id;

    v_unit_cost := COALESCE(v_product.purchase_price, 0);
    v_line_total := v_quantity * v_unit_price;
    v_cost_total := v_quantity * v_unit_cost;
    v_gross_profit := v_line_total - v_cost_total;
    v_total_amount := v_total_amount + v_line_total;
    v_total_cost := v_total_cost + v_cost_total;

    INSERT INTO public.worker_sales_order_items (
      order_id, product_id, product_name, product_sku, category, unit,
      quantity, unit_price, line_total, unit_cost, cost_total, gross_profit
    )
    VALUES (
      v_order_id, v_product.id, v_product.name, v_product.sku, v_product.category, v_product.unit,
      v_quantity, v_unit_price, v_line_total, v_unit_cost, v_cost_total, v_gross_profit
    )
    RETURNING id INTO v_item_id;

    IF v_total_serial_count > 0 THEN
      WITH selected_serials AS (
        SELECT id
        FROM public.worker_inventory_receipt_item_serials
        WHERE product_id = v_product.id AND status = 'in_stock'
        ORDER BY created_at, id
        LIMIT v_quantity
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.worker_inventory_receipt_item_serials serial
      SET status = 'sold',
          sales_order_id = v_order_id,
          sales_order_item_id = v_item_id,
          sold_at = NOW()
      FROM selected_serials
      WHERE serial.id = selected_serials.id;

      GET DIAGNOSTICS v_marked_serial_count = ROW_COUNT;
      IF v_marked_serial_count <> v_quantity THEN
        RAISE EXCEPTION 'Khong the danh dau du serial/QR cho san pham %.', v_product.name;
      END IF;
    END IF;

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

  UPDATE public.worker_sales_orders
  SET total_amount = v_total_amount,
      cost_total = v_total_cost,
      gross_profit = v_total_amount - v_total_cost
  WHERE id = v_order_id;

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

CREATE OR REPLACE FUNCTION public.cancel_worker_sales_order(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ban chua dang nhap.';
  END IF;

  SELECT * INTO v_order
  FROM public.worker_sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Khong tim thay don ban.';
  END IF;

  IF NOT public.current_user_can_access_worker_data(v_order.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]) THEN
    RAISE EXCEPTION 'Ban khong co quyen huy don ban nay.';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN v_order.id;
  END IF;

  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Chi co the huy don ban da luu.';
  END IF;

  FOR v_item IN
    SELECT * FROM public.worker_sales_order_items
    WHERE order_id = v_order.id
    ORDER BY created_at, id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      UPDATE public.worker_inventory_products
      SET stock_quantity = stock_quantity + v_item.quantity
      WHERE id = v_item.product_id AND worker_id = v_order.worker_id;
    END IF;

    UPDATE public.worker_inventory_receipt_item_serials
    SET status = 'in_stock',
        sales_order_id = NULL,
        sales_order_item_id = NULL,
        sold_at = NULL
    WHERE sales_order_item_id = v_item.id;
  END LOOP;

  UPDATE public.worker_product_warranties
  SET status = 'cancelled',
      note = COALESCE(note, '') || CASE WHEN COALESCE(note, '') = '' THEN '' ELSE E'\n' END || 'Huy don ban ' || v_order.sale_code,
      updated_at = NOW()
  WHERE sales_order_id = v_order.id
    AND status <> 'cancelled';

  UPDATE public.worker_sales_orders
  SET status = 'cancelled',
      note = COALESCE(note, '') || CASE WHEN COALESCE(note, '') = '' THEN '' ELSE E'\n' END || 'Huy don va hoan kho ' || NOW()::TEXT,
      updated_at = NOW()
  WHERE id = v_order.id;

  RETURN v_order.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB, BOOLEAN, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB, BOOLEAN, TEXT, DATE) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_worker_sales_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_worker_sales_order(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_worker_inventory_receipt(p_receipt_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt RECORD;
  v_item RECORD;
  v_product RECORD;
  v_blocked_serial_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ban chua dang nhap.';
  END IF;

  SELECT * INTO v_receipt
  FROM public.worker_inventory_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Khong tim thay phieu nhap.';
  END IF;

  IF NOT public.current_user_can_access_worker_data(v_receipt.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]) THEN
    RAISE EXCEPTION 'Ban khong co quyen huy phieu nhap nay.';
  END IF;

  IF v_receipt.status = 'canceled' THEN
    RETURN v_receipt.id;
  END IF;

  FOR v_item IN
    SELECT * FROM public.worker_inventory_receipt_items
    WHERE receipt_id = v_receipt.id
    ORDER BY created_at, id
    FOR UPDATE
  LOOP
    WITH locked_serials AS (
      SELECT id, status
      FROM public.worker_inventory_receipt_item_serials
      WHERE receipt_item_id = v_item.id
      FOR UPDATE
    )
    SELECT COUNT(*) INTO v_blocked_serial_count
    FROM locked_serials
    WHERE status <> 'in_stock';

    IF v_blocked_serial_count > 0 THEN
      RAISE EXCEPTION 'Khong the huy phieu nhap vi serial/QR cua san pham % da duoc xu ly.', v_item.product_name;
    END IF;

    IF v_receipt.status = 'confirmed' AND v_receipt.stock_applied_at IS NOT NULL THEN
      SELECT * INTO v_product
      FROM public.worker_inventory_products
      WHERE id = v_item.product_id AND worker_id = v_receipt.worker_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Khong tim thay san pham % de tru ton khi huy.', v_item.product_name;
      END IF;

      IF v_product.stock_quantity < v_item.quantity THEN
        RAISE EXCEPTION 'Ton kho % khong du de huy phieu nhap an toan.', v_product.name;
      END IF;

      UPDATE public.worker_inventory_products
      SET stock_quantity = stock_quantity - v_item.quantity
      WHERE id = v_product.id;
    END IF;

    UPDATE public.worker_inventory_receipt_item_serials
    SET status = 'canceled'
    WHERE receipt_item_id = v_item.id
      AND status = 'in_stock';
  END LOOP;

  UPDATE public.worker_inventory_receipts
  SET status = 'canceled', canceled_at = NOW(), stock_applied_at = NULL
  WHERE id = v_receipt.id;

  RETURN v_receipt.id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_worker_inventory_receipt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_worker_inventory_receipt(UUID) TO authenticated;
