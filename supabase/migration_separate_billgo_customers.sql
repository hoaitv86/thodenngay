-- Separate BillGo customers from ordinary customer management.
-- Safe to run after migration_billgo_subscriptions.sql and safe for existing data.

ALTER TABLE public.billgo_subscriptions
ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.billgo_subscriptions
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS internet_account TEXT,
ADD COLUMN IF NOT EXISTS customer_address TEXT;

ALTER TABLE public.billgo_receivables
ALTER COLUMN customer_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billgo_subscriptions_worker_account_active_idx
ON public.billgo_subscriptions(worker_id, internet_account)
WHERE internet_account IS NOT NULL AND status <> 'cancelled';
