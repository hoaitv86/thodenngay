-- BillGo payment reversal support.

ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_status_check
CHECK (status IN ('paid', 'void'));

ALTER TABLE public.billgo_receipts
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid',
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reversal_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billgo_receipts_status_check'
      AND conrelid = 'public.billgo_receipts'::regclass
  ) THEN
    ALTER TABLE public.billgo_receipts
    ADD CONSTRAINT billgo_receipts_status_check
    CHECK (status IN ('paid', 'reversed', 'void'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.billgo_payment_reversals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  receivable_id UUID NOT NULL REFERENCES public.billgo_receivables(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.billgo_subscriptions(id) ON DELETE SET NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT,
  period_start DATE,
  period_end DATE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  previous_status TEXT,
  next_status TEXT,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billgo_payment_reversals_receivable_idx
  ON public.billgo_payment_reversals(receivable_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billgo_payment_reversals_worker_idx
  ON public.billgo_payment_reversals(worker_id, created_at DESC);

ALTER TABLE public.billgo_payment_reversals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all BillGo payment reversals" ON public.billgo_payment_reversals;
CREATE POLICY "Admins manage all BillGo payment reversals"
ON public.billgo_payment_reversals
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Workers view own BillGo payment reversals" ON public.billgo_payment_reversals;
CREATE POLICY "Workers view own BillGo payment reversals"
ON public.billgo_payment_reversals
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = billgo_payment_reversals.worker_id
      AND worker.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Workers create own BillGo payment reversals" ON public.billgo_payment_reversals;
CREATE POLICY "Workers create own BillGo payment reversals"
ON public.billgo_payment_reversals
FOR INSERT
WITH CHECK (
  performed_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = billgo_payment_reversals.worker_id
      AND worker.user_id = auth.uid()
  )
);
