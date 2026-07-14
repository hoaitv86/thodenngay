-- Rollback for migration_billgo_multi_cycle_periods.sql.

BEGIN;

DROP FUNCTION IF EXISTS public.ensure_billgo_due_receivables(UUID, INTEGER, INTEGER, UUID);
DROP FUNCTION IF EXISTS public.ensure_billgo_monthly_receivables(UUID, INTEGER, INTEGER, UUID);

DROP INDEX IF EXISTS public.billgo_receivables_due_filter_idx;

ALTER TABLE public.billgo_receivables
DROP CONSTRAINT IF EXISTS billgo_receivables_cycle_at_collection_check,
DROP CONSTRAINT IF EXISTS billgo_receivables_service_months_check;

ALTER TABLE public.billgo_receivables
DROP COLUMN IF EXISTS cycle_at_collection,
DROP COLUMN IF EXISTS service_months,
DROP COLUMN IF EXISTS next_due_date;

COMMIT;
