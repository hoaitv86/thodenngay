CREATE TABLE IF NOT EXISTS public.worker_inventory_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.worker_inventory_suppliers(id) ON DELETE SET NULL,
  receipt_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'canceled')),
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  note TEXT,
  confirmed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  stock_applied_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(worker_id, receipt_code)
);

CREATE TABLE IF NOT EXISTS public.worker_inventory_receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES public.worker_inventory_receipts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.worker_inventory_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  line_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  warranty_months INTEGER NOT NULL DEFAULT 0 CHECK (warranty_months >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.worker_inventory_receipt_item_serials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_item_id UUID NOT NULL REFERENCES public.worker_inventory_receipt_items(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.worker_inventory_products(id) ON DELETE SET NULL,
  serial_code TEXT,
  qr_code TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NULLIF(BTRIM(COALESCE(serial_code, '')), '') IS NOT NULL OR NULLIF(BTRIM(COALESCE(qr_code, '')), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS worker_inventory_receipts_worker_id_idx
  ON public.worker_inventory_receipts(worker_id, received_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS worker_inventory_receipts_supplier_id_idx
  ON public.worker_inventory_receipts(supplier_id, received_at DESC);
CREATE INDEX IF NOT EXISTS worker_inventory_receipt_items_receipt_id_idx
  ON public.worker_inventory_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS worker_inventory_receipt_items_product_id_idx
  ON public.worker_inventory_receipt_items(product_id);
CREATE INDEX IF NOT EXISTS worker_inventory_receipt_item_serials_item_id_idx
  ON public.worker_inventory_receipt_item_serials(receipt_item_id);
CREATE INDEX IF NOT EXISTS worker_inventory_receipt_item_serials_product_id_idx
  ON public.worker_inventory_receipt_item_serials(product_id);

DROP TRIGGER IF EXISTS update_worker_inventory_receipts_updated_at
  ON public.worker_inventory_receipts;
CREATE TRIGGER update_worker_inventory_receipts_updated_at
  BEFORE UPDATE ON public.worker_inventory_receipts
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.worker_inventory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_inventory_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_inventory_receipt_item_serials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Unit inventory members view receipts" ON public.worker_inventory_receipts;
DROP POLICY IF EXISTS "Unit inventory members manage receipts" ON public.worker_inventory_receipts;
DROP POLICY IF EXISTS "Admins manage all inventory receipts" ON public.worker_inventory_receipts;
DROP POLICY IF EXISTS "Unit inventory members view receipt items" ON public.worker_inventory_receipt_items;
DROP POLICY IF EXISTS "Unit inventory members manage receipt items" ON public.worker_inventory_receipt_items;
DROP POLICY IF EXISTS "Admins manage all inventory receipt items" ON public.worker_inventory_receipt_items;
DROP POLICY IF EXISTS "Unit inventory members view receipt serials" ON public.worker_inventory_receipt_item_serials;
DROP POLICY IF EXISTS "Unit inventory members manage receipt serials" ON public.worker_inventory_receipt_item_serials;
DROP POLICY IF EXISTS "Admins manage all inventory receipt serials" ON public.worker_inventory_receipt_item_serials;

CREATE POLICY "Unit inventory members view receipts" ON public.worker_inventory_receipts
FOR SELECT USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));
CREATE POLICY "Unit inventory members manage receipts" ON public.worker_inventory_receipts
FOR ALL USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));
CREATE POLICY "Admins manage all inventory receipts" ON public.worker_inventory_receipts
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Unit inventory members view receipt items" ON public.worker_inventory_receipt_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_inventory_receipts receipt
    WHERE receipt.id = worker_inventory_receipt_items.receipt_id
      AND public.current_user_can_access_worker_data(receipt.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[])
  )
);
CREATE POLICY "Unit inventory members manage receipt items" ON public.worker_inventory_receipt_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.worker_inventory_receipts receipt
    WHERE receipt.id = worker_inventory_receipt_items.receipt_id
      AND public.current_user_can_access_worker_data(receipt.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[])
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.worker_inventory_receipts receipt
    WHERE receipt.id = worker_inventory_receipt_items.receipt_id
      AND public.current_user_can_access_worker_data(receipt.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[])
  )
);
CREATE POLICY "Admins manage all inventory receipt items" ON public.worker_inventory_receipt_items
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Unit inventory members view receipt serials" ON public.worker_inventory_receipt_item_serials
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_inventory_receipt_items item
    JOIN public.worker_inventory_receipts receipt ON receipt.id = item.receipt_id
    WHERE item.id = worker_inventory_receipt_item_serials.receipt_item_id
      AND public.current_user_can_access_worker_data(receipt.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[])
  )
);
CREATE POLICY "Unit inventory members manage receipt serials" ON public.worker_inventory_receipt_item_serials
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.worker_inventory_receipt_items item
    JOIN public.worker_inventory_receipts receipt ON receipt.id = item.receipt_id
    WHERE item.id = worker_inventory_receipt_item_serials.receipt_item_id
      AND public.current_user_can_access_worker_data(receipt.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[])
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.worker_inventory_receipt_items item
    JOIN public.worker_inventory_receipts receipt ON receipt.id = item.receipt_id
    WHERE item.id = worker_inventory_receipt_item_serials.receipt_item_id
      AND public.current_user_can_access_worker_data(receipt.worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[])
  )
);
CREATE POLICY "Admins manage all inventory receipt serials" ON public.worker_inventory_receipt_item_serials
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.save_worker_inventory_receipt(
  p_worker_id UUID,
  p_receipt_id UUID,
  p_supplier_id UUID,
  p_receipt_code TEXT,
  p_received_at DATE,
  p_note TEXT,
  p_status TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt_id UUID;
  v_existing RECORD;
  v_item JSONB;
  v_product RECORD;
  v_product_id UUID;
  v_item_id UUID;
  v_quantity INTEGER;
  v_unit_cost NUMERIC(14, 2);
  v_line_total NUMERIC(14, 2);
  v_total_amount NUMERIC(14, 2) := 0;
  v_status TEXT := COALESCE(NULLIF(BTRIM(p_status), ''), 'draft');
  v_receipt_code TEXT := COALESCE(NULLIF(BTRIM(p_receipt_code), ''), 'NH-' || to_char(NOW(), 'YYMMDD-HH24MISS') || '-' || upper(substr(replace(uuid_generate_v4()::TEXT, '-', ''), 1, 4)));
  v_serial JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ban chua dang nhap.';
  END IF;

  IF p_worker_id IS NULL OR NOT public.current_user_can_access_worker_data(p_worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]) THEN
    RAISE EXCEPTION 'Ban khong co quyen nhap kho nay.';
  END IF;

  IF v_status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION 'Trang thai phieu nhap khong hop le.';
  END IF;

  IF p_supplier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.worker_inventory_suppliers supplier
    WHERE supplier.id = p_supplier_id AND supplier.worker_id = p_worker_id
  ) THEN
    RAISE EXCEPTION 'Nha cung cap khong hop le.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Vui long chon it nhat mot mat hang nhap.';
  END IF;

  IF p_receipt_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.worker_inventory_receipts
    WHERE id = p_receipt_id AND worker_id = p_worker_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Khong tim thay phieu nhap.';
    END IF;

    IF v_existing.status <> 'draft' OR v_existing.stock_applied_at IS NOT NULL THEN
      RAISE EXCEPTION 'Phieu nhap da xac nhan hoac da huy, khong the luu lai de tranh cong kho trung.';
    END IF;

    UPDATE public.worker_inventory_receipts
    SET supplier_id = p_supplier_id,
        receipt_code = v_receipt_code,
        received_at = COALESCE(p_received_at, CURRENT_DATE),
        note = NULLIF(BTRIM(COALESCE(p_note, '')), ''),
        status = v_status,
        total_amount = 0,
        confirmed_at = CASE WHEN v_status = 'confirmed' THEN NOW() ELSE NULL END,
        stock_applied_at = NULL,
        canceled_at = NULL
    WHERE id = p_receipt_id
    RETURNING id INTO v_receipt_id;

    DELETE FROM public.worker_inventory_receipt_items WHERE receipt_id = v_receipt_id;
  ELSE
    INSERT INTO public.worker_inventory_receipts (worker_id, supplier_id, receipt_code, received_at, note, status, total_amount, confirmed_at, created_by)
    VALUES (p_worker_id, p_supplier_id, v_receipt_code, COALESCE(p_received_at, CURRENT_DATE), NULLIF(BTRIM(COALESCE(p_note, '')), ''), v_status, 0, CASE WHEN v_status = 'confirmed' THEN NOW() ELSE NULL END, auth.uid())
    RETURNING id INTO v_receipt_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := NULLIF(v_item->>'quantity', '')::INTEGER;
    v_unit_cost := NULLIF(v_item->>'unitCost', '')::NUMERIC(14, 2);

    IF v_quantity IS NULL OR v_quantity <= 0 OR v_unit_cost IS NULL OR v_unit_cost < 0 THEN
      RAISE EXCEPTION 'So luong hoac don gia nhap khong hop le.';
    END IF;

    IF NULLIF(v_item->>'productId', '') IS NOT NULL THEN
      SELECT * INTO v_product
      FROM public.worker_inventory_products
      WHERE id = (v_item->>'productId')::UUID AND worker_id = p_worker_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'San pham nhap khong ton tai trong kho.';
      END IF;

      v_product_id := v_product.id;
    ELSE
      IF NULLIF(BTRIM(v_item->>'name'), '') IS NULL
        OR NULLIF(BTRIM(v_item->>'sku'), '') IS NULL
        OR NULLIF(BTRIM(v_item->>'category'), '') IS NULL
        OR NULLIF(BTRIM(v_item->>'unit'), '') IS NULL THEN
        RAISE EXCEPTION 'San pham moi thieu ten, ma, danh muc hoac don vi.';
      END IF;

      INSERT INTO public.worker_inventory_products (
        worker_id, name, sku, category, purchase_price, default_sale_price, stock_quantity, unit, warranty_months, note
      )
      VALUES (
        p_worker_id,
        BTRIM(v_item->>'name'),
        UPPER(BTRIM(v_item->>'sku')),
        BTRIM(v_item->>'category'),
        v_unit_cost,
        COALESCE(NULLIF(v_item->>'defaultSalePrice', '')::NUMERIC(14, 2), 0),
        0,
        BTRIM(v_item->>'unit'),
        COALESCE(NULLIF(v_item->>'warrantyMonths', '')::INTEGER, 0),
        NULLIF(BTRIM(COALESCE(v_item->>'note', '')), '')
      )
      RETURNING * INTO v_product;

      v_product_id := v_product.id;
    END IF;

    v_line_total := v_quantity * v_unit_cost;
    v_total_amount := v_total_amount + v_line_total;

    INSERT INTO public.worker_inventory_receipt_items (
      receipt_id, product_id, product_name, product_sku, category, unit, quantity, unit_cost, line_total, warranty_months
    ) VALUES (
      v_receipt_id,
      v_product_id,
      COALESCE(NULLIF(BTRIM(v_item->>'name'), ''), v_product.name),
      COALESCE(NULLIF(UPPER(BTRIM(v_item->>'sku')), ''), v_product.sku),
      COALESCE(NULLIF(BTRIM(v_item->>'category'), ''), v_product.category),
      COALESCE(NULLIF(BTRIM(v_item->>'unit'), ''), v_product.unit),
      v_quantity,
      v_unit_cost,
      v_line_total,
      COALESCE(NULLIF(v_item->>'warrantyMonths', '')::INTEGER, v_product.warranty_months, 0)
    ) RETURNING id INTO v_item_id;

    IF jsonb_typeof(v_item->'serials') = 'array' THEN
      FOR v_serial IN SELECT value FROM jsonb_array_elements(v_item->'serials')
      LOOP
        IF NULLIF(BTRIM(COALESCE(v_serial->>'serialCode', '')), '') IS NOT NULL OR NULLIF(BTRIM(COALESCE(v_serial->>'qrCode', '')), '') IS NOT NULL THEN
          INSERT INTO public.worker_inventory_receipt_item_serials (receipt_item_id, product_id, serial_code, qr_code, note)
          VALUES (
            v_item_id,
            v_product_id,
            NULLIF(BTRIM(COALESCE(v_serial->>'serialCode', '')), ''),
            NULLIF(BTRIM(COALESCE(v_serial->>'qrCode', '')), ''),
            NULLIF(BTRIM(COALESCE(v_serial->>'note', '')), '')
          );
        END IF;
      END LOOP;
    END IF;

    IF v_status = 'confirmed' THEN
      UPDATE public.worker_inventory_products
      SET stock_quantity = stock_quantity + v_quantity,
          purchase_price = v_unit_cost
      WHERE id = v_product_id AND worker_id = p_worker_id;
    END IF;
  END LOOP;

  UPDATE public.worker_inventory_receipts
  SET total_amount = v_total_amount,
      stock_applied_at = CASE WHEN v_status = 'confirmed' THEN NOW() ELSE NULL END
  WHERE id = v_receipt_id;

  RETURN v_receipt_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Ma phieu nhap hoac ma san pham da ton tai.';
END;
$$;

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

  IF v_receipt.status = 'confirmed' AND v_receipt.stock_applied_at IS NOT NULL THEN
    FOR v_item IN SELECT * FROM public.worker_inventory_receipt_items WHERE receipt_id = v_receipt.id
    LOOP
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
    END LOOP;
  END IF;

  UPDATE public.worker_inventory_receipts
  SET status = 'canceled', canceled_at = NOW(), stock_applied_at = NULL
  WHERE id = v_receipt.id;

  RETURN v_receipt.id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_worker_inventory_receipt(UUID, UUID, UUID, TEXT, DATE, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_worker_inventory_receipt(UUID, UUID, UUID, TEXT, DATE, TEXT, TEXT, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_worker_inventory_receipt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_worker_inventory_receipt(UUID) TO authenticated;
