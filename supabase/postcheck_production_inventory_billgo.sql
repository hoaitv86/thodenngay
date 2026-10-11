-- Production read-only post-check for Kho hang/BillGo deployment.
-- Run after:
--   1) migration_reopen_legacy_job_inventory_restore.sql
--   2) migration_worker_sales_profit_and_serials.sql
-- Compare billgo_baseline_counts with the preflight result captured before the migration.

BEGIN READ ONLY;

SELECT
  'context' AS section,
  current_database() AS database_name,
  current_user AS sql_user,
  now() AS checked_at;

SELECT
  'migration_order_reminder' AS section,
  1 AS step_number,
  'migration_reopen_legacy_job_inventory_restore.sql' AS migration_file,
  'Must be completed before sales profit/serial migration.' AS expectation
UNION ALL
SELECT
  'migration_order_reminder',
  2,
  'migration_worker_sales_profit_and_serials.sql',
  'Must run last because it owns final create/cancel sales RPC definitions.'
ORDER BY step_number;

SELECT
  'billgo_baseline_counts' AS section,
  (SELECT COUNT(*) FROM public.billgo_subscriptions) AS subscriptions,
  (SELECT COUNT(*) FROM public.billgo_receivables) AS receivables,
  (SELECT COUNT(*) FROM public.billgo_receipts) AS receipts,
  (SELECT COUNT(*) FROM public.billgo_subscriptions WHERE internet_account LIKE 'SALE-%') AS sale_generated_subscriptions,
  (SELECT COUNT(*) FROM public.billgo_receivables WHERE note LIKE 'Tao tu don ban %') AS sale_generated_receivables;

WITH target_functions(signature) AS (
  VALUES
    ('public.create_worker_sales_order(uuid,text,jsonb,boolean,text,date)'::regprocedure),
    ('public.cancel_worker_sales_order(uuid)'::regprocedure),
    ('public.cancel_worker_inventory_receipt(uuid)'::regprocedure),
    ('public.reopen_legacy_job_with_inventory(uuid,jsonb)'::regprocedure)
),
fn AS (
  SELECT
    target_functions.signature,
    p.proname,
    p.proconfig,
    pg_get_functiondef(p.oid) AS body
  FROM target_functions
  JOIN pg_proc p ON p.oid = target_functions.signature
)
SELECT
  'function_postcheck' AS section,
  signature::text,
  proname,
  proconfig,
  md5(body) AS function_body_md5,
  CASE proname
    WHEN 'create_worker_sales_order' THEN NOT (FALSE = ANY (ARRAY[
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
      body ILIKE '%billgo_receivables%'
    ]))
    WHEN 'cancel_worker_sales_order' THEN NOT (FALSE = ANY (ARRAY[
      body ILIKE '%status = ''cancelled''%',
      body ILIKE '%status = ''in_stock''%',
      body ILIKE '%sales_order_id = NULL%',
      body ILIKE '%sales_order_item_id = NULL%',
      body ILIKE '%sold_at = NULL%'
    ]))
    WHEN 'cancel_worker_inventory_receipt' THEN NOT (FALSE = ANY (ARRAY[
      body ILIKE '%status = ''canceled''%',
      body ILIKE '%stock_applied_at = NULL%',
      body ILIKE '%status <> ''in_stock''%',
      body ILIKE '%stock_quantity = stock_quantity - v_item.quantity%'
    ]))
    WHEN 'reopen_legacy_job_with_inventory' THEN NOT (FALSE = ANY (ARRAY[
      body ILIKE '%completionRunId%',
      body ILIKE '%completion_run_id IS NULL%',
      body ILIKE '%stock_quantity = stock_quantity + v_item.quantity%',
      body ILIKE '%legacy_job_reopened%',
      body ILIKE '%inventoryRestored%'
    ]))
    ELSE FALSE
  END AS matches_expected_shape
FROM fn
ORDER BY signature::text;

SELECT
  'serial_link_consistency' AS section,
  COUNT(*) FILTER (WHERE to_jsonb(serials)->>'sales_order_item_id' IS NOT NULL AND to_jsonb(serials)->>'sales_order_id' IS NULL) AS item_link_without_order_link,
  COUNT(*) FILTER (WHERE to_jsonb(serials)->>'sold_at' IS NOT NULL AND COALESCE(to_jsonb(serials)->>'status', 'in_stock') <> 'sold') AS sold_at_without_sold_status,
  COUNT(*) FILTER (WHERE to_jsonb(serials)->>'status' = 'sold' AND to_jsonb(serials)->>'sales_order_item_id' IS NULL) AS sold_status_without_item_link,
  COUNT(*) FILTER (
    WHERE COALESCE(to_jsonb(serials)->>'status', 'in_stock') = 'in_stock'
      AND (
        to_jsonb(serials)->>'sales_order_id' IS NOT NULL
        OR to_jsonb(serials)->>'sales_order_item_id' IS NOT NULL
        OR to_jsonb(serials)->>'sold_at' IS NOT NULL
      )
  ) AS in_stock_with_sale_link
FROM public.worker_inventory_receipt_item_serials serials;

SELECT
  'invalid_recurring_cycle_values' AS section,
  recurring_cycle,
  COUNT(*) AS row_count
FROM public.worker_inventory_products
WHERE recurring_cycle IS NOT NULL
  AND recurring_cycle NOT IN ('monthly', 'two_months', 'three_months', 'six_months', 'yearly')
GROUP BY recurring_cycle
ORDER BY row_count DESC, recurring_cycle;

WITH status_column AS (
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'worker_inventory_receipt_item_serials'
      AND column_name = 'status'
  ) AS exists_status
)
SELECT
  'invalid_serial_status_values' AS section,
  to_jsonb(serials)->>'status' AS status,
  COUNT(*) AS row_count
FROM status_column
JOIN public.worker_inventory_receipt_item_serials serials
  ON status_column.exists_status
WHERE to_jsonb(serials)->>'status' NOT IN ('in_stock', 'sold', 'canceled')
GROUP BY to_jsonb(serials)->>'status'
ORDER BY row_count DESC, status;

WITH active_root_internet_duplicates AS (
  SELECT
    subscription.worker_id,
    lower(trim(subscription.internet_account)) AS account_key
  FROM public.billgo_subscriptions subscription
  WHERE subscription.worker_id IS NOT NULL
    AND subscription.internet_account IS NOT NULL
    AND trim(subscription.internet_account) <> ''
    AND to_jsonb(subscription)->>'deleted_at' IS NULL
    AND subscription.status NOT IN ('cancelled', 'deleted')
    AND to_jsonb(subscription)->>'parent_subscription_id' IS NULL
    AND COALESCE(subscription.service_type, 'internet') = 'internet'
  GROUP BY subscription.worker_id, lower(trim(subscription.internet_account))
  HAVING COUNT(*) > 1
),
paid_overlaps AS (
  SELECT
    subscription.worker_id,
    lower(trim(subscription.internet_account)) AS account_key,
    COALESCE(
      receivable.period_start,
      make_date(COALESCE(receivable.billing_year, 2000), COALESCE(receivable.billing_month, 1), 1),
      receivable.collection_month
    ) AS period_key,
    COUNT(DISTINCT subscription.id) AS subscription_count,
    SUM(COALESCE(receivable.paid_amount, 0)) AS paid_amount
  FROM public.billgo_subscriptions subscription
  JOIN public.billgo_receivables receivable
    ON receivable.subscription_id = subscription.id
  WHERE subscription.worker_id IS NOT NULL
    AND subscription.internet_account IS NOT NULL
    AND trim(subscription.internet_account) <> ''
    AND to_jsonb(subscription)->>'deleted_at' IS NULL
    AND subscription.status NOT IN ('cancelled', 'deleted')
    AND to_jsonb(subscription)->>'parent_subscription_id' IS NULL
    AND COALESCE(subscription.service_type, 'internet') = 'internet'
    AND to_jsonb(receivable)->>'deleted_at' IS NULL
    AND receivable.status NOT IN ('cancelled', 'deleted')
  GROUP BY subscription.worker_id, lower(trim(subscription.internet_account)), COALESCE(receivable.period_start, make_date(COALESCE(receivable.billing_year, 2000), COALESCE(receivable.billing_month, 1), 1), receivable.collection_month)
  HAVING COUNT(DISTINCT subscription.id) > 1
     AND SUM(COALESCE(receivable.paid_amount, 0)) > 0
),
duplicate_paid_periods AS (
  SELECT
    receivable.subscription_id,
    COALESCE(
      receivable.period_start,
      make_date(COALESCE(receivable.billing_year, 2000), COALESCE(receivable.billing_month, 1), 1),
      receivable.collection_month
    ) AS period_key
  FROM public.billgo_receivables receivable
  WHERE receivable.subscription_id IS NOT NULL
    AND to_jsonb(receivable)->>'deleted_at' IS NULL
    AND receivable.status NOT IN ('cancelled', 'deleted')
  GROUP BY receivable.subscription_id, COALESCE(receivable.period_start, make_date(COALESCE(receivable.billing_year, 2000), COALESCE(receivable.billing_month, 1), 1), receivable.collection_month)
  HAVING COUNT(*) > 1
     AND SUM(COALESCE(receivable.paid_amount, 0)) > 0
)
SELECT
  'postcheck_go_no_go_summary' AS section,
  check_name,
  pass,
  CASE WHEN pass THEN 'GO' ELSE 'NO-GO' END AS decision
FROM (
  SELECT
    'RPC bodies match expected deployed shape' AS check_name,
    NOT EXISTS (
      SELECT 1
      FROM (
        WITH target_functions(signature) AS (
          VALUES
            ('public.create_worker_sales_order(uuid,text,jsonb,boolean,text,date)'::regprocedure),
            ('public.cancel_worker_sales_order(uuid)'::regprocedure),
            ('public.cancel_worker_inventory_receipt(uuid)'::regprocedure),
            ('public.reopen_legacy_job_with_inventory(uuid,jsonb)'::regprocedure)
        ),
        fn AS (
          SELECT target_functions.signature, p.proname, p.proconfig, pg_get_functiondef(p.oid) AS body
          FROM target_functions
          JOIN pg_proc p ON p.oid = target_functions.signature
        )
        SELECT proname,
          CASE proname
            WHEN 'create_worker_sales_order' THEN NOT (FALSE = ANY (ARRAY[proconfig::text ILIKE '%search_path=public, extensions%', body ILIKE '%gross_profit%', body ILIKE '%sales_order_item_id%', body ILIKE '%yearly%']))
            WHEN 'cancel_worker_sales_order' THEN NOT (FALSE = ANY (ARRAY[body ILIKE '%status = ''cancelled''%', body ILIKE '%status = ''in_stock''%', body ILIKE '%sold_at = NULL%']))
            WHEN 'cancel_worker_inventory_receipt' THEN NOT (FALSE = ANY (ARRAY[body ILIKE '%status = ''canceled''%', body ILIKE '%stock_applied_at = NULL%', body ILIKE '%stock_quantity = stock_quantity - v_item.quantity%']))
            WHEN 'reopen_legacy_job_with_inventory' THEN NOT (FALSE = ANY (ARRAY[body ILIKE '%completionRunId%', body ILIKE '%legacy_job_reopened%', body ILIKE '%inventoryRestored%']))
            ELSE FALSE
          END AS pass
        FROM fn
      ) body_checks
      WHERE pass IS NOT TRUE
    ) AS pass
  UNION ALL
  SELECT 'No serial link inconsistencies', NOT EXISTS (
    SELECT 1
    FROM public.worker_inventory_receipt_item_serials serials
    WHERE (to_jsonb(serials)->>'sales_order_item_id' IS NOT NULL AND to_jsonb(serials)->>'sales_order_id' IS NULL)
       OR (to_jsonb(serials)->>'sold_at' IS NOT NULL AND COALESCE(to_jsonb(serials)->>'status', 'in_stock') <> 'sold')
       OR (to_jsonb(serials)->>'status' = 'sold' AND to_jsonb(serials)->>'sales_order_item_id' IS NULL)
       OR (
        COALESCE(to_jsonb(serials)->>'status', 'in_stock') = 'in_stock'
        AND (
          to_jsonb(serials)->>'sales_order_id' IS NOT NULL
          OR to_jsonb(serials)->>'sales_order_item_id' IS NOT NULL
          OR to_jsonb(serials)->>'sold_at' IS NOT NULL
        )
      )
  )
  UNION ALL
  SELECT 'No active root Internet duplicate accounts per worker', NOT EXISTS (SELECT 1 FROM active_root_internet_duplicates)
  UNION ALL
  SELECT 'No paid BillGo overlap across root account periods', NOT EXISTS (SELECT 1 FROM paid_overlaps)
  UNION ALL
  SELECT 'No duplicate paid BillGo periods within one subscription', NOT EXISTS (SELECT 1 FROM duplicate_paid_periods)
) summary
ORDER BY pass, check_name;

COMMIT;
