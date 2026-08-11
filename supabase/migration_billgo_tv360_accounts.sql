-- Link optional TV360 services to an Internet BillGo subscription.
-- Safe for existing customers: adds nullable columns and relaxes the old
-- account uniqueness so one Internet account can own multiple TV360 accounts.

ALTER TABLE public.billgo_subscriptions
ADD COLUMN IF NOT EXISTS parent_subscription_id UUID REFERENCES public.billgo_subscriptions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS tv360_account TEXT,
ADD COLUMN IF NOT EXISTS tv360_service_type TEXT;

ALTER TABLE public.billgo_subscriptions
DROP CONSTRAINT IF EXISTS billgo_subscriptions_tv360_service_type_check;

ALTER TABLE public.billgo_subscriptions
ADD CONSTRAINT billgo_subscriptions_tv360_service_type_check
CHECK (
  tv360_service_type IS NULL
  OR tv360_service_type IN ('smart_tv360', 'receiver_tv360')
) NOT VALID;

DROP INDEX IF EXISTS billgo_subscriptions_worker_account_active_idx;
DROP INDEX IF EXISTS billgo_subscriptions_worker_account_active_lower_idx;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.billgo_subscriptions
    WHERE worker_id IS NOT NULL
      AND internet_account IS NOT NULL
      AND deleted_at IS NULL
      AND status NOT IN ('cancelled', 'deleted')
      AND COALESCE(service_type, 'internet') = 'internet'
      AND parent_subscription_id IS NULL
    GROUP BY worker_id, lower(internet_account)
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS billgo_subscriptions_worker_internet_account_active_lower_idx
    ON public.billgo_subscriptions(worker_id, lower(internet_account))
    WHERE worker_id IS NOT NULL
      AND internet_account IS NOT NULL
      AND deleted_at IS NULL
      AND status NOT IN ('cancelled', 'deleted')
      AND COALESCE(service_type, 'internet') = 'internet'
      AND parent_subscription_id IS NULL;
  ELSE
    RAISE NOTICE 'Skip unique Internet account index because duplicate active Internet accounts exist.';
  END IF;
END $;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_account_lookup_idx
ON public.billgo_subscriptions(worker_id, lower(internet_account))
WHERE worker_id IS NOT NULL
  AND internet_account IS NOT NULL
  AND deleted_at IS NULL
  AND status NOT IN ('cancelled', 'deleted');

CREATE INDEX IF NOT EXISTS billgo_subscriptions_parent_subscription_idx
ON public.billgo_subscriptions(parent_subscription_id)
WHERE parent_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_tv360_account_idx
ON public.billgo_subscriptions(worker_id, lower(tv360_account))
WHERE worker_id IS NOT NULL
  AND tv360_account IS NOT NULL
  AND deleted_at IS NULL
  AND status NOT IN ('cancelled', 'deleted');
