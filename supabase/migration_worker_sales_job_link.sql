ALTER TABLE public.worker_sales_orders
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS worker_sales_orders_job_id_idx
  ON public.worker_sales_orders(job_id);

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

  SELECT id INTO v_worker_id
  FROM public.workers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay ho so tho.';
  END IF;

  SELECT customer_id INTO v_customer_id
  FROM public.jobs
  WHERE id = p_job_id
    AND worker_id = v_worker_id
    AND status IN ('assigned', 'in_progress')
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cong viec khong hop le hoac da hoan thanh.';
  END IF;

  IF p_completion_items IS NULL OR jsonb_typeof(p_completion_items) <> 'array' OR jsonb_array_length(p_completion_items) = 0 THEN
    RAISE EXCEPTION 'Vui long nhap hang muc hoan thanh.';
  END IF;

  IF p_material_items IS NOT NULL AND jsonb_typeof(p_material_items) = 'array' AND jsonb_array_length(p_material_items) > 0 THEN
    v_sale_code := 'JOBSALE-' || to_char(NOW(), 'YYMMDD-HH24MISS') || '-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6));

    INSERT INTO public.worker_sales_orders (
      worker_id,
      customer_id,
      job_id,
      sale_code,
      total_amount,
      note,
      created_by
    )
    VALUES (
      v_worker_id,
      v_customer_id,
      p_job_id,
      v_sale_code,
      0,
      'Vat tu su dung cho cong viec',
      auth.uid()
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_material_items)
    LOOP
      v_product_id := (v_item->>'productId')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;
      v_unit_price := (v_item->>'unitPrice')::NUMERIC(14, 2);

      IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_unit_price IS NULL OR v_unit_price < 0 THEN
        RAISE EXCEPTION 'Thong tin vat tu khong hop le.';
      END IF;

      SELECT *
      INTO v_product
      FROM public.worker_inventory_products
      WHERE id = v_product_id
        AND worker_id = v_worker_id
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
    SET total_amount = v_material_total
    WHERE id = v_order_id;
  END IF;

  UPDATE public.jobs
  SET
    status = 'completed',
    images = COALESCE(p_images, ARRAY[]::TEXT[]),
    completion_items = p_completion_items,
    final_amount = COALESCE(p_final_amount, 0),
    warranty_days = COALESCE(p_warranty_days, 0),
    warranty_note = NULLIF(trim(COALESCE(p_warranty_note, '')), '')
  WHERE id = p_job_id
    AND worker_id = v_worker_id;

  INSERT INTO public.job_logs (
    job_id,
    actor_id,
    action,
    metadata
  )
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

REVOKE ALL ON FUNCTION public.complete_worker_job_with_materials(UUID, TEXT[], JSONB, NUMERIC, INTEGER, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_worker_job_with_materials(UUID, TEXT[], JSONB, NUMERIC, INTEGER, TEXT, JSONB) TO authenticated;
