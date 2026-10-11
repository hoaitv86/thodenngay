# Production Kho hang/BillGo SQL Editor Runbook

Scope: production Supabase project `kckjmycpdnynbeicedsu`.

This runbook assumes the operator has Supabase SQL Editor access but does not
have the PostgreSQL password. Do not use the staging bootstrap on production.

## Files

- Read-only preflight: `supabase/preflight_production_inventory_billgo.sql`
- Migration 1: `supabase/migration_reopen_legacy_job_inventory_restore.sql`
- Migration 2: `supabase/migration_worker_sales_profit_and_serials.sql`

## Final Migration Order

Use this exact order:

1. `migration_reopen_legacy_job_inventory_restore.sql`
2. `migration_worker_sales_profit_and_serials.sql`

Rationale:

- Staging passed with `migration_reopen_legacy_job_inventory_restore.sql` after
  job completion support and before the final sales RPC migration.
- `migration_worker_sales_profit_and_serials.sql` must run last among files that
  define `create_worker_sales_order`, because it is the final version that
  preserves cost/gross profit, serial/QR sales links, cancellation inventory
  restore, and BillGo monthly/two-month/three-month/six-month/yearly cycles.

## GO/NO-GO

NO-GO if any of these are true:

- You do not have an independent backup and restore drill evidence.
- The preflight script fails to complete.
- Any final `GO/NO-GO summary` row has `pass = false`.
- The `function_body_probe` output shows a production RPC body that contains a
  custom hotfix or behavior that must not be overwritten.
- `worker_inventory_products.recurring_cycle` contains values outside
  `monthly`, `two_months`, `three_months`, `six_months`, `yearly`.
- Existing serial status values are outside `in_stock`, `sold`, `canceled`.
- BillGo `internet_account` has duplicates.
- Table sizes/traffic are too high for a normal-hours DDL window.

GO only if:

- Backup and restore drill are complete.
- `preflight_production_inventory_billgo.sql` finishes successfully.
- Every final summary row says `GO`.
- The current RPC bodies shown in `function_body_probe` have been manually
  reviewed. It is expected that production may not yet match the final body
  before migration.
- A short maintenance window is available.
- The owner/operator is ready to restore or revert functions if post-checks fail.

## Backup When Only SQL Editor Is Available

Preferred independent backup:

1. Ask the Supabase project owner to create a dashboard backup or PITR restore
   point immediately before deployment.
2. Ask the owner to restore that backup into a separate project, branch, or
   temporary database.
3. In the restored environment, verify the affected tables exist and row counts
   are plausible.

Minimum SQL Editor evidence to capture before migration:

- Save screenshots or CSV exports of the preflight result sets.
- Export CSVs for affected production tables from Table Editor if available:
  `worker_sales_orders`, `worker_sales_order_items`,
  `worker_inventory_products`, `worker_inventory_receipts`,
  `worker_inventory_receipt_items`, `worker_inventory_receipt_item_serials`,
  `worker_product_warranties`, `jobs`, `job_logs`, `billgo_subscriptions`,
  `billgo_receivables`, `billgo_receipts`.
- Save function definitions from the preflight `function_body_probe` section.

Restore drill is not satisfied by screenshots alone. If the account does not
allow dashboard backup restore or branching, the deployment remains NO-GO until
the project owner performs and verifies a restore in a separate environment.

## Preflight

Open `preflight_production_inventory_billgo.sql` in Supabase SQL Editor and run
it without modifications.

Expected behavior:

- It starts with `BEGIN READ ONLY`.
- It returns catalog, function, data-quality, BillGo, and lock-risk result sets.
- It ends with `COMMIT`.
- It performs no writes.

Copy or screenshot the final `GO/NO-GO summary`.

## Deployment

Run during a maintenance window.

1. Reconfirm backup/restore drill evidence.
2. Run `migration_reopen_legacy_job_inventory_restore.sql`.
3. Run `migration_worker_sales_profit_and_serials.sql`.
4. Run `preflight_production_inventory_billgo.sql` again.
5. Compare BillGo baseline counts before/after. Counts should not change merely
   from these migrations.
6. Confirm the final `GO/NO-GO summary` remains all `GO`.

## Expected Locks and Data Touches

`migration_reopen_legacy_job_inventory_restore.sql`:

- Replaces one function and grants execute.
- Does not touch data during migration.

`migration_worker_sales_profit_and_serials.sql`:

- Adds columns to sales/order/serial tables if missing.
- Adds serial indexes with normal `CREATE INDEX IF NOT EXISTS`, not
  `CONCURRENTLY`; this can briefly lock writes.
- Adds or replaces constraints.
- Backfills `cost_total` and `gross_profit` where item costs already exist.
- Replaces sales/cancel/receipt-cancel RPCs.
- Does not backfill or mutate BillGo subscriptions/receivables directly.

BillGo write risk:

- Existing BillGo rows should not change during migration.
- Future sales through `create_worker_sales_order(..., p_create_billgo=true, ...)`
  can create new `billgo_subscriptions` and `billgo_receivables`.
- The preflight checks existing duplicate `internet_account` groups and cycle
  distribution so anomalies are visible before deployment.

## Rollback Plan

Preferred rollback:

1. Stop writes that use worker inventory/sales/BillGo.
2. Restore the independent dashboard/PITR backup into production, or fail over to
   the verified restored environment, per the project owner's Supabase process.

Function-only fallback, only if no data was written after migration:

- Recreate the previous function bodies captured before deployment.
- This is not a full rollback if new columns, constraints, indexes, or post-
  migration writes exist.

Do not drop newly added columns after users have created sales, serial links, or
BillGo rows using the new RPCs.

## Post-Check

Run `preflight_production_inventory_billgo.sql` again.

Additional manual checks:

- Confirm no BillGo row counts changed solely due to migration.
- Confirm final sales RPC has `search_path=public, extensions`.
- Confirm serial link consistency counters are zero.
- Confirm no invalid recurring cycle or serial status rows.
- Confirm table size/row count results match expectations for lock risk.

## Report Template

- Backup completed:
- Restore drill completed:
- Preflight before migration:
- Migration 1 result:
- Migration 2 result:
- Preflight after migration:
- BillGo counts before:
- BillGo counts after:
- Decision: GO / NO-GO
- Notes:
