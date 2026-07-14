-- BillGo full lifecycle: customer grouping, billing periods, collections, history, and soft delete.
-- Safe to run after the existing BillGo migrations. Existing rows are kept and backfilled.

ALTER TABLE public.billgo_subscriptions
DROP CONSTRAINT IF EXISTS billgo_subscriptions_cycle_check;

ALTER TABLE public.billgo_subscriptions
ADD CONSTRAINT billgo_subscriptions_cycle_check
CHECK (cycle IN ('monthly', 'two_months', 'three_months', 'six_months', 'yearly'));

ALTER TABLE public.billgo_subscriptions
DROP CONSTRAINT IF EXISTS billgo_subscriptions_status_check;

ALTER TABLE public.billgo_subscriptions
ADD CONSTRAINT billgo_subscriptions_status_check
CHECK (status IN ('active', 'paused', 'cancelled', 'deleted'));

ALTER TABLE public.billgo_subscriptions
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS provider TEXT,
ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS current_cycle TEXT,
ADD COLUMN IF NOT EXISTS next_period_start DATE,
ADD COLUMN IF NOT EXISTS covered_until DATE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reactivated_period_start DATE,
ADD COLUMN IF NOT EXISTS last_changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.billgo_subscriptions
SET
  monthly_fee = COALESCE(monthly_fee, amount_per_cycle, 0),
  current_cycle = COALESCE(current_cycle, cycle, 'monthly'),
  next_period_start = COALESCE(next_period_start, start_date, CURRENT_DATE)
WHERE monthly_fee IS NULL OR current_cycle IS NULL OR next_period_start IS NULL;

ALTER TABLE public.billgo_subscriptions
ALTER COLUMN monthly_fee SET DEFAULT 0;

ALTER TABLE public.billgo_receivables
DROP CONSTRAINT IF EXISTS billgo_receivables_status_check;

ALTER TABLE public.billgo_receivables
ADD CONSTRAINT billgo_receivables_status_check
CHECK (status IN ('not_due', 'due', 'unpaid', 'partial', 'paid', 'overdue', 'promo', 'cancelled', 'deleted'));

ALTER TABLE public.billgo_receivables
ADD COLUMN IF NOT EXISTS collection_month DATE,
ADD COLUMN IF NOT EXISTS usage_month DATE,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_fee_at_collection NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS next_period_start DATE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.billgo_receivables receivable
SET
  collection_month = COALESCE(collection_month, date_trunc('month', due_date)::date),
  usage_month = COALESCE(usage_month, date_trunc('month', period_start)::date),
  monthly_fee_at_collection = COALESCE(monthly_fee_at_collection, subscription.monthly_fee, subscription.amount_per_cycle, receivable.total_amount),
  next_period_start = COALESCE(next_period_start, (receivable.period_end + interval '1 day')::date)
FROM public.billgo_subscriptions subscription
WHERE receivable.subscription_id = subscription.id
  AND (receivable.collection_month IS NULL OR receivable.usage_month IS NULL OR receivable.monthly_fee_at_collection IS NULL OR receivable.next_period_start IS NULL);

UPDATE public.billgo_receivables receivable
SET paid_amount = COALESCE(payment_totals.paid_amount, 0),
    paid_at = COALESCE(receivable.paid_at, payment_totals.last_paid_at),
    collected_by = COALESCE(receivable.collected_by, payment_totals.last_collected_by)
FROM (
  SELECT DISTINCT ON (receivable_id)
    receivable_id,
    SUM(amount) OVER (PARTITION BY receivable_id) AS paid_amount,
    paid_at AS last_paid_at,
    collected_by AS last_collected_by
  FROM public.payments
  WHERE receivable_id IS NOT NULL AND status = 'paid'
  ORDER BY receivable_id, paid_at DESC NULLS LAST
) payment_totals
WHERE receivable.id = payment_totals.receivable_id;

CREATE TABLE IF NOT EXISTS public.billgo_payment_coverages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receivable_id UUID NOT NULL REFERENCES public.billgo_receivables(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  subscription_id UUID NOT NULL REFERENCES public.billgo_subscriptions(id) ON DELETE CASCADE,
  covered_month DATE NOT NULL,
  coverage_type TEXT NOT NULL DEFAULT 'paid' CHECK (coverage_type IN ('paid', 'promo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billgo_cycle_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES public.billgo_subscriptions(id) ON DELETE CASCADE,
  old_cycle TEXT NOT NULL,
  new_cycle TEXT NOT NULL,
  effective_period_start DATE NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billgo_status_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES public.billgo_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('paused', 'reactivated', 'deleted', 'restored')),
  effective_period_start DATE,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS billgo_receivables_subscription_period_active_idx
ON public.billgo_receivables(subscription_id, period_start)
WHERE subscription_id IS NOT NULL AND deleted_at IS NULL AND status <> 'cancelled';

DROP INDEX IF EXISTS billgo_subscriptions_worker_account_active_idx;
CREATE UNIQUE INDEX IF NOT EXISTS billgo_subscriptions_worker_account_active_lower_idx
ON public.billgo_subscriptions(worker_id, lower(internet_account))
WHERE internet_account IS NOT NULL AND deleted_at IS NULL AND status NOT IN ('cancelled', 'deleted');

CREATE UNIQUE INDEX IF NOT EXISTS billgo_payment_coverages_subscription_month_idx
ON public.billgo_payment_coverages(subscription_id, covered_month)
WHERE coverage_type IN ('paid', 'promo');

CREATE INDEX IF NOT EXISTS billgo_receivables_collection_month_idx
ON public.billgo_receivables(collection_month);

CREATE INDEX IF NOT EXISTS billgo_receivables_usage_month_idx
ON public.billgo_receivables(usage_month);

CREATE INDEX IF NOT EXISTS billgo_cycle_changes_subscription_idx
ON public.billgo_cycle_changes(subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billgo_status_events_subscription_idx
ON public.billgo_status_events(subscription_id, created_at DESC);

ALTER TABLE public.billgo_payment_coverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billgo_cycle_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billgo_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all BillGo payment coverages" ON public.billgo_payment_coverages;
DROP POLICY IF EXISTS "Workers view own BillGo payment coverages" ON public.billgo_payment_coverages;
DROP POLICY IF EXISTS "Admins manage all BillGo cycle changes" ON public.billgo_cycle_changes;
DROP POLICY IF EXISTS "Workers view own BillGo cycle changes" ON public.billgo_cycle_changes;
DROP POLICY IF EXISTS "Admins manage all BillGo status events" ON public.billgo_status_events;
DROP POLICY IF EXISTS "Workers view own BillGo status events" ON public.billgo_status_events;

CREATE POLICY "Admins manage all BillGo payment coverages"
ON public.billgo_payment_coverages
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Workers view own BillGo payment coverages"
ON public.billgo_payment_coverages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.billgo_subscriptions subscription
    JOIN public.workers worker ON worker.id = subscription.worker_id
    WHERE subscription.id = billgo_payment_coverages.subscription_id
      AND worker.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all BillGo cycle changes"
ON public.billgo_cycle_changes
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Workers view own BillGo cycle changes"
ON public.billgo_cycle_changes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.billgo_subscriptions subscription
    JOIN public.workers worker ON worker.id = subscription.worker_id
    WHERE subscription.id = billgo_cycle_changes.subscription_id
      AND worker.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all BillGo status events"
ON public.billgo_status_events
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Workers view own BillGo status events"
ON public.billgo_status_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.billgo_subscriptions subscription
    JOIN public.workers worker ON worker.id = subscription.worker_id
    WHERE subscription.id = billgo_status_events.subscription_id
      AND worker.user_id = auth.uid()
  )
);
