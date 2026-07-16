-- BillGo list filters and server-side pagination indexes.

CREATE INDEX IF NOT EXISTS billgo_receivables_worker_period_status_idx
  ON public.billgo_receivables(worker_id, billing_year, billing_month, status)
  WHERE deleted_at IS NULL AND subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_receivables_worker_period_cycle_idx
  ON public.billgo_receivables(worker_id, billing_year, billing_month, cycle_at_collection)
  WHERE deleted_at IS NULL AND subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_status_next_period_idx
  ON public.billgo_subscriptions(worker_id, status, deleted_at, next_period_start);

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_cycle_idx
  ON public.billgo_subscriptions(worker_id, current_cycle, cycle)
  WHERE deleted_at IS NULL AND status NOT IN ('cancelled', 'deleted');

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_area_sub_area_idx
  ON public.billgo_subscriptions(worker_id, area_id, sub_area_id)
  WHERE deleted_at IS NULL AND status NOT IN ('cancelled', 'deleted');

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_next_due_date_idx
  ON public.billgo_subscriptions(worker_id, next_due_date)
  WHERE deleted_at IS NULL AND status NOT IN ('cancelled', 'deleted');
