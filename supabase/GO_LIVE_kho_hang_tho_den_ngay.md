# Kho hang Tho Den Ngay Go-Live Checklist

Scope: finish bringing Kho hang/BillGo online for production project
`kckjmycpdnynbeicedsu`.

Do not run staging bootstrap, production migrations, or production writes from
Codex. The operator runs the SQL Editor steps manually.

## Current Status

| Area | Status | Evidence |
| --- | --- | --- |
| Staging | PASS | Existing staging run passed; do not repeat unless migration files change. |
| Production preflight | GO | Operator reported production preflight GO. |
| Production RPC export | REVIEWED | `supabase/production_rpc_body_export.csv` contains 3 installed RPCs and `reopen_legacy_job_with_inventory = NOT_INSTALLED`. |
| RPC hotfix preservation | PASS | Production warranty cancel behavior is preserved in the final migration. |
| Code readiness | READY after backup/restore | No production migration has been run. |

## RPC Comparison Summary

Production export was compared against:

1. `supabase/migration_reopen_legacy_job_inventory_restore.sql`
2. `supabase/migration_worker_sales_profit_and_serials.sql`

| Topic | Production RPC | Final migration | Decision |
| --- | --- | --- | --- |
| Installed functions | `create_worker_sales_order`, `cancel_worker_sales_order`, and `cancel_worker_inventory_receipt` installed. `reopen_legacy_job_with_inventory` is `NOT_INSTALLED`. | Adds/replaces all 4 final RPCs. | Expected. `reopen_legacy_job_with_inventory` is a new production install. |
| Permissions | CSV section reviewed contains body export only, not ACL rows. Production body uses `SECURITY DEFINER`. | Migrations explicitly `REVOKE ALL FROM PUBLIC` and `GRANT EXECUTE TO authenticated`. | GO if SQL Editor post-run confirms authenticated execute grants. |
| `search_path` | Production sales RPC uses `public`; cancel RPCs use `public`. | Sales RPC uses `public, extensions`; cancel RPCs use `public`; reopen uses `public`. | GO. Sales needs `extensions` for `uuid_generate_v4`. |
| Inventory stock | Production validates stock and decrements/restores stock. | Preserves validation/decrement/restore; adds safer serial-aware paths. | GO. No production stock logic lost. |
| Serial/QR sale | Production marks serials only when available serial count is greater than zero; can skip blocking if serial rows exist but none are available. | Uses total serial count plus available count, and requires enough available serials whenever product has serial rows. | GO. Migration is stricter and safer; no hotfix lost. |
| Receipt cancel serial/QR | Production receipt cancel does not block or mark serial rows. | Blocks cancel if receipt serials are no longer `in_stock`; marks remaining receipt serials `canceled`. | GO. Intended safety improvement. |
| Warranty creation | Production creates `worker_product_warranties` for products with warranty months. | Preserves same creation path. | GO. |
| Warranty cancellation | Production cancels warranties where `status <> 'cancelled'`. | Migration was updated to preserve `status <> 'cancelled'`. | GO. Production hotfix preserved. |
| Cost and gross profit | Production already has `unit_cost`, `cost_total`, `gross_profit` logic. | Preserves and backfills final cost/gross-profit fields. | GO. |
| BillGo cycles | Production supports `monthly`, `three_months`, `six_months`, `yearly`. | Adds `two_months`, `current_cycle`, period metadata, bonus months, next period pointers, and yearly 12+1 behavior. | GO. Intended upgrade. |
| BillGo receivables | Production writes basic `billing_months`. | Writes `cycle_at_collection`, `billing_months`, `bonus_months`, `service_months`, `monthly_fee_at_collection`, `next_period_start`, and `next_due_date`. | GO. Matches current app expectations. |
| Production hotfix risk | One hotfix found: warranty cancel predicate. | Preserved in migration. | GO. No remaining production-only behavior identified that would be lost by replace. |

## Backup And Restore Checklist

This is the only required blocker if code and preflight are already GO.

Mark each item before running production migrations:

- [ ] Owner confirms the actual Supabase backup capability for production:
  daily backup, PITR, restore-to-new-project, downloadable backup, or none.
- [ ] A backup point suitable for the maintenance window is selected and
  recorded.
- [ ] Restore drill is completed into a separate project/database, not
  production.
- [ ] Restored environment row counts are plausible for affected tables:
  `worker_sales_orders`, `worker_sales_order_items`,
  `worker_inventory_products`, `worker_inventory_receipts`,
  `worker_inventory_receipt_items`,
  `worker_inventory_receipt_item_serials`, `worker_product_warranties`,
  `jobs`, `job_logs`, `billgo_subscriptions`, `billgo_receivables`,
  `billgo_receipts`.
- [ ] Restored environment can read the 4 expected RPC definitions after
  restore, with `reopen_legacy_job_with_inventory` allowed to be absent before
  migration.
- [ ] Restore target, source backup timestamp, restore start/end time, row-count
  evidence, and operator name are recorded.
- [ ] Owner is ready to restore or revert functions if post-checks fail.

If this checklist is incomplete, production deployment is NO-GO even when code
is ready.

## Production SQL Editor Order

Run only after backup/restore is complete and during a maintenance window.

1. Open production Supabase project `kckjmycpdnynbeicedsu`.
2. Reconfirm the saved production preflight result is GO.
3. Reconfirm `supabase/production_rpc_body_export.csv` or equivalent RPC export
   is saved outside the SQL Editor session.
4. Run exactly this file first:
   `supabase/migration_reopen_legacy_job_inventory_restore.sql`
5. Run exactly this file second:
   `supabase/migration_worker_sales_profit_and_serials.sql`
6. Run exactly this file for read-only post-check:
   `supabase/postcheck_production_inventory_billgo.sql`
7. If post-check is unclear, rerun:
   `supabase/preflight_production_inventory_billgo.sql`

Do not run `supabase/bootstrap_staging_inventory_billgo.sql` or
`supabase/schema.sql` on production.

## Post-Check PASS Criteria

Production is GO only if all are true:

- `postcheck_go_no_go_summary` has only `GO` decisions.
- `function_postcheck` reports all expected function shapes as true.
- `create_worker_sales_order` has `search_path=public, extensions`.
- `reopen_legacy_job_with_inventory(uuid,jsonb)` exists after migration.
- Serial link consistency counters are all zero.
- Invalid serial status result set is empty.
- Invalid recurring cycle result set is empty.
- BillGo active root Internet duplicate and paid-overlap blockers remain empty
  or informational according to the already approved production preflight.
- BillGo baseline counts did not change merely from the migration.

## GitHub And Vercel Deployment Plan

1. Commit database/runbook changes locally.
2. Push the final branch only after the owner confirms production DB migration
   is GO or after choosing to deploy app code with the DB migration window.
3. Open/merge PR to the deployment branch used by Vercel.
4. Let Vercel build from GitHub.
5. Verify the production deployment URL loads.
6. Smoke-test only existing online flows:
   inventory list, create sale with non-BillGo item, create sale with BillGo item
   in the approved maintenance window, cancel sale, receipt cancel guard, and
   reopen legacy job if applicable.
7. If app deploy fails while database post-check is GO, roll back Vercel to the
   previous deployment and keep database state unchanged unless a data issue is
   confirmed.

## Final GO/NO-GO

CODE READY when:

- This repository contains the final migration files.
- Staging has passed after any migration change.
- Production RPC comparison has no unpreserved hotfix.

PRODUCTION GO only when:

- CODE READY is true.
- Backup/restore checklist is complete.
- Maintenance window is active.
- Owner is available for restore/revert decisions.

NO-GO if backup/restore drill is missing, any SQL Editor post-check fails, or
the owner cannot restore/revert during the window.
