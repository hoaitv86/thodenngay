-- BillGo multi-cycle billing periods.
-- Extends existing BillGo fixed customers + monthly periods without deleting history.

BEGIN;

ALTER TABLE public.billgo_receivables
ADD COLUMN IF NOT EXISTS cycle_at_collection TEXT,
ADD COLUMN IF NOT EXISTS service_months INTEGER,
ADD COLUMN IF NOT EXISTS next_due_date DATE;

UPDATE public.billgo_receivables receivable
SET
  cycle_at_collection = COALESCE(
    receivable.cycle_at_collection,
    subscription.current_cycle,
    subscription.cycle,
    CASE
      WHEN COALESCE(receivable.billing_months, 1) = 2 THEN 'two_months'
      WHEN COALESCE(receivable.billing_months, 1) = 3 THEN 'three_months'
      WHEN COALESCE(receivable.billing_months, 1) = 6 THEN 'six_months'
      WHEN COALESCE(receivable.billing_months, 1) = 12 THEN 'yearly'
      ELSE 'monthly'
    END
  ),
  service_months = COALESCE(
    receivable.service_months,
    NULLIF(COALESCE(receivable.billing_months, 0) + COALESCE(receivable.bonus_months, 0), 0),
    1
  )
FROM public.billgo_subscriptions subscription
WHERE receivable.subscription_id = subscription.id
  AND (receivable.cycle_at_collection IS NULL OR receivable.service_months IS NULL);

UPDATE public.billgo_receivables
SET
  cycle_at_collection = COALESCE(
    cycle_at_collection,
    CASE
      WHEN COALESCE(billing_months, 1) = 2 THEN 'two_months'
      WHEN COALESCE(billing_months, 1) = 3 THEN 'three_months'
      WHEN COALESCE(billing_months, 1) = 6 THEN 'six_months'
      WHEN COALESCE(billing_months, 1) = 12 THEN 'yearly'
      ELSE 'monthly'
    END
  ),
  service_months = COALESCE(service_months, NULLIF(COALESCE(billing_months, 0) + COALESCE(bonus_months, 0), 0), 1)
WHERE cycle_at_collection IS NULL
   OR service_months IS NULL;

UPDATE public.billgo_receivables
SET next_due_date = COALESCE(
  next_due_date,
  (
    date_trunc(
      'month',
      (
        COALESCE(next_period_start, (period_end + INTERVAL '1 day')::DATE, period_start, due_date, CURRENT_DATE)
        + make_interval(months => GREATEST(COALESCE(service_months, billing_months + bonus_months, 1), 1))
        - INTERVAL '1 day'
      )
      + INTERVAL '1 month'
    )::DATE
    + 18
  )
)
WHERE next_due_date IS NULL;

ALTER TABLE public.billgo_receivables
DROP CONSTRAINT IF EXISTS billgo_receivables_cycle_at_collection_check;

ALTER TABLE public.billgo_receivables
ADD CONSTRAINT billgo_receivables_cycle_at_collection_check
CHECK (cycle_at_collection IN ('monthly', 'two_months', 'three_months', 'six_months', 'yearly'));

ALTER TABLE public.billgo_receivables
DROP CONSTRAINT IF EXISTS billgo_receivables_service_months_check;

ALTER TABLE public.billgo_receivables
ADD CONSTRAINT billgo_receivables_service_months_check
CHECK (service_months >= 0);

CREATE INDEX IF NOT EXISTS billgo_receivables_due_filter_idx
ON public.billgo_receivables(worker_id, due_date, status)
WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_billgo_due_receivables(
  p_worker_id UUID,
  p_collection_month INTEGER,
  p_collection_year INTEGER,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collection_month DATE;
  v_inserted INTEGER := 0;
BEGIN
  IF p_worker_id IS NULL THEN
    RAISE EXCEPTION 'worker_id is required';
  END IF;

  IF p_collection_month < 1 OR p_collection_month > 12 THEN
    RAISE EXCEPTION 'collection month must be between 1 and 12';
  END IF;

  IF p_collection_year < 2000 OR p_collection_year > 2200 THEN
    RAISE EXCEPTION 'collection year is out of supported range';
  END IF;

  v_collection_month := make_date(p_collection_year, p_collection_month, 1);

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
    cycle_at_collection,
    billing_months,
    bonus_months,
    service_months,
    paid_amount,
    monthly_fee_at_collection,
    next_period_start,
    next_due_date,
    status,
    created_by
  )
  SELECT
    subscription.customer_id,
    subscription.worker_id,
    subscription.id,
    'subscription_fee',
    'Thu cước ' || COALESCE(NULLIF(subscription.package_name, ''), 'Internet'),
    GREATEST(COALESCE(subscription.monthly_fee, subscription.amount_per_cycle, 0), 0) * cycle_config.paid_months,
    cycle_period.due_date,
    cycle_period.period_start,
    cycle_period.period_end,
    v_collection_month,
    cycle_period.period_start,
    p_collection_month,
    p_collection_year,
    cycle_config.cycle,
    cycle_config.paid_months,
    cycle_config.bonus_months,
    cycle_config.paid_months + cycle_config.bonus_months,
    0,
    GREATEST(COALESCE(subscription.monthly_fee, subscription.amount_per_cycle, 0), 0),
    (cycle_period.period_end + INTERVAL '1 day')::DATE,
    next_period.due_date,
    'unpaid',
    p_created_by
  FROM public.billgo_subscriptions subscription
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(subscription.current_cycle, subscription.cycle, 'monthly') AS cycle,
      CASE COALESCE(subscription.current_cycle, subscription.cycle, 'monthly')
        WHEN 'two_months' THEN 2
        WHEN 'three_months' THEN 3
        WHEN 'six_months' THEN 6
        WHEN 'yearly' THEN 12
        ELSE 1
      END AS paid_months,
      CASE COALESCE(subscription.current_cycle, subscription.cycle, 'monthly')
        WHEN 'yearly' THEN 1
        ELSE 0
      END AS bonus_months
  ) cycle_config
  CROSS JOIN LATERAL (
    SELECT
      date_trunc('month', COALESCE(subscription.next_period_start, subscription.start_date, v_collection_month))::DATE AS period_start
  ) period_seed
  CROSS JOIN LATERAL (
    SELECT
      period_seed.period_start,
      (period_seed.period_start + make_interval(months => cycle_config.paid_months + cycle_config.bonus_months) - INTERVAL '1 day')::DATE AS period_end
  ) cycle_period_bounds
  CROSS JOIN LATERAL (
    SELECT
      cycle_period_bounds.period_start,
      cycle_period_bounds.period_end,
      (date_trunc('month', cycle_period_bounds.period_end + INTERVAL '1 month')::DATE + 18) AS due_date,
      date_trunc('month', cycle_period_bounds.period_end + INTERVAL '1 month')::DATE AS collection_month
  ) cycle_period
  CROSS JOIN LATERAL (
    SELECT
      (date_trunc(
        'month',
        (
          (cycle_period.period_end + INTERVAL '1 day')::DATE
          + make_interval(months => cycle_config.paid_months + cycle_config.bonus_months)
          - INTERVAL '1 day'
        )
        + INTERVAL '1 month'
      )::DATE + 18) AS due_date
  ) next_period
  WHERE subscription.worker_id = p_worker_id
    AND subscription.status = 'active'
    AND subscription.deleted_at IS NULL
    AND cycle_period.collection_month = v_collection_month
    AND date_trunc('month', COALESCE(subscription.start_date, cycle_period.period_start))::DATE <= cycle_period.period_start
    AND NOT EXISTS (
      SELECT 1
      FROM public.billgo_receivables receivable
      WHERE receivable.subscription_id = subscription.id
        AND receivable.billing_month = p_collection_month
        AND receivable.billing_year = p_collection_year
        AND receivable.deleted_at IS NULL
        AND receivable.status <> 'cancelled'
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

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
BEGIN
  RETURN public.ensure_billgo_due_receivables(p_worker_id, p_billing_month, p_billing_year, p_created_by);
END;
$$;

COMMIT;
