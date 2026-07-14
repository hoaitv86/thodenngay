-- Rollback for migration_billgo_monthly_periods.sql.
-- This removes only the added helper/index/columns. It does not delete BillGo customers,
-- payments, or receivable rows.

BEGIN;

DROP FUNCTION IF EXISTS public.ensure_billgo_monthly_receivables(UUID, INTEGER, INTEGER, UUID);

DROP INDEX IF EXISTS public.billgo_receivables_worker_billing_month_year_idx;
DROP INDEX IF EXISTS public.billgo_receivables_subscription_billing_month_year_active_idx;

ALTER TABLE public.billgo_receivables
DROP CONSTRAINT IF EXISTS billgo_receivables_billing_month_check,
DROP CONSTRAINT IF EXISTS billgo_receivables_billing_year_check;

ALTER TABLE public.billgo_receivables
DROP COLUMN IF EXISTS billing_month,
DROP COLUMN IF EXISTS billing_year;

DROP TABLE IF EXISTS public.billgo_monthly_period_migration_audit;

COMMIT;
