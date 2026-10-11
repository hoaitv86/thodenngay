# Production Kho hang/BillGo SQL Editor Runbook

Scope: production Supabase project `kckjmycpdnynbeicedsu`.

This runbook assumes the operator has Supabase SQL Editor access but does not
have the PostgreSQL password. Do not use the staging bootstrap on production.

## Files

- Read-only preflight: `supabase/preflight_production_inventory_billgo.sql`
- RPC body export: `supabase/preflight_production_rpc_body_export.sql`
- Migration 1: `supabase/migration_reopen_legacy_job_inventory_restore.sql`
- Migration 2: `supabase/migration_worker_sales_profit_and_serials.sql`
- Read-only post-check: `supabase/postcheck_production_inventory_billgo.sql`

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
- BillGo has duplicate active root Internet subscriptions for the same
  `worker_id` and normalized `internet_account`.
- BillGo has paid revenue overlap for the same active root Internet
  `worker_id`/account/period, or duplicate paid periods within one
  subscription.
- Table sizes/traffic are too high for a normal-hours DDL window.

GO only if:

- Backup and restore drill are complete.
- `preflight_production_inventory_billgo.sql` finishes successfully.
- Every final summary row says `GO`.
- The current RPC bodies shown in `function_body_probe` have been manually
  reviewed against `function_body_for_manual_compare`. It is expected that
  production may not yet match the final body before migration; do not treat a
  mismatch as PASS until the function body has been inspected.
- `preflight_production_rpc_body_export.sql` has been run and the full
  production function bodies, hashes, search paths, and EXECUTE grants have
  been saved for rollback/comparison.
- BillGo duplicate checks ignore TV360 child subscriptions, standalone
  `customer_id IS NULL` BillGo customers, and deleted/cancelled subscriptions
  unless they also create active root Internet or paid-period overlap risk.
- A short maintenance window is available.
- The owner/operator is ready to restore or revert functions if post-checks fail.

## Backup When Only SQL Editor Is Available

Preferred independent backup:

1. Ask the Supabase project owner to open Dashboard > Database > Backups and
   record the production project's actual backup capability for its plan:
   daily backups, PITR add-on, Restore to a New Project, downloadable backup, or
   none available in dashboard.
2. Do not assume PITR or database branching exists. If PITR is not enabled,
   choose the closest available dashboard backup before the maintenance window.
3. Ask the owner to restore the selected backup into a separate Supabase project
   or another isolated Postgres database. This must not overwrite production.
4. In the restored environment, verify the affected tables exist, row counts are
   plausible, and the four RPC definitions can be read.
5. Record the restore target project/database, restore start and finish time,
   source backup timestamp, row-count evidence, and who performed the drill.

Minimum SQL Editor evidence to capture before migration:

- Save screenshots or CSV exports of the preflight result sets.
- Export CSVs for affected production tables from Table Editor if available:
  `worker_sales_orders`, `worker_sales_order_items`,
  `worker_inventory_products`, `worker_inventory_receipts`,
  `worker_inventory_receipt_items`, `worker_inventory_receipt_item_serials`,
  `worker_product_warranties`, `jobs`, `job_logs`, `billgo_subscriptions`,
  `billgo_receivables`, `billgo_receipts`.
- Save function definitions from `preflight_production_rpc_body_export.sql`,
  especially `04_full_function_body_export`.

Restore drill is not satisfied by screenshots alone. If the plan/dashboard does
not allow restoring to a separate environment and no owner with database
credentials can produce an independent logical backup plus restore test, the
deployment remains NO-GO.

## Preflight

Open `preflight_production_inventory_billgo.sql` in Supabase SQL Editor and run
it without modifications.

Expected behavior:

- It starts with `BEGIN READ ONLY`.
- It returns catalog, function, data-quality, BillGo, and lock-risk result sets.
- It includes read-only BillGo duplicate and revenue-overlap result sets:
  `billgo_active_root_internet_duplicate_risk`,
  `billgo_active_root_internet_duplicate_detail`,
  `billgo_revenue_overlap_by_account_period`, and
  `billgo_duplicate_periods_by_subscription`.
- It ends with `COMMIT`.
- It performs no writes.

Copy or screenshot the final `GO/NO-GO summary`.

Then run `preflight_production_rpc_body_export.sql` and export every result set.
Manually compare `04_full_function_body_export` with the two migration files.
The expected shape probes are not full equivalence checks; a body can pass the
probe and still contain a production hotfix that must be preserved.

## Deployment

Run during a maintenance window.

1. Reconfirm backup/restore drill evidence.
2. Reconfirm production RPC bodies were exported and reviewed.
3. Run `migration_reopen_legacy_job_inventory_restore.sql`.
4. Run `migration_worker_sales_profit_and_serials.sql`.
5. Run `postcheck_production_inventory_billgo.sql`.
6. Run `preflight_production_inventory_billgo.sql` again if any post-check
   result is unclear or if you need the broader lock/data quality snapshot.
7. Compare BillGo baseline counts before/after. Counts should not change merely
   from these migrations.
8. Confirm the final `GO/NO-GO summary` remains all `GO`.

Do not run the next step if production RPC bodies could not be captured or if
`function_body_for_manual_compare` reveals a custom production hotfix that would
be overwritten by the migration.

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
2. Restore using the verified backup path for the project's actual plan, or fail
   over to the verified restored environment, per the project owner's Supabase
   process.

Function-only fallback, only if no data was written after migration:

- Recreate the previous function bodies captured before deployment.
- This is not a full rollback if new columns, constraints, indexes, or post-
  migration writes exist.

App rollback:

- If database post-checks are GO but the deployed app fails, roll back Vercel to
  the previous deployment and keep the database migration in place unless a data
  issue is confirmed.
- If database post-checks are NO-GO, stop inventory/sales/BillGo writes first,
  then use the verified database restore path. Function-only rollback is only a
  temporary containment step.

Do not drop newly added columns after users have created sales, serial links, or
BillGo rows using the new RPCs.

## Post-Check

Run `postcheck_production_inventory_billgo.sql` first, then rerun
`preflight_production_inventory_billgo.sql` if needed for the wider report.

Additional manual checks:

- Confirm no BillGo row counts changed solely due to migration.
- Confirm final sales RPC has `search_path=public, extensions`.
- Confirm `function_body_for_manual_compare` now matches the deployed function
  intent from the two migration files.
- Confirm `postcheck_go_no_go_summary` has all `GO`.
- Confirm serial link consistency counters are zero.
- Confirm no invalid recurring cycle or serial status rows.
- Confirm BillGo duplicate/overlap result sets are empty or informational only,
  and that final `GO/NO-GO summary` has all `GO`.
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
