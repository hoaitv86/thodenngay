ALTER TABLE public.billgo_subscriptions
DROP CONSTRAINT IF EXISTS billgo_subscriptions_cycle_check;

ALTER TABLE public.billgo_subscriptions
ADD CONSTRAINT billgo_subscriptions_cycle_check
CHECK (cycle IS NULL OR cycle IN ('monthly', 'two_months', 'three_months', 'six_months', 'yearly')) NOT VALID;

ALTER TABLE public.billgo_subscriptions
DROP CONSTRAINT IF EXISTS billgo_subscriptions_status_check;

ALTER TABLE public.billgo_subscriptions
ADD CONSTRAINT billgo_subscriptions_status_check
CHECK (status IN ('pending_cycle', 'active', 'paused', 'cancelled', 'deleted')) NOT VALID;

ALTER TABLE public.billgo_subscriptions
ALTER COLUMN cycle DROP NOT NULL,
ALTER COLUMN current_cycle DROP NOT NULL,
ALTER COLUMN start_date DROP NOT NULL,
ALTER COLUMN next_due_date DROP NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_pending_cycle_idx
ON public.billgo_subscriptions(worker_id, status)
WHERE deleted_at IS NULL AND status = 'pending_cycle';
