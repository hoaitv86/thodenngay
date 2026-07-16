-- BillGo payment receipts with lookup code and QR payload.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.billgo_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_code TEXT NOT NULL UNIQUE,
  lookup_code TEXT NOT NULL UNIQUE,
  qr_payload TEXT NOT NULL,
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  receivable_id UUID NOT NULL REFERENCES public.billgo_receivables(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.billgo_subscriptions(id) ON DELETE SET NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  collected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  internet_account TEXT,
  customer_address TEXT,
  package_name TEXT,
  cycle_at_collection TEXT,
  period_start DATE,
  period_end DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collector_name TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billgo_receipts_lookup_code_idx
  ON public.billgo_receipts(lookup_code);

CREATE INDEX IF NOT EXISTS billgo_receipts_receivable_paid_at_idx
  ON public.billgo_receipts(receivable_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS billgo_receipts_worker_paid_at_idx
  ON public.billgo_receipts(worker_id, paid_at DESC);

ALTER TABLE public.billgo_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own BillGo receipts" ON public.billgo_receipts;
CREATE POLICY "Workers view own BillGo receipts"
ON public.billgo_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = billgo_receipts.worker_id
      AND worker.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins manage BillGo receipts" ON public.billgo_receipts;
CREATE POLICY "Admins manage BillGo receipts"
ON public.billgo_receipts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);
