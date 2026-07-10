ALTER TABLE public.worker_inventory_products
  ADD COLUMN IF NOT EXISTS is_recurring_billgo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurring_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (recurring_cycle IN ('monthly', 'three_months', 'six_months', 'yearly'));

CREATE TABLE IF NOT EXISTS public.worker_product_warranties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sales_order_id UUID REFERENCES public.worker_sales_orders(id) ON DELETE SET NULL,
  sales_order_item_id UUID REFERENCES public.worker_sales_order_items(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.worker_inventory_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  warranty_months INTEGER NOT NULL CHECK (warranty_months > 0),
  warranty_start DATE NOT NULL DEFAULT CURRENT_DATE,
  warranty_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'serviced', 'expired', 'cancelled')),
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS worker_product_warranties_worker_id_idx
  ON public.worker_product_warranties(worker_id, warranty_end DESC);

CREATE INDEX IF NOT EXISTS worker_product_warranties_customer_id_idx
  ON public.worker_product_warranties(customer_id, warranty_end DESC);

CREATE INDEX IF NOT EXISTS worker_product_warranties_sales_order_id_idx
  ON public.worker_product_warranties(sales_order_id);

DROP TRIGGER IF EXISTS update_worker_product_warranties_updated_at
  ON public.worker_product_warranties;

CREATE TRIGGER update_worker_product_warranties_updated_at
  BEFORE UPDATE ON public.worker_product_warranties
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.worker_product_warranties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own product warranties"
  ON public.worker_product_warranties;
CREATE POLICY "Workers view own product warranties"
  ON public.worker_product_warranties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workers
      WHERE workers.id = worker_product_warranties.worker_id
        AND workers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers view own product warranties"
  ON public.worker_product_warranties;
CREATE POLICY "Customers view own product warranties"
  ON public.worker_product_warranties
  FOR SELECT
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all product warranties"
  ON public.worker_product_warranties;
CREATE POLICY "Admins manage all product warranties"
  ON public.worker_product_warranties
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_worker_warranty_status(
  p_status TEXT,
  p_warranty_end DATE
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_status = 'serviced' THEN 'Đã bảo hành'
    WHEN p_status = 'active' AND p_warranty_end >= CURRENT_DATE THEN 'Còn bảo hành'
    WHEN p_status = 'active' AND p_warranty_end < CURRENT_DATE THEN 'Hết bảo hành'
    WHEN p_status = 'expired' THEN 'Hết bảo hành'
    ELSE 'Hết bảo hành'
  END;
$$;

DROP FUNCTION IF EXISTS public.create_worker_sales_order(UUID, TEXT, JSONB);

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

  IF p_billgo_cycle NOT IN ('monthly', 'three_months', 'six_months', 'yearly') THEN
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
    v_billgo_period_end := CASE p_billgo_cycle
      WHEN 'three_months' THEN (p_billgo_start_date + INTERVAL '3 months')::DATE
      WHEN 'six_months' THEN (p_billgo_start_date + INTERVAL '6 months')::DATE
      WHEN 'yearly' THEN (p_billgo_start_date + INTERVAL '12 months')::DATE
      ELSE (p_billgo_start_date + INTERVAL '1 month')::DATE
    END;
    v_billgo_due_date := (date_trunc('month', v_billgo_period_end)::DATE + INTERVAL '1 month 19 days')::DATE;

    INSERT INTO public.billgo_subscriptions (
      customer_id, worker_id, customer_name, internet_account, customer_address,
      package_name, service_type, cycle, amount_per_cycle, start_date, next_due_date, note, created_by
    )
    SELECT
      p_customer_id, v_worker_id, profiles.full_name, 'SALE-' || v_order_id::TEXT, profiles.address,
      'Thu định kỳ đơn ' || v_sale_code, 'sales_recurring', p_billgo_cycle, v_billgo_total,
      p_billgo_start_date, v_billgo_due_date, 'Tao tu don ban ' || v_sale_code, auth.uid()
    FROM public.profiles
    WHERE profiles.id = p_customer_id
    RETURNING id INTO v_subscription_id;

    INSERT INTO public.billgo_receivables (
      customer_id, worker_id, subscription_id, type, title, total_amount, due_date,
      period_start, period_end, billing_months, status, note, created_by
    )
    VALUES (
      p_customer_id, v_worker_id, v_subscription_id, 'subscription_fee',
      'Thu định kỳ đơn ' || v_sale_code, v_billgo_total, v_billgo_due_date,
      p_billgo_start_date, v_billgo_period_end,
      CASE p_billgo_cycle WHEN 'three_months' THEN 3 WHEN 'six_months' THEN 6 WHEN 'yearly' THEN 12 ELSE 1 END,
      'unpaid', 'Tao tu don ban ' || v_sale_code, auth.uid()
    );
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB, BOOLEAN, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB, BOOLEAN, TEXT, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_worker_job_with_materials(
  p_job_id UUID,
  p_images TEXT[],
  p_completion_items JSONB,
  p_final_amount NUMERIC,
  p_warranty_days INTEGER,
  p_warranty_note TEXT,
  p_material_items JSONB
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

  SELECT id INTO v_worker_id FROM public.workers WHERE user_id = auth.uid() LIMIT 1;
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay ho so tho.';
  END IF;

  SELECT customer_id INTO v_customer_id
  FROM public.jobs
  WHERE id = p_job_id AND worker_id = v_worker_id AND status IN ('assigned', 'in_progress')
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cong viec khong hop le hoac da hoan thanh.';
  END IF;

  IF p_material_items IS NOT NULL AND jsonb_typeof(p_material_items) = 'array' AND jsonb_array_length(p_material_items) > 0 THEN
    v_sale_code := 'JOBSALE-' || to_char(NOW(), 'YYMMDD-HH24MISS') || '-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6));

    INSERT INTO public.worker_sales_orders (worker_id, customer_id, job_id, sale_code, total_amount, note, created_by)
    VALUES (v_worker_id, v_customer_id, p_job_id, v_sale_code, 0, 'Vat tu su dung cho cong viec', auth.uid())
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_material_items)
    LOOP
      v_product_id := (v_item->>'productId')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;
      v_unit_price := (v_item->>'unitPrice')::NUMERIC(14, 2);

      IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_unit_price IS NULL OR v_unit_price < 0 THEN
        RAISE EXCEPTION 'Thong tin vat tu khong hop le.';
      END IF;

      SELECT * INTO v_product
      FROM public.worker_inventory_products
      WHERE id = v_product_id AND worker_id = v_worker_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Vat tu khong ton tai trong kho.';
      END IF;

      IF v_product.stock_quantity < v_quantity THEN
        RAISE EXCEPTION 'Vat tu % khong du ton kho.', v_product.name;
      END IF;

      UPDATE public.worker_inventory_products
      SET stock_quantity = stock_quantity - v_quantity
      WHERE id = v_product.id;

      v_line_total := v_quantity * v_unit_price;
      v_material_total := v_material_total + v_line_total;

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
          worker_id, customer_id, sales_order_id, sales_order_item_id, job_id, product_id,
          product_name, product_sku, warranty_months, warranty_start, warranty_end, created_by
        )
        VALUES (
          v_worker_id, v_customer_id, v_order_id, v_item_id, p_job_id, v_product.id,
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
      'sales_order_id', v_order_id,
      'material_total', v_material_total,
      'material_count', COALESCE(jsonb_array_length(p_material_items), 0),
      'source', 'worker_job_completion'
    )
  );

  RETURN v_order_id;
END;
$$;
