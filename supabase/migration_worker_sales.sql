CREATE TABLE IF NOT EXISTS public.worker_sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sale_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  note TEXT,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.worker_sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.worker_sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.worker_inventory_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS worker_sales_orders_worker_id_idx
  ON public.worker_sales_orders(worker_id, sold_at DESC);

CREATE INDEX IF NOT EXISTS worker_sales_orders_customer_id_idx
  ON public.worker_sales_orders(customer_id, sold_at DESC);

CREATE INDEX IF NOT EXISTS worker_sales_order_items_order_id_idx
  ON public.worker_sales_order_items(order_id);

DROP TRIGGER IF EXISTS update_worker_sales_orders_updated_at
  ON public.worker_sales_orders;

CREATE TRIGGER update_worker_sales_orders_updated_at
  BEFORE UPDATE ON public.worker_sales_orders
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.worker_sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_sales_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own sales orders"
  ON public.worker_sales_orders;
CREATE POLICY "Workers view own sales orders"
  ON public.worker_sales_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workers
      WHERE workers.id = worker_sales_orders.worker_id
        AND workers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workers view own sales order items"
  ON public.worker_sales_order_items;
CREATE POLICY "Workers view own sales order items"
  ON public.worker_sales_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.worker_sales_orders
      JOIN public.workers ON workers.id = worker_sales_orders.worker_id
      WHERE worker_sales_orders.id = worker_sales_order_items.order_id
        AND workers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage all sales orders"
  ON public.worker_sales_orders;
CREATE POLICY "Admins manage all sales orders"
  ON public.worker_sales_orders
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage all sales order items"
  ON public.worker_sales_order_items;
CREATE POLICY "Admins manage all sales order items"
  ON public.worker_sales_order_items
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.create_worker_sales_order(
  p_customer_id UUID,
  p_note TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
  v_order_id UUID;
  v_sale_code TEXT;
  v_item JSONB;
  v_product RECORD;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC(14, 2);
  v_line_total NUMERIC(14, 2);
  v_total_amount NUMERIC(14, 2) := 0;
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

  IF p_customer_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_customer_id
      AND role = 'customer'
  ) THEN
    RAISE EXCEPTION 'Khach hang khong hop le.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE worker_id = v_worker_id
      AND customer_id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'Khach hang chua nam trong danh sach phuc vu cua tho.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Vui long chon it nhat mot san pham.';
  END IF;

  v_sale_code := 'SALE-' || to_char(NOW(), 'YYMMDD-HH24MISS') || '-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6));

  INSERT INTO public.worker_sales_orders (
    worker_id,
    customer_id,
    sale_code,
    total_amount,
    note,
    created_by
  )
  VALUES (
    v_worker_id,
    p_customer_id,
    v_sale_code,
    0,
    NULLIF(trim(coalesce(p_note, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unitPrice')::NUMERIC(14, 2);

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Thong tin san pham khong hop le.';
    END IF;

    SELECT *
    INTO v_product
    FROM public.worker_inventory_products
    WHERE id = v_product_id
      AND worker_id = v_worker_id
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
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.sku,
      v_product.category,
      v_product.unit,
      v_quantity,
      v_unit_price,
      v_line_total
    );
  END LOOP;

  UPDATE public.worker_sales_orders
  SET total_amount = v_total_amount
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_worker_sales_order(UUID, TEXT, JSONB) TO authenticated;
