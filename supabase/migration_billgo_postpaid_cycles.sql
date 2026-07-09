-- BillGo postpaid billing cycle.
-- Safe to run on existing data. It keeps old rows and derives missing period/due-date fields.

ALTER TABLE public.billgo_receivables
DROP CONSTRAINT IF EXISTS billgo_receivables_status_check;

ALTER TABLE public.billgo_receivables
ADD CONSTRAINT billgo_receivables_status_check
CHECK (status IN ('not_due', 'due', 'unpaid', 'partial', 'paid', 'overdue', 'cancelled'));

UPDATE public.billgo_receivables
SET
  period_start = COALESCE(period_start, due_date, created_at::date, CURRENT_DATE),
  period_end = COALESCE(
    period_end,
    (
      COALESCE(period_start, due_date, created_at::date, CURRENT_DATE)
      + make_interval(months => GREATEST(COALESCE(NULLIF(billing_months, 0), 1) + COALESCE(bonus_months, 0), 1))
      - interval '1 day'
    )::date
  )
WHERE status <> 'cancelled'
  AND (period_start IS NULL OR period_end IS NULL);

UPDATE public.billgo_receivables
SET due_date = (date_trunc('month', period_end + interval '1 month')::date + 19)
WHERE status <> 'cancelled'
  AND period_end IS NOT NULL
  AND (
    due_date IS NULL
    OR type = 'subscription_fee'
  );

WITH paid_totals AS (
  SELECT
    receivable_id,
    SUM(amount) AS paid_amount
  FROM public.payments
  WHERE status = 'paid'
    AND receivable_id IS NOT NULL
  GROUP BY receivable_id
)
UPDATE public.billgo_receivables receivable
SET status = CASE
  WHEN COALESCE(paid_totals.paid_amount, 0) >= COALESCE(receivable.total_amount, 0) THEN 'paid'
  WHEN receivable.due_date < CURRENT_DATE THEN 'overdue'
  WHEN receivable.due_date = CURRENT_DATE THEN 'due'
  ELSE 'not_due'
END
FROM paid_totals
WHERE receivable.id = paid_totals.receivable_id
  AND receivable.status <> 'cancelled';

UPDATE public.billgo_receivables
SET status = CASE
  WHEN due_date < CURRENT_DATE THEN 'overdue'
  WHEN due_date = CURRENT_DATE THEN 'due'
  ELSE 'not_due'
END
WHERE status <> 'cancelled'
  AND status <> 'paid'
  AND NOT EXISTS (
    SELECT 1
    FROM public.payments
    WHERE payments.receivable_id = billgo_receivables.id
      AND payments.status = 'paid'
  );

UPDATE public.billgo_subscriptions subscription
SET next_due_date = receivable.next_due_date
FROM (
  SELECT DISTINCT ON (subscription_id)
    subscription_id,
    due_date AS next_due_date
  FROM public.billgo_receivables
  WHERE subscription_id IS NOT NULL
    AND status <> 'cancelled'
  ORDER BY subscription_id, due_date ASC
) receivable
WHERE subscription.id = receivable.subscription_id
  AND subscription.status <> 'cancelled';

CREATE INDEX IF NOT EXISTS billgo_receivables_period_idx
ON public.billgo_receivables(period_start, period_end);
