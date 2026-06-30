-- BillGo: payment collection and customer receivables.
-- Debt is derived from jobs + payments, not stored in a separate debt module.

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS note TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_method_check
CHECK (method IN ('cash', 'transfer', 'card', 'momo', 'zalopay', 'other'));

ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_status_check
CHECK (status IN ('paid', 'void'));

ALTER TABLE public.payments
ALTER COLUMN status SET DEFAULT 'paid',
ALTER COLUMN paid_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS payments_job_id_idx ON public.payments(job_id);
CREATE INDEX IF NOT EXISTS payments_collected_by_idx ON public.payments(collected_by);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON public.payments(paid_at);

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all payments" ON public.payments;
DROP POLICY IF EXISTS "Customers view own payments" ON public.payments;
DROP POLICY IF EXISTS "Workers view assigned job payments" ON public.payments;
DROP POLICY IF EXISTS "Workers collect assigned job payments" ON public.payments;

CREATE POLICY "Admins manage all payments"
ON public.payments
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Customers view own payments"
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE jobs.id = payments.job_id
      AND jobs.customer_id = auth.uid()
  )
);

CREATE POLICY "Workers view assigned job payments"
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs
    JOIN public.workers ON workers.id = jobs.worker_id
    WHERE jobs.id = payments.job_id
      AND workers.user_id = auth.uid()
  )
);

CREATE POLICY "Workers collect assigned job payments"
ON public.payments
FOR INSERT
WITH CHECK (
  status = 'paid'
  AND collected_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.jobs
    JOIN public.workers ON workers.id = jobs.worker_id
    WHERE jobs.id = payments.job_id
      AND workers.user_id = auth.uid()
  )
);
