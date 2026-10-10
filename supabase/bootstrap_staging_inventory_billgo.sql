\set ON_ERROR_STOP on

-- Staging-only bootstrap for Kho hang/BillGo on a blank Tho Den Ngay database.
-- Run with psql from this repository's supabase directory support:
--   psql "$STAGING_URI" -W -X -v ON_ERROR_STOP=1 -f supabase/bootstrap_staging_inventory_billgo.sql
--
-- Do not run this against production. It has an explicit staging pooler user guard
-- in bootstrap_staging_base_thodenngay.sql and contains no DROP ... CASCADE.

\if :{?ALLOW_STAGING_BOOTSTRAP}
\else
\echo 'Refusing to run: pass -v ALLOW_STAGING_BOOTSTRAP=ehlpxogxhahboeexfcpf'
\quit 3
\endif

SET app.bootstrap_project_ref TO :'ALLOW_STAGING_BOOTSTRAP';

\ir bootstrap_staging_base_thodenngay.sql

-- BillGo foundation and lifecycle.
\ir migration_billgo_full_lifecycle.sql
\ir migration_billgo_payments.sql
\ir migration_billgo_dynamic_packages.sql
\ir migration_billgo_package_all_cycles.sql
\ir migration_billgo_monthly_periods.sql
\ir migration_billgo_multi_cycle_periods.sql
\ir migration_billgo_postpaid_cycles.sql
\ir migration_billgo_pending_cycle_customers.sql
\ir migration_billgo_mobile_period_adjustments.sql
\ir migration_billgo_area_collection.sql
\ir migration_billgo_worker_rls_fix.sql
\ir migration_billgo_receipts.sql
\ir migration_billgo_receipts_worker_insert.sql
\ir migration_billgo_payment_reversal.sql
\ir migration_billgo_offline_idempotency.sql
\ir migration_billgo_list_performance_indexes.sql
\ir migration_billgo_customer_list_loading_perf.sql
\ir migration_billgo_tv360_accounts.sql

-- Inventory, receiving, sales, devices, warranties, and job completion support.
\ir migration_worker_inventory.sql
\ir migration_worker_inventory_suppliers.sql
\ir migration_worker_inventory_receipts.sql
\ir migration_worker_inventory_product_codes.sql
\ir migration_worker_sales.sql
\ir migration_worker_after_sales.sql
\ir migration_worker_sales_job_link.sql
\ir migration_worker_customer_management.sql
\ir migration_worker_customer_devices.sql
\ir migration_worker_home_warranty.sql
\ir migration_worker_complete_job_materials_unit_access.sql
\ir migration_job_completion_runs.sql
\ir migration_reopen_legacy_job_inventory_restore.sql

-- Unit business roles and final access policies.
\ir migration_worker_unit_member_roles.sql
\ir migration_worker_unit_role_access.sql
\ir migration_worker_module_flags.sql

-- Final sales RPC must be last among files that define create_worker_sales_order.
-- It preserves cost_total/gross_profit, serial state transitions, cancellation,
-- and BillGo cycles monthly/two_months/three_months/six_months/yearly.
\ir migration_worker_sales_profit_and_serials.sql

-- Static postcondition probes: read-only catalog checks.
SELECT
  'bootstrap_complete' AS check_name,
  to_regclass('public.worker_inventory_products') IS NOT NULL AS has_inventory_products,
  to_regclass('public.worker_inventory_receipts') IS NOT NULL AS has_inventory_receipts,
  to_regclass('public.worker_sales_orders') IS NOT NULL AS has_sales_orders,
  to_regclass('public.billgo_subscriptions') IS NOT NULL AS has_billgo_subscriptions,
  to_regclass('public.billgo_receipts') IS NOT NULL AS has_billgo_receipts,
  to_regprocedure('public.reopen_legacy_job_with_inventory(uuid,jsonb)') IS NOT NULL AS has_legacy_reopen_rpc,
  to_regprocedure('public.create_worker_sales_order(uuid,text,jsonb,boolean,text,date)') IS NOT NULL AS has_final_sales_rpc;
