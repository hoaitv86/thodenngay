-- BillGo mobile monthly charge adjustments.
-- Stores extra mobile charges on the receivable period, not the subscription.
ALTER TABLE public.billgo_receivables
  ADD COLUMN IF NOT EXISTS mobile_adjustment_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.billgo_receivables
  DROP CONSTRAINT IF EXISTS billgo_receivables_mobile_adjustment_amount_check;

ALTER TABLE public.billgo_receivables
  ADD CONSTRAINT billgo_receivables_mobile_adjustment_amount_check
  CHECK (mobile_adjustment_amount >= 0) NOT VALID;

CREATE INDEX IF NOT EXISTS billgo_receivables_mobile_adjustment_idx
  ON public.billgo_receivables(subscription_id, period_start)
  WHERE mobile_adjustment_amount > 0 AND deleted_at IS NULL;