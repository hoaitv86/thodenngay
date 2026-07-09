-- BillGo subscriptions and standalone receivables.
-- Safe migration: adds BillGo tables and links payments to receivables without deleting old job data.

CREATE TABLE IF NOT EXISTS public.billgo_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  customer_name TEXT,
  internet_account TEXT,
  customer_address TEXT,
  package_name TEXT NOT NULL DEFAULT 'Cước Internet',
  service_type TEXT NOT NULL DEFAULT 'internet',
  cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (cycle IN ('monthly', 'three_months', 'six_months', 'yearly')),
  amount_per_cycle DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billgo_receivables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.billgo_subscriptions(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'service_fee' CHECK (type IN ('installation_fee', 'subscription_fee', 'service_fee', 'other')),
  title TEXT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE,
  period_end DATE,
  billing_months INTEGER NOT NULL DEFAULT 0,
  bonus_months INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS receivable_id UUID REFERENCES public.billgo_receivables(id) ON DELETE SET NULL;

ALTER TABLE public.payments
ALTER COLUMN job_id DROP NOT NULL;

-- A BillGo customer can be created independently from a normal app customer.
-- Existing customer links remain intact; new standalone records use the fields below.
ALTER TABLE public.billgo_subscriptions
ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.billgo_subscriptions
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS internet_account TEXT,
ADD COLUMN IF NOT EXISTS customer_address TEXT;

ALTER TABLE public.billgo_receivables
ALTER COLUMN customer_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_customer_id_idx ON public.billgo_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_id_idx ON public.billgo_subscriptions(worker_id);
CREATE INDEX IF NOT EXISTS billgo_subscriptions_next_due_date_idx ON public.billgo_subscriptions(next_due_date);
CREATE UNIQUE INDEX IF NOT EXISTS billgo_subscriptions_worker_account_active_idx
ON public.billgo_subscriptions(worker_id, internet_account)
WHERE internet_account IS NOT NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS billgo_receivables_customer_id_idx ON public.billgo_receivables(customer_id);
CREATE INDEX IF NOT EXISTS billgo_receivables_worker_id_idx ON public.billgo_receivables(worker_id);
CREATE INDEX IF NOT EXISTS billgo_receivables_subscription_id_idx ON public.billgo_receivables(subscription_id);
CREATE INDEX IF NOT EXISTS billgo_receivables_due_date_idx ON public.billgo_receivables(due_date);
CREATE INDEX IF NOT EXISTS billgo_receivables_status_idx ON public.billgo_receivables(status);
CREATE INDEX IF NOT EXISTS payments_receivable_id_idx ON public.payments(receivable_id);

DROP TRIGGER IF EXISTS update_billgo_subscriptions_updated_at ON public.billgo_subscriptions;
CREATE TRIGGER update_billgo_subscriptions_updated_at
BEFORE UPDATE ON public.billgo_subscriptions
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_billgo_receivables_updated_at ON public.billgo_receivables;
CREATE TRIGGER update_billgo_receivables_updated_at
BEFORE UPDATE ON public.billgo_receivables
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Backfill one receivable per existing priced job to keep old payment/debt history visible in BillGo.
INSERT INTO public.billgo_receivables (
  customer_id,
  worker_id,
  job_id,
  type,
  title,
  total_amount,
  due_date,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  jobs.customer_id,
  jobs.worker_id,
  jobs.id,
  'service_fee',
  COALESCE('Công việc ' || jobs.job_code, 'Công việc'),
  COALESCE(jobs.quoted_price, 0),
  COALESCE(jobs.scheduled_at::date, jobs.created_at::date, CURRENT_DATE),
  CASE
    WHEN COALESCE(jobs.quoted_price, 0) <= 0 THEN 'paid'
    WHEN COALESCE(payment_totals.paid_amount, 0) >= COALESCE(jobs.quoted_price, 0) THEN 'paid'
    WHEN COALESCE(payment_totals.paid_amount, 0) > 0 THEN 'partial'
    WHEN COALESCE(jobs.scheduled_at::date, jobs.created_at::date, CURRENT_DATE) < CURRENT_DATE THEN 'overdue'
    ELSE 'unpaid'
  END,
  jobs.created_by,
  jobs.created_at,
  NOW()
FROM public.jobs
LEFT JOIN (
  SELECT job_id, SUM(amount) AS paid_amount
  FROM public.payments
  WHERE status = 'paid' AND job_id IS NOT NULL
  GROUP BY job_id
) payment_totals ON payment_totals.job_id = jobs.id
WHERE COALESCE(jobs.quoted_price, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.billgo_receivables existing
    WHERE existing.job_id = jobs.id
  );

UPDATE public.payments
SET receivable_id = billgo_receivables.id
FROM public.billgo_receivables
WHERE payments.receivable_id IS NULL
  AND payments.job_id = billgo_receivables.job_id;

ALTER TABLE public.billgo_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billgo_receivables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Customers view own BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Workers view assigned BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Admins manage all BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Customers view own BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Workers view assigned BillGo receivables" ON public.billgo_receivables;

CREATE POLICY "Admins manage all BillGo subscriptions"
ON public.billgo_subscriptions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Customers view own BillGo subscriptions"
ON public.billgo_subscriptions
FOR SELECT
USING (customer_id = auth.uid());

CREATE POLICY "Workers view assigned BillGo subscriptions"
ON public.billgo_subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workers
    WHERE workers.id = billgo_subscriptions.worker_id
      AND workers.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all BillGo receivables"
ON public.billgo_receivables
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Customers view own BillGo receivables"
ON public.billgo_receivables
FOR SELECT
USING (customer_id = auth.uid());

CREATE POLICY "Workers view assigned BillGo receivables"
ON public.billgo_receivables
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workers
    WHERE workers.id = billgo_receivables.worker_id
      AND workers.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers view own payments" ON public.payments;
DROP POLICY IF EXISTS "Workers view assigned job payments" ON public.payments;
DROP POLICY IF EXISTS "Workers collect assigned job payments" ON public.payments;

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
  OR EXISTS (
    SELECT 1
    FROM public.billgo_receivables
    WHERE billgo_receivables.id = payments.receivable_id
      AND billgo_receivables.customer_id = auth.uid()
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
  OR EXISTS (
    SELECT 1
    FROM public.billgo_receivables
    JOIN public.workers ON workers.id = billgo_receivables.worker_id
    WHERE billgo_receivables.id = payments.receivable_id
      AND workers.user_id = auth.uid()
  )
);

CREATE POLICY "Workers collect assigned job payments"
ON public.payments
FOR INSERT
WITH CHECK (
  status = 'paid'
  AND collected_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM public.jobs
      JOIN public.workers ON workers.id = jobs.worker_id
      WHERE jobs.id = payments.job_id
        AND workers.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.billgo_receivables
      JOIN public.workers ON workers.id = billgo_receivables.worker_id
      WHERE billgo_receivables.id = payments.receivable_id
        AND workers.user_id = auth.uid()
    )
  )
);
