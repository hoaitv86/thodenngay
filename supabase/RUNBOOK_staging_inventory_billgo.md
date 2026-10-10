# Staging Kho Hang/BillGo Bootstrap Runbook

Scope: staging project `ehlpxogxhahboeexfcpf` only. Do not connect to production `kckjmycpdnynbeicedsu`.

## Files

- `supabase/bootstrap_staging_inventory_billgo.sql`: main bootstrap entrypoint.
- `supabase/bootstrap_staging_base_thodenngay.sql`: staging-only base schema extracted from the current `schema.sql` without its destructive reset.
- Existing migrations are included with `\ir` in dependency order.

## Safety

- Do not run `supabase/schema.sql` directly. It starts with `DROP TABLE ... CASCADE` and later references feature tables before their migrations create them.
- The bootstrap refuses to run unless psql is called with `-v ALLOW_STAGING_BOOTSTRAP=ehlpxogxhahboeexfcpf`.
- The bootstrap does not seed real customers, workers, jobs, or production data.
- `migration_billgo_dynamic_packages.sql` seeds package catalog rows only.

## Command

Use the staging Session pooler URI without embedding the password. Let `psql -W` prompt for it.

```powershell
$pgBin = "C:\Users\Admin\Desktop\alo-tho-master\alo-tho-master\scratch\postgres-client\17.11\pgsql\bin"
$stagingUri = "postgresql://postgres.ehlpxogxhahboeexfcpf@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
& "$pgBin\psql.exe" $stagingUri -W -X -v ON_ERROR_STOP=1 -v ALLOW_STAGING_BOOTSTRAP=ehlpxogxhahboeexfcpf -f "C:\Users\Admin\Desktop\alo-tho-master\alo-tho-master\supabase\bootstrap_staging_inventory_billgo.sql"
```

## Order Rationale

1. Base schema creates core app tables: `profiles`, `workers`, `worker_units`, `services`, `jobs`, `payments`, and base helpers.
2. BillGo migrations run before inventory sales RPCs because sales can create BillGo subscriptions and receivables.
3. Inventory and receiving run before sales because sales references stock products and receipt serials.
4. Customer device and home warranty migrations run before `migration_job_completion_runs.sql`.
5. `migration_job_completion_runs.sql` runs before `migration_reopen_legacy_job_inventory_restore.sql` because the reopen RPC filters `worker_sales_orders.completion_run_id`.
6. Unit role/access migrations run near the end after all referenced feature tables exist.
7. `migration_worker_sales_profit_and_serials.sql` runs last so its `create_worker_sales_order` definition is final and retains cost, gross profit, serial/QR status, cancellation, and BillGo 1/2/3/6/12 month cycles.

## Post-Run Checks

The bootstrap ends with catalog checks for the core inventory, receiving, sales, BillGo, legacy reopen, and final sales RPC objects. After that, run the rollback-only transaction test separately:

```powershell
& "$pgBin\psql.exe" $stagingUri -W -X -v ON_ERROR_STOP=1 -c "SET app.worker_inventory_test.allow='true';" -f "C:\Users\Admin\Desktop\alo-tho-master\alo-tho-master\supabase\test_worker_inventory_sales_transaction.sql"
```

## Remaining Risks

- This has been statically reviewed only; it has not been executed on staging in this step.
- The staging project must be blank or disposable. Existing staging objects may conflict with non-idempotent policies or constraints even though the bootstrap avoids `DROP ... CASCADE`.
- Some included migrations contain catalog/package seed rows. They are not customer data, but they are writes.
