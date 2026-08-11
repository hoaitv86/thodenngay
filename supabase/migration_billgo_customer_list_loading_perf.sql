-- Optimize BillGo customer list loading before offline-first sync.
-- Safe to run repeatedly; all indexes are additive and non-destructive.

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_customer_idx
  ON public.billgo_subscriptions(worker_id, customer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_phone_idx
  ON public.billgo_subscriptions(worker_id, phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_account_lookup_perf_idx
  ON public.billgo_subscriptions(worker_id, lower(internet_account))
  WHERE deleted_at IS NULL AND internet_account IS NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_next_due_status_idx
  ON public.billgo_subscriptions(worker_id, next_due_date, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_area_status_idx
  ON public.billgo_subscriptions(worker_id, area_id, sub_area_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_receivables_worker_due_status_idx
  ON public.billgo_receivables(worker_id, due_date, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_receivables_worker_period_status_perf_idx
  ON public.billgo_receivables(worker_id, billing_year, billing_month, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_receivables_subscription_status_period_idx
  ON public.billgo_receivables(subscription_id, status, period_end)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_receivables_customer_idx
  ON public.billgo_receivables(customer_id)
  WHERE customer_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_payment_coverages_subscription_month_idx
  ON public.billgo_payment_coverages(subscription_id, covered_month);

CREATE INDEX IF NOT EXISTS payments_receivable_status_paid_at_idx
  ON public.payments(receivable_id, status, paid_at DESC)
  WHERE receivable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_receipts_subscription_paid_at_perf_idx
  ON public.billgo_receipts(subscription_id, paid_at DESC)
  WHERE subscription_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billgo_subscriptions' AND column_name = 'store_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_subscriptions_store_status_due_idx ON public.billgo_subscriptions(store_id, status, next_due_date) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_subscriptions_store_account_idx ON public.billgo_subscriptions(store_id, lower(internet_account)) WHERE deleted_at IS NULL AND internet_account IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_subscriptions_store_phone_idx ON public.billgo_subscriptions(store_id, phone) WHERE deleted_at IS NULL AND phone IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billgo_receivables' AND column_name = 'store_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_receivables_store_status_due_idx ON public.billgo_receivables(store_id, status, due_date) WHERE deleted_at IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billgo_receivables' AND column_name = 'payment_status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_receivables_payment_status_idx ON public.billgo_receivables(payment_status) WHERE deleted_at IS NULL';
  END IF;
END $$;