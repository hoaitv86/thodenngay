CREATE TABLE IF NOT EXISTS public.worker_customer_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.worker_inventory_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  category TEXT,
  device_label TEXT NOT NULL,
  device_index INTEGER NOT NULL DEFAULT 1 CHECK (device_index > 0),
  qr_code TEXT,
  serial TEXT,
  uid TEXT,
  install_location TEXT,
  installed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  warranty_months INTEGER NOT NULL DEFAULT 0 CHECK (warranty_months >= 0),
  sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  cost_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  repair_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS worker_customer_devices_worker_id_idx
  ON public.worker_customer_devices(worker_id, installed_at DESC);

CREATE INDEX IF NOT EXISTS worker_customer_devices_customer_id_idx
  ON public.worker_customer_devices(customer_id, installed_at DESC);

CREATE INDEX IF NOT EXISTS worker_customer_devices_job_id_idx
  ON public.worker_customer_devices(job_id);

DROP TRIGGER IF EXISTS update_worker_customer_devices_updated_at
  ON public.worker_customer_devices;

CREATE TRIGGER update_worker_customer_devices_updated_at
  BEFORE UPDATE ON public.worker_customer_devices
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.worker_customer_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own customer devices" ON public.worker_customer_devices;
DROP POLICY IF EXISTS "Workers create own customer devices" ON public.worker_customer_devices;
DROP POLICY IF EXISTS "Workers update own customer devices" ON public.worker_customer_devices;
DROP POLICY IF EXISTS "Customers view own devices" ON public.worker_customer_devices;

CREATE POLICY "Workers view own customer devices"
  ON public.worker_customer_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workers worker
      WHERE worker.id = worker_customer_devices.worker_id
        AND worker.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers create own customer devices"
  ON public.worker_customer_devices
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workers worker
      WHERE worker.id = worker_customer_devices.worker_id
        AND worker.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers update own customer devices"
  ON public.worker_customer_devices
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workers worker
      WHERE worker.id = worker_customer_devices.worker_id
        AND worker.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workers worker
      WHERE worker.id = worker_customer_devices.worker_id
        AND worker.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers view own devices"
  ON public.worker_customer_devices
  FOR SELECT
  USING (customer_id = auth.uid());
