ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS home_warranty_12m_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (home_warranty_12m_price >= 0),
  ADD COLUMN IF NOT EXISTS home_warranty_24m_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (home_warranty_24m_price >= 0);

ALTER TABLE public.worker_customer_devices
  ADD COLUMN IF NOT EXISTS home_warranty_months INTEGER NOT NULL DEFAULT 0 CHECK (home_warranty_months >= 0),
  ADD COLUMN IF NOT EXISTS home_warranty_start DATE,
  ADD COLUMN IF NOT EXISTS home_warranty_end DATE;

CREATE INDEX IF NOT EXISTS worker_customer_devices_home_warranty_end_idx
  ON public.worker_customer_devices(worker_id, home_warranty_end DESC)
  WHERE home_warranty_end IS NOT NULL;