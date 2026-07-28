-- Enforce worker unit roles across data access, not just UI visibility.

CREATE OR REPLACE FUNCTION public.current_user_can_access_worker_data(
  p_worker_id UUID,
  p_roles TEXT[] DEFAULT ARRAY['owner','manager','technician','bill_collector','sales_inventory']::TEXT[]
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_billgo_assignment(
  p_area_id UUID,
  p_sub_area_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collector_assignments assignment
    WHERE assignment.user_id = auth.uid()
      AND assignment.is_active
      AND (
        (p_sub_area_id IS NOT NULL AND assignment.sub_area_id = p_sub_area_id)
        OR (p_area_id IS NOT NULL AND assignment.area_id = p_area_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_billgo_row(
  p_worker_id UUID,
  p_area_id UUID,
  p_sub_area_id UUID,
  p_write BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_can_access_worker_data(p_worker_id, ARRAY['owner','manager']::TEXT[])
    OR (
      NOT p_write
      AND public.current_user_can_access_worker_data(p_worker_id, ARRAY['bill_collector']::TEXT[])
      AND public.current_user_has_billgo_assignment(p_area_id, p_sub_area_id)
    )
    OR (
      p_write
      AND public.current_user_can_access_worker_data(p_worker_id, ARRAY['bill_collector']::TEXT[])
      AND public.current_user_has_billgo_assignment(p_area_id, p_sub_area_id)
    );
$$;

-- Areas and assignments
DROP POLICY IF EXISTS "Workers view assigned or own areas" ON public.areas;
DROP POLICY IF EXISTS "Workers create own areas" ON public.areas;
DROP POLICY IF EXISTS "Workers update own areas" ON public.areas;
DROP POLICY IF EXISTS "Workers view assigned or own sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Workers create sub areas in own areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Workers update sub areas in own areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Workers view own collector assignments" ON public.collector_assignments;
DROP POLICY IF EXISTS "Unit managers view own or assigned areas" ON public.areas;
DROP POLICY IF EXISTS "Unit managers create own areas" ON public.areas;
DROP POLICY IF EXISTS "Unit managers update own areas" ON public.areas;
DROP POLICY IF EXISTS "Unit managers view own or assigned sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Unit managers create own sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Unit managers update own sub areas" ON public.sub_areas;
DROP POLICY IF EXISTS "Unit members view collector assignments" ON public.collector_assignments;
DROP POLICY IF EXISTS "Unit managers manage collector assignments" ON public.collector_assignments;

CREATE POLICY "Unit managers view own or assigned areas" ON public.areas
FOR SELECT USING (
  public.is_admin()
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.worker_unit_members member
    JOIN public.worker_units unit ON unit.id = member.unit_id
    WHERE unit.owner_id = areas.owner_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
  OR public.current_user_has_billgo_assignment(id, NULL)
  OR EXISTS (
    SELECT 1 FROM public.collector_assignments assignment
    JOIN public.sub_areas sub_area ON sub_area.id = assignment.sub_area_id
    WHERE sub_area.area_id = areas.id
      AND assignment.user_id = auth.uid()
      AND assignment.is_active
  )
);

CREATE POLICY "Unit managers create own areas" ON public.areas
FOR INSERT WITH CHECK (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.worker_unit_members member
    JOIN public.worker_units unit ON unit.id = member.unit_id
    WHERE unit.owner_id = areas.owner_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit managers update own areas" ON public.areas
FOR UPDATE USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.worker_unit_members member
    JOIN public.worker_units unit ON unit.id = member.unit_id
    WHERE unit.owner_id = areas.owner_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
) WITH CHECK (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.worker_unit_members member
    JOIN public.worker_units unit ON unit.id = member.unit_id
    WHERE unit.owner_id = areas.owner_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit managers view own or assigned sub areas" ON public.sub_areas
FOR SELECT USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.areas area WHERE area.id = sub_areas.area_id AND area.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = sub_areas.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
  OR public.current_user_has_billgo_assignment(area_id, id)
);

CREATE POLICY "Unit managers create own sub areas" ON public.sub_areas
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.areas area WHERE area.id = sub_areas.area_id AND area.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = sub_areas.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit managers update own sub areas" ON public.sub_areas
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.areas area WHERE area.id = sub_areas.area_id AND area.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = sub_areas.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.areas area WHERE area.id = sub_areas.area_id AND area.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = sub_areas.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit members view collector assignments" ON public.collector_assignments
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = collector_assignments.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

CREATE POLICY "Unit managers manage collector assignments" ON public.collector_assignments
FOR ALL USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = collector_assignments.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
) WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.areas area
    JOIN public.worker_units unit ON unit.owner_id = area.owner_id
    JOIN public.worker_unit_members member ON member.unit_id = unit.id
    WHERE area.id = collector_assignments.area_id
      AND member.user_id = auth.uid()
      AND member.status = 'active'
      AND member.member_role IN ('owner','manager')
  )
);

-- BillGo data
DROP POLICY IF EXISTS "Workers view own BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Workers create own BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Workers update own BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Workers view own BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Workers create own BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Workers update own BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Unit members view BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Unit managers manage BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Unit members view BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Unit collectors update assigned BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Unit managers manage BillGo receivables" ON public.billgo_receivables;

CREATE POLICY "Unit members view BillGo subscriptions" ON public.billgo_subscriptions
FOR SELECT USING (public.current_user_can_access_billgo_row(worker_id, area_id, sub_area_id, FALSE));

CREATE POLICY "Unit managers manage BillGo subscriptions" ON public.billgo_subscriptions
FOR ALL USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager']::TEXT[]));

CREATE POLICY "Unit members view BillGo receivables" ON public.billgo_receivables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.billgo_subscriptions subscription
    WHERE subscription.id = billgo_receivables.subscription_id
      AND public.current_user_can_access_billgo_row(billgo_receivables.worker_id, subscription.area_id, subscription.sub_area_id, FALSE)
  )
);

CREATE POLICY "Unit collectors update assigned BillGo receivables" ON public.billgo_receivables
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.billgo_subscriptions subscription
    WHERE subscription.id = billgo_receivables.subscription_id
      AND public.current_user_can_access_billgo_row(billgo_receivables.worker_id, subscription.area_id, subscription.sub_area_id, TRUE)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.billgo_subscriptions subscription
    WHERE subscription.id = billgo_receivables.subscription_id
      AND public.current_user_can_access_billgo_row(billgo_receivables.worker_id, subscription.area_id, subscription.sub_area_id, TRUE)
  )
);

CREATE POLICY "Unit managers manage BillGo receivables" ON public.billgo_receivables
FOR ALL USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager']::TEXT[]));

-- Inventory and sales
DROP POLICY IF EXISTS "Workers view own inventory products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Workers create own inventory products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Workers update own inventory products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Workers delete own inventory products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Unit inventory members view products" ON public.worker_inventory_products;
DROP POLICY IF EXISTS "Unit inventory members manage products" ON public.worker_inventory_products;

CREATE POLICY "Unit inventory members view products" ON public.worker_inventory_products
FOR SELECT USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));
CREATE POLICY "Unit inventory members manage products" ON public.worker_inventory_products
FOR ALL USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));

DROP POLICY IF EXISTS "Workers view own sales orders" ON public.worker_sales_orders;
DROP POLICY IF EXISTS "Workers view own sales order items" ON public.worker_sales_order_items;
DROP POLICY IF EXISTS "Unit sales members view orders" ON public.worker_sales_orders;
DROP POLICY IF EXISTS "Unit sales members view order items" ON public.worker_sales_order_items;

CREATE POLICY "Unit sales members view orders" ON public.worker_sales_orders
FOR SELECT USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));
CREATE POLICY "Unit sales members view order items" ON public.worker_sales_order_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_sales_orders sales_order
    WHERE sales_order.id = worker_sales_order_items.order_id
      AND public.current_user_can_access_worker_data(sales_order.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[])
  )
);

-- Jobs: technicians only their assigned worker rows; owner/manager can inspect unit-owner rows.
DROP POLICY IF EXISTS "Workers view own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Workers update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Unit job members view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Unit job members update jobs" ON public.jobs;

CREATE POLICY "Unit job members view jobs" ON public.jobs
FOR SELECT USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[]));
CREATE POLICY "Unit job members update jobs" ON public.jobs
FOR UPDATE USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','technician']::TEXT[]));

-- Unit-aware sales order RPC for sales/inventory members.
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
