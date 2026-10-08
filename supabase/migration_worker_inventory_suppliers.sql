CREATE TABLE IF NOT EXISTS public.worker_inventory_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_code TEXT,
  warranty_policy TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS worker_inventory_suppliers_worker_id_idx
  ON public.worker_inventory_suppliers(worker_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS worker_inventory_suppliers_name_idx
  ON public.worker_inventory_suppliers(worker_id, name);

DROP TRIGGER IF EXISTS update_worker_inventory_suppliers_updated_at
  ON public.worker_inventory_suppliers;

CREATE TRIGGER update_worker_inventory_suppliers_updated_at
  BEFORE UPDATE ON public.worker_inventory_suppliers
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.worker_inventory_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Unit inventory members view suppliers" ON public.worker_inventory_suppliers;
DROP POLICY IF EXISTS "Unit inventory members manage suppliers" ON public.worker_inventory_suppliers;
DROP POLICY IF EXISTS "Admins manage all inventory suppliers" ON public.worker_inventory_suppliers;

CREATE POLICY "Unit inventory members view suppliers" ON public.worker_inventory_suppliers
FOR SELECT USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));

CREATE POLICY "Unit inventory members manage suppliers" ON public.worker_inventory_suppliers
FOR ALL USING (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]))
WITH CHECK (public.current_user_can_access_worker_data(worker_id, ARRAY['owner','manager','sales_inventory']::TEXT[]));

CREATE POLICY "Admins manage all inventory suppliers" ON public.worker_inventory_suppliers
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());