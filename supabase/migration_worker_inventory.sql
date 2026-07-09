CREATE TABLE IF NOT EXISTS public.worker_inventory_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL,
  purchase_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  default_sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (default_sale_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  unit TEXT NOT NULL,
  warranty_months INTEGER NOT NULL DEFAULT 0 CHECK (warranty_months >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, sku)
);

CREATE INDEX IF NOT EXISTS worker_inventory_products_worker_id_idx
  ON public.worker_inventory_products(worker_id);

CREATE INDEX IF NOT EXISTS worker_inventory_products_category_idx
  ON public.worker_inventory_products(worker_id, category);

DROP TRIGGER IF EXISTS update_worker_inventory_products_updated_at
  ON public.worker_inventory_products;

CREATE TRIGGER update_worker_inventory_products_updated_at
  BEFORE UPDATE ON public.worker_inventory_products
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.worker_inventory_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own inventory products"
  ON public.worker_inventory_products;
CREATE POLICY "Workers view own inventory products"
  ON public.worker_inventory_products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workers
      WHERE workers.id = worker_inventory_products.worker_id
        AND workers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workers create own inventory products"
  ON public.worker_inventory_products;
CREATE POLICY "Workers create own inventory products"
  ON public.worker_inventory_products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workers
      WHERE workers.id = worker_inventory_products.worker_id
        AND workers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workers update own inventory products"
  ON public.worker_inventory_products;
CREATE POLICY "Workers update own inventory products"
  ON public.worker_inventory_products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workers
      WHERE workers.id = worker_inventory_products.worker_id
        AND workers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workers
      WHERE workers.id = worker_inventory_products.worker_id
        AND workers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workers delete own inventory products"
  ON public.worker_inventory_products;
CREATE POLICY "Workers delete own inventory products"
  ON public.worker_inventory_products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workers
      WHERE workers.id = worker_inventory_products.worker_id
        AND workers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage all inventory products"
  ON public.worker_inventory_products;
CREATE POLICY "Admins manage all inventory products"
  ON public.worker_inventory_products
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
