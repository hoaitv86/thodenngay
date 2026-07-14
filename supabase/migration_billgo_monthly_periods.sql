-- BillGo monthly periods.
-- Safe intent:
-- - billgo_subscriptions remains the fixed BillGo customer table.
-- - billgo_receivables stores one billing period per fixed customer and month/year.
-- - This migration aborts before creating the unique index if duplicate active periods exist.

BEGIN;

ALTER TABLE public.billgo_receivables
ADD COLUMN IF NOT EXISTS billing_month INTEGER,
ADD COLUMN IF NOT EXISTS billing_year INTEGER;

UPDATE public.billgo_receivables
SET
  billing_month = EXTRACT(MONTH FROM COALESCE(collection_month, due_date, period_start, created_at::date, CURRENT_DATE))::INTEGER,
  billing_year = EXTRACT(YEAR FROM COALESCE(collection_month, due_date, period_start, created_at::date, CURRENT_DATE))::INTEGER
WHERE billing_month IS NULL
   OR billing_year IS NULL;

ALTER TABLE public.billgo_receivables
ALTER COLUMN billing_month SET NOT NULL,
ALTER COLUMN billing_year SET NOT NULL;

ALTER TABLE public.billgo_receivables
DROP CONSTRAINT IF EXISTS billgo_receivables_billing_month_check;

ALTER TABLE public.billgo_receivables
ADD CONSTRAINT billgo_receivables_billing_month_check
CHECK (billing_month BETWEEN 1 AND 12);

ALTER TABLE public.billgo_receivables
DROP CONSTRAINT IF EXISTS billgo_receivables_billing_year_check;

ALTER TABLE public.billgo_receivables
ADD CONSTRAINT billgo_receivables_billing_year_check
CHECK (billing_year BETWEEN 2000 AND 2200);

CREATE TABLE IF NOT EXISTS public.billgo_monthly_period_migration_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.billgo_monthly_period_migration_audit (audit_type, payload)
SELECT
  'duplicate_period_precheck',
  jsonb_build_object(
    'subscription_id', subscription_id,
    'billing_month', billing_month,
    'billing_year', billing_year,
    'receivable_ids', receivable_ids,
    'duplicate_count', duplicate_count
  )
FROM (
  SELECT
    subscription_id,
    billing_month,
    billing_year,
    jsonb_agg(id ORDER BY created_at, id) AS receivable_ids,
    COUNT(*) AS duplicate_count
  FROM public.billgo_receivables
  WHERE subscription_id IS NOT NULL
    AND deleted_at IS NULL
    AND status <> 'cancelled'
  GROUP BY subscription_id, billing_month, billing_year
  HAVING COUNT(*) > 1
) duplicates;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.billgo_receivables
    WHERE subscription_id IS NOT NULL
      AND deleted_at IS NULL
      AND status <> 'cancelled'
    GROUP BY subscription_id, billing_month, billing_year
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'BillGo duplicate active monthly periods found. Review billgo_monthly_period_migration_audit before applying the unique index.';
  END IF;
END $$;

DROP INDEX IF EXISTS billgo_receivables_subscription_period_active_idx;
DROP INDEX IF EXISTS billgo_receivables_subscription_billing_month_year_active_idx;

CREATE UNIQUE INDEX billgo_receivables_subscription_billing_month_year_active_idx
ON public.billgo_receivables(subscription_id, billing_month, billing_year)
WHERE subscription_id IS NOT NULL
  AND deleted_at IS NULL
  AND status <> 'cancelled';

COMMENT ON INDEX public.billgo_receivables_subscription_billing_month_year_active_idx
IS 'One active BillGo billing period per fixed BillGo customer (billgo_subscriptions.id) and month/year.';

CREATE INDEX IF NOT EXISTS billgo_receivables_worker_billing_month_year_idx
ON public.billgo_receivables(worker_id, billing_year, billing_month);

CREATE OR REPLACE FUNCTION public.ensure_billgo_monthly_receivables(
  p_worker_id UUID,
  p_billing_month INTEGER,
  p_billing_year INTEGER,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collection_month DATE;
  v_period_start DATE;
  v_period_end DATE;
  v_due_date DATE;
  v_inserted INTEGER := 0;
BEGIN
  IF p_worker_id IS NULL THEN
    RAISE EXCEPTION 'worker_id is required';
  END IF;

  IF p_billing_month < 1 OR p_billing_month > 12 THEN
    RAISE EXCEPTION 'billing_month must be between 1 and 12';
  END IF;

  IF p_billing_year < 2000 OR p_billing_year > 2200 THEN
    RAISE EXCEPTION 'billing_year is out of supported range';
  END IF;

  v_collection_month := make_date(p_billing_year, p_billing_month, 1);
  v_period_start := (v_collection_month - INTERVAL '1 month')::DATE;
  v_period_end := (v_collection_month - INTERVAL '1 day')::DATE;
  v_due_date := (date_trunc('month', v_period_end + INTERVAL '1 month')::DATE + 18);

  INSERT INTO public.billgo_receivables (
    customer_id,
    worker_id,
    subscription_id,
    type,
    title,
    total_amount,
    due_date,
    period_start,
    period_end,
    collection_month,
    usage_month,
    billing_month,
    billing_year,
    billing_months,
    bonus_months,
    paid_amount,
    monthly_fee_at_collection,
    next_period_start,
    status,
    created_by
  )
  SELECT
    subscription.customer_id,
    subscription.worker_id,
    subscription.id,
    'subscription_fee',
    'Thu cước ' || COALESCE(NULLIF(subscription.package_name, ''), 'Internet'),
    GREATEST(COALESCE(subscription.monthly_fee, subscription.amount_per_cycle, 0), 0),
    v_due_date,
    v_period_start,
    v_period_end,
    v_collection_month,
    v_period_start,
    p_billing_month,
    p_billing_year,
    1,
    0,
    0,
    GREATEST(COALESCE(subscription.monthly_fee, subscription.amount_per_cycle, 0), 0),
    (v_period_end + INTERVAL '1 day')::DATE,
    'unpaid',
    p_created_by
  FROM public.billgo_subscriptions subscription
  WHERE subscription.worker_id = p_worker_id
    AND subscription.status = 'active'
    AND subscription.deleted_at IS NULL
    AND COALESCE(subscription.current_cycle, subscription.cycle, 'monthly') = 'monthly'
    AND date_trunc('month', COALESCE(subscription.start_date, v_period_start))::DATE <= v_period_start
    AND NOT EXISTS (
      SELECT 1
      FROM public.billgo_receivables receivable
      WHERE receivable.subscription_id = subscription.id
        AND receivable.billing_month = p_billing_month
        AND receivable.billing_year = p_billing_year
        AND receivable.deleted_at IS NULL
        AND receivable.status <> 'cancelled'
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMIT;
