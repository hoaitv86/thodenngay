-- Production RPC body export for Kho hang/BillGo deployment.
-- SELECT-only. Run in Supabase SQL Editor, export all result sets, and compare
-- with:
--   1) supabase/migration_reopen_legacy_job_inventory_restore.sql
--   2) supabase/migration_worker_sales_profit_and_serials.sql
--
-- Missing functions are reported as NOT_INSTALLED instead of aborting the script.

BEGIN READ ONLY;

SELECT
  'context' AS section,
  current_database() AS database_name,
  current_user AS sql_user,
  now() AS checked_at;

WITH target_functions(expected_signature) AS (
  VALUES
    ('public.create_worker_sales_order(uuid,text,jsonb,boolean,text,date)'::text),
    ('public.cancel_worker_sales_order(uuid)'::text),
    ('public.cancel_worker_inventory_receipt(uuid)'::text),
    ('public.reopen_legacy_job_with_inventory(uuid,jsonb)'::text)
),
resolved_functions AS (
  SELECT
    expected_signature,
    to_regprocedure(expected_signature) AS resolved_signature
  FROM target_functions
),
fn AS (
  SELECT
    resolved_functions.expected_signature,
    resolved_functions.resolved_signature,
    p.oid,
    n.nspname AS schema_name,
    p.proname,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS result_type,
    l.lanname AS language_name,
    p.prosecdef AS security_definer,
    p.proconfig,
    p.provolatile,
    p.proparallel,
    p.proowner::regrole AS owner_role,
    pg_get_functiondef(p.oid) AS function_body
  FROM resolved_functions
  LEFT JOIN pg_proc p ON p.oid = resolved_functions.resolved_signature
  LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN pg_language l ON l.oid = p.prolang
)
SELECT
  '01_function_metadata_and_hashes' AS section,
  expected_signature,
  COALESCE(resolved_signature::text, 'NOT_INSTALLED') AS resolved_signature,
  schema_name,
  proname,
  arguments,
  result_type,
  language_name,
  security_definer,
  proconfig,
  provolatile,
  proparallel,
  owner_role::text,
  CASE WHEN function_body IS NULL THEN NULL ELSE md5(function_body) END AS function_body_md5,
  CASE WHEN function_body IS NULL THEN NULL ELSE md5(regexp_replace(function_body, '\s+', ' ', 'g')) END AS normalized_function_body_md5,
  length(function_body) AS function_body_length
FROM fn
ORDER BY expected_signature;

WITH target_functions(expected_signature) AS (
  VALUES
    ('public.create_worker_sales_order(uuid,text,jsonb,boolean,text,date)'::text),
    ('public.cancel_worker_sales_order(uuid)'::text),
    ('public.cancel_worker_inventory_receipt(uuid)'::text),
    ('public.reopen_legacy_job_with_inventory(uuid,jsonb)'::text)
),
resolved_functions AS (
  SELECT
    expected_signature,
    to_regprocedure(expected_signature) AS resolved_signature
  FROM target_functions
),
fn AS (
  SELECT
    resolved_functions.expected_signature,
    resolved_functions.resolved_signature,
    p.proname,
    p.proconfig,
    pg_get_functiondef(p.oid) AS body
  FROM resolved_functions
  LEFT JOIN pg_proc p ON p.oid = resolved_functions.resolved_signature
)
SELECT
  '02_expected_shape_probe_not_full_equivalence' AS section,
  expected_signature,
  COALESCE(resolved_signature::text, 'NOT_INSTALLED') AS resolved_signature,
  COALESCE(proname, split_part(split_part(expected_signature, '(', 1), '.', 2)) AS expected_proname,
  CASE
    WHEN resolved_signature IS NULL THEN ARRAY[FALSE]
    WHEN proname = 'create_worker_sales_order' THEN ARRAY[
      proconfig::text ILIKE '%search_path=public, extensions%',
      body ILIKE '%cost_total%',
      body ILIKE '%gross_profit%',
      body ILIKE '%sales_order_item_id%',
      body ILIKE '%p_billgo_cycle%',
      body ILIKE '%two_months%',
      body ILIKE '%three_months%',
      body ILIKE '%six_months%',
      body ILIKE '%yearly%',
      body ILIKE '%billgo_subscriptions%',
      body ILIKE '%billgo_receivables%',
      body ILIKE '%worker_product_warranties%',
      body ILIKE '%FOR UPDATE SKIP LOCKED%'
    ]
    WHEN proname = 'cancel_worker_sales_order' THEN ARRAY[
      body ILIKE '%status = ''cancelled''%',
      body ILIKE '%status = ''in_stock''%',
      body ILIKE '%sales_order_id = NULL%',
      body ILIKE '%sales_order_item_id = NULL%',
      body ILIKE '%sold_at = NULL%',
      body ILIKE '%worker_product_warranties%'
    ]
    WHEN proname = 'cancel_worker_inventory_receipt' THEN ARRAY[
      body ILIKE '%status = ''canceled''%',
      body ILIKE '%stock_applied_at = NULL%',
      body ILIKE '%status <> ''in_stock''%',
      body ILIKE '%stock_quantity = stock_quantity - v_item.quantity%',
      body ILIKE '%FOR UPDATE%'
    ]
    WHEN proname = 'reopen_legacy_job_with_inventory' THEN ARRAY[
      body ILIKE '%completionRunId%',
      body ILIKE '%completion_run_id IS NULL%',
      body ILIKE '%stock_quantity = stock_quantity + v_item.quantity%',
      body ILIKE '%legacy_job_reopened%',
      body ILIKE '%inventoryRestored%'
    ]
    ELSE ARRAY[FALSE]
  END AS expected_shape_checks,
  CASE
    WHEN resolved_signature IS NULL THEN FALSE
    ELSE NOT (FALSE = ANY (
      CASE proname
        WHEN 'create_worker_sales_order' THEN ARRAY[
          proconfig::text ILIKE '%search_path=public, extensions%',
          body ILIKE '%cost_total%',
          body ILIKE '%gross_profit%',
          body ILIKE '%sales_order_item_id%',
          body ILIKE '%p_billgo_cycle%',
          body ILIKE '%two_months%',
          body ILIKE '%three_months%',
          body ILIKE '%six_months%',
          body ILIKE '%yearly%',
          body ILIKE '%billgo_subscriptions%',
          body ILIKE '%billgo_receivables%',
          body ILIKE '%worker_product_warranties%',
          body ILIKE '%FOR UPDATE SKIP LOCKED%'
        ]
        WHEN 'cancel_worker_sales_order' THEN ARRAY[
          body ILIKE '%status = ''cancelled''%',
          body ILIKE '%status = ''in_stock''%',
          body ILIKE '%sales_order_id = NULL%',
          body ILIKE '%sales_order_item_id = NULL%',
          body ILIKE '%sold_at = NULL%',
          body ILIKE '%worker_product_warranties%'
        ]
        WHEN 'cancel_worker_inventory_receipt' THEN ARRAY[
          body ILIKE '%status = ''canceled''%',
          body ILIKE '%stock_applied_at = NULL%',
          body ILIKE '%status <> ''in_stock''%',
          body ILIKE '%stock_quantity = stock_quantity - v_item.quantity%',
          body ILIKE '%FOR UPDATE%'
        ]
        WHEN 'reopen_legacy_job_with_inventory' THEN ARRAY[
          body ILIKE '%completionRunId%',
          body ILIKE '%completion_run_id IS NULL%',
          body ILIKE '%stock_quantity = stock_quantity + v_item.quantity%',
          body ILIKE '%legacy_job_reopened%',
          body ILIKE '%inventoryRestored%'
        ]
        ELSE ARRAY[FALSE]
      END
    ))
  END AS body_matches_expected_shape_only
FROM fn
ORDER BY expected_signature;

WITH target_functions(expected_signature) AS (
  VALUES
    ('public.create_worker_sales_order(uuid,text,jsonb,boolean,text,date)'::text),
    ('public.cancel_worker_sales_order(uuid)'::text),
    ('public.cancel_worker_inventory_receipt(uuid)'::text),
    ('public.reopen_legacy_job_with_inventory(uuid,jsonb)'::text)
),
resolved_functions AS (
  SELECT
    expected_signature,
    to_regprocedure(expected_signature) AS resolved_signature
  FROM target_functions
),
fn AS (
  SELECT
    resolved_functions.expected_signature,
    resolved_functions.resolved_signature,
    p.oid,
    p.proowner,
    p.proacl
  FROM resolved_functions
  LEFT JOIN pg_proc p ON p.oid = resolved_functions.resolved_signature
),
acl AS (
  SELECT
    fn.expected_signature,
    fn.resolved_signature,
    exploded.grantee,
    exploded.privilege_type,
    exploded.is_grantable
  FROM fn
  CROSS JOIN LATERAL aclexplode(COALESCE(fn.proacl, acldefault('f', fn.proowner))) exploded
  WHERE fn.resolved_signature IS NOT NULL
)
SELECT
  '03_execute_privileges' AS section,
  resolved_functions.expected_signature,
  COALESCE(resolved_functions.resolved_signature::text, 'NOT_INSTALLED') AS resolved_signature,
  COALESCE(pg_roles.rolname, 'PUBLIC') AS grantee,
  acl.privilege_type,
  acl.is_grantable
FROM resolved_functions
LEFT JOIN acl
  ON acl.expected_signature = resolved_functions.expected_signature
LEFT JOIN pg_roles
  ON pg_roles.oid = acl.grantee
WHERE acl.privilege_type = 'EXECUTE'
   OR resolved_functions.resolved_signature IS NULL
ORDER BY resolved_functions.expected_signature, grantee;

WITH target_functions(expected_signature) AS (
  VALUES
    ('public.create_worker_sales_order(uuid,text,jsonb,boolean,text,date)'::text),
    ('public.cancel_worker_sales_order(uuid)'::text),
    ('public.cancel_worker_inventory_receipt(uuid)'::text),
    ('public.reopen_legacy_job_with_inventory(uuid,jsonb)'::text)
),
resolved_functions AS (
  SELECT
    expected_signature,
    to_regprocedure(expected_signature) AS resolved_signature
  FROM target_functions
),
fn AS (
  SELECT
    resolved_functions.expected_signature,
    resolved_functions.resolved_signature,
    pg_get_functiondef(p.oid) AS body
  FROM resolved_functions
  LEFT JOIN pg_proc p ON p.oid = resolved_functions.resolved_signature
)
SELECT
  '04_full_function_body_export' AS section,
  expected_signature,
  COALESCE(resolved_signature::text, 'NOT_INSTALLED') AS resolved_signature,
  body
FROM fn
ORDER BY expected_signature;

COMMIT;
