-- Production read-only preflight for Kho hang/BillGo migrations.
-- Compatible with Supabase SQL Editor. This script intentionally contains
-- only transaction control and SELECT statements; it does not modify data.
--
-- Scope:
--   1) supabase/migration_reopen_legacy_job_inventory_restore.sql
--   2) supabase/migration_worker_sales_profit_and_serials.sql
--
-- Expected deployment order:
--   1) migration_reopen_legacy_job_inventory_restore.sql
--   2) migration_worker_sales_profit_and_serials.sql
--
-- GO only if every row in the final "GO/NO-GO summary" result has pass = true.

BEGIN READ ONLY;

SELECT
  'preflight_context' AS section,
  current_database() AS database_name,
  current_user AS sql_user,
  now() AS checked_at;

WITH required_tables(table_name) AS (
  VALUES
    ('profiles'),
    ('workers'),
    ('worker_units'),
    ('worker_unit_members'),
    ('jobs'),
    ('job_logs'),
    ('worker_inventory_products'),
    ('worker_inventory_receipts'),
    ('worker_inventory_receipt_items'),
    ('worker_inventory_receipt_item_serials'),
    ('worker_sales_orders'),
    ('worker_sales_order_items'),
    ('worker_product_warranties'),
    ('billgo_subscriptions'),
    ('billgo_receivables'),
    ('billgo_receipts')
)
SELECT
  'required_tables' AS section,
  table_name,
  to_regclass('public.' || table_name) IS NOT NULL AS present
FROM required_tables
ORDER BY table_name;

WITH required_columns(table_name, column_name, expected_type) AS (
  VALUES
    ('jobs', 'id', 'uuid'),
    ('jobs', 'worker_id', 'uuid'),
    ('jobs', 'status', 'text'),
    ('jobs', 'workflow_data', 'jsonb'),
    ('jobs', 'updated_at', 'timestamp with time zone'),
    ('job_logs', 'job_id', 'uuid'),
    ('job_logs', 'actor_id', 'uuid'),
    ('job_logs', 'action', 'text'),
    ('job_logs', 'metadata', 'jsonb'),
    ('worker_inventory_products', 'id', 'uuid'),
    ('worker_inventory_products', 'worker_id', 'uuid'),
    ('worker_inventory_products', 'purchase_price', 'numeric'),
    ('worker_inventory_products', 'stock_quantity', 'integer'),
    ('worker_inventory_products', 'is_recurring_billgo', 'boolean'),
    ('worker_inventory_products', 'recurring_cycle', 'text'),
    ('worker_inventory_receipts', 'id', 'uuid'),
    ('worker_inventory_receipts', 'worker_id', 'uuid'),
    ('worker_inventory_receipts', 'status', 'text'),
    ('worker_inventory_receipts', 'stock_applied_at', 'timestamp with time zone'),
    ('worker_inventory_receipt_items', 'receipt_id', 'uuid'),
    ('worker_inventory_receipt_items', 'product_id', 'uuid'),
    ('worker_inventory_receipt_items', 'quantity', 'integer'),
    ('worker_inventory_receipt_item_serials', 'id', 'uuid'),
    ('worker_inventory_receipt_item_serials', 'receipt_item_id', 'uuid'),
    ('worker_inventory_receipt_item_serials', 'product_id', 'uuid'),
    ('worker_inventory_receipt_item_serials', 'serial_code', 'text'),
    ('worker_inventory_receipt_item_serials', 'qr_code', 'text'),
    ('worker_sales_orders', 'id', 'uuid'),
    ('worker_sales_orders', 'worker_id', 'uuid'),
    ('worker_sales_orders', 'customer_id', 'uuid'),
    ('worker_sales_orders', 'status', 'text'),
    ('worker_sales_orders', 'total_amount', 'numeric'),
    ('worker_sales_orders', 'job_id', 'uuid'),
    ('worker_sales_orders', 'completion_run_id', 'uuid'),
    ('worker_sales_order_items', 'order_id', 'uuid'),
    ('worker_sales_order_items', 'product_id', 'uuid'),
    ('worker_sales_order_items', 'quantity', 'integer'),
    ('worker_sales_order_items', 'unit_price', 'numeric'),
    ('worker_sales_order_items', 'line_total', 'numeric'),
    ('billgo_subscriptions', 'id', 'uuid'),
    ('billgo_subscriptions', 'internet_account', 'text'),
    ('billgo_subscriptions', 'cycle', 'text'),
    ('billgo_subscriptions', 'current_cycle', 'text'),
    ('billgo_receivables', 'id', 'uuid'),
    ('billgo_receivables', 'subscription_id', 'uuid'),
    ('billgo_receivables', 'cycle_at_collection', 'text'),
    ('billgo_receivables', 'billing_months', 'integer'),
    ('billgo_receivables', 'bonus_months', 'integer'),
    ('billgo_receivables', 'service_months', 'integer')
)
SELECT
  'required_columns' AS section,
  required_columns.table_name,
  required_columns.column_name,
  required_columns.expected_type,
  columns.data_type AS actual_type,
  columns.column_name IS NOT NULL AS present,
  columns.data_type = required_columns.expected_type AS type_matches
FROM required_columns
LEFT JOIN information_schema.columns columns
  ON columns.table_schema = 'public'
 AND columns.table_name = required_columns.table_name
 AND columns.column_name = required_columns.column_name
ORDER BY required_columns.table_name, required_columns.column_name;

WITH migration_columns(table_name, column_name, expected_type) AS (
  VALUES
    ('worker_sales_orders', 'cost_total', 'numeric'),
    ('worker_sales_orders', 'gross_profit', 'numeric'),
    ('worker_sales_order_items', 'unit_cost', 'numeric'),
    ('worker_sales_order_items', 'cost_total', 'numeric'),
    ('worker_sales_order_items', 'gross_profit', 'numeric'),
    ('worker_inventory_receipt_item_serials', 'status', 'text'),
    ('worker_inventory_receipt_item_serials', 'sales_order_id', 'uuid'),
    ('worker_inventory_receipt_item_serials', 'sales_order_item_id', 'uuid'),
    ('worker_inventory_receipt_item_serials', 'sold_at', 'timestamp with time zone')
)
SELECT
  'columns_added_or_confirmed_by_sales_profit_serials' AS section,
  migration_columns.table_name,
  migration_columns.column_name,
  migration_columns.expected_type,
  columns.data_type AS actual_type,
  columns.column_name IS NOT NULL AS already_present,
  (columns.column_name IS NULL OR columns.data_type = migration_columns.expected_type) AS safe_for_add_if_not_exists
FROM migration_columns
LEFT JOIN information_schema.columns columns
  ON columns.table_schema = 'public'
 AND columns.table_name = migration_columns.table_name
 AND columns.column_name = migration_columns.column_name
ORDER BY migration_columns.table_name, migration_columns.column_name;

SELECT
  'function_signatures' AS section,
  signature::text,
  to_regprocedure(signature) IS NOT NULL AS present
FROM (
  VALUES
    ('public.current_user_can_access_worker_data(uuid,text[])'::text),
    ('public.is_admin()'::text),
    ('public.create_worker_sales_order(uuid,text,jsonb,boolean,text,date)'::text),
    ('public.cancel_worker_sales_order(uuid)'::text),
    ('public.cancel_worker_inventory_receipt(uuid)'::text),
    ('public.reopen_legacy_job_with_inventory(uuid,jsonb)'::text)
) required(signature)
ORDER BY signature;

WITH fn AS (
  SELECT
    p.proname,
    p.oid,
    p.proconfig,
    pg_get_functiondef(p.oid) AS body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'create_worker_sales_order',
      'cancel_worker_sales_order',
      'cancel_worker_inventory_receipt',
      'reopen_legacy_job_with_inventory'
    )
)
SELECT
  'function_body_probe' AS section,
  proname,
  oid::regprocedure AS signature,
  proconfig,
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
      body ILIKE '%billgo_receivables%'
    ]
    WHEN 'cancel_worker_sales_order' THEN ARRAY[
      body ILIKE '%status = ''cancelled''%',
      body ILIKE '%status = ''in_stock''%',
      body ILIKE '%sales_order_id = NULL%',
      body ILIKE '%sales_order_item_id = NULL%',
      body ILIKE '%sold_at = NULL%'
    ]
    WHEN 'cancel_worker_inventory_receipt' THEN ARRAY[
      body ILIKE '%status = ''canceled''%',
      body ILIKE '%stock_applied_at = NULL%',
      body ILIKE '%status <> ''in_stock''%',
      body ILIKE '%stock_quantity = stock_quantity - v_item.quantity%'
    ]
    WHEN 'reopen_legacy_job_with_inventory' THEN ARRAY[
      body ILIKE '%completionRunId%',
      body ILIKE '%completion_run_id IS NULL%',
      body ILIKE '%stock_quantity = stock_quantity + v_item.quantity%',
      body ILIKE '%legacy_job_reopened%',
      body ILIKE '%inventoryRestored%'
    ]
    ELSE ARRAY[FALSE]
  END AS body_checks,
  NOT (FALSE = ANY (
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
        body ILIKE '%billgo_receivables%'
      ]
      WHEN 'cancel_worker_sales_order' THEN ARRAY[
        body ILIKE '%status = ''cancelled''%',
        body ILIKE '%status = ''in_stock''%',
        body ILIKE '%sales_order_id = NULL%',
        body ILIKE '%sales_order_item_id = NULL%',
        body ILIKE '%sold_at = NULL%'
      ]
      WHEN 'cancel_worker_inventory_receipt' THEN ARRAY[
        body ILIKE '%status = ''canceled''%',
        body ILIKE '%stock_applied_at = NULL%',
        body ILIKE '%status <> ''in_stock''%',
        body ILIKE '%stock_quantity = stock_quantity - v_item.quantity%'
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
  )) AS body_matches_expected_final_shape
FROM fn
ORDER BY proname, oid::regprocedure::text;

WITH fn AS (
  SELECT
    p.proname,
    p.oid,
    pg_get_functiondef(p.oid) AS body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'create_worker_sales_order',
      'cancel_worker_sales_order',
      'cancel_worker_inventory_receipt',
      'reopen_legacy_job_with_inventory'
    )
)
SELECT
  'function_body_for_manual_compare' AS section,
  proname,
  oid::regprocedure AS signature,
  body
FROM fn
ORDER BY proname, oid::regprocedure::text;

SELECT
  'constraints_and_indexes' AS section,
  item,
  present
FROM (
  VALUES
    (
      'worker_inventory_receipt_item_serials_status_check',
      EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'worker_inventory_receipt_item_serials_status_check'
          AND conrelid = 'public.worker_inventory_receipt_item_serials'::regclass
      )
    ),
    (
      'worker_inventory_products_recurring_cycle_check',
      EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'worker_inventory_products_recurring_cycle_check'
          AND conrelid = 'public.worker_inventory_products'::regclass
      )
    ),
    (
      'worker_inventory_receipt_item_serials_status_idx',
      to_regclass('public.worker_inventory_receipt_item_serials_status_idx') IS NOT NULL
    ),
    (
      'worker_inventory_receipt_item_serials_sales_item_idx',
      to_regclass('public.worker_inventory_receipt_item_serials_sales_item_idx') IS NOT NULL
    ),
    (
      'worker_sales_orders_job_id_idx',
      to_regclass('public.worker_sales_orders_job_id_idx') IS NOT NULL
    )
) checks(item, present)
ORDER BY item;

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
  'serial_status_distribution' AS section,
  CASE WHEN status_column.exists_status THEN to_jsonb(serials)->>'status' ELSE '[status column missing]' END AS status,
  COUNT(serials.id) AS row_count
FROM status_column
LEFT JOIN public.worker_inventory_receipt_item_serials serials
  ON status_column.exists_status
GROUP BY status_column.exists_status, CASE WHEN status_column.exists_status THEN to_jsonb(serials)->>'status' ELSE '[status column missing]' END
ORDER BY row_count DESC, status;

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
  'legacy_reopen_candidates' AS section,
  COUNT(DISTINCT jobs.id) AS completed_legacy_jobs_with_material_sales,
  COUNT(DISTINCT sales_order.id) AS linked_completed_sales_orders,
  COALESCE(SUM(item.quantity), 0) AS total_units_that_reopen_would_restore
FROM public.jobs
JOIN public.worker_sales_orders sales_order
  ON sales_order.job_id = jobs.id
 AND sales_order.worker_id = jobs.worker_id
 AND sales_order.status = 'completed'
 AND sales_order.completion_run_id IS NULL
JOIN public.worker_sales_order_items item
  ON item.order_id = sales_order.id
 AND item.product_id IS NOT NULL
WHERE jobs.status IN ('completed', 'done')
  AND COALESCE(jobs.workflow_data->>'completionRunId', '') = '';

SELECT
  'legacy_reopen_blocked_by_completion_run' AS section,
  COUNT(DISTINCT jobs.id) AS completed_jobs_with_completion_run,
  COUNT(DISTINCT sales_order.id) AS linked_sales_orders
FROM public.jobs
JOIN public.worker_sales_orders sales_order
  ON sales_order.job_id = jobs.id
 AND sales_order.worker_id = jobs.worker_id
 AND sales_order.status = 'completed'
JOIN public.worker_sales_order_items item
  ON item.order_id = sales_order.id
 AND item.product_id IS NOT NULL
WHERE jobs.status IN ('completed', 'done')
  AND (
    COALESCE(jobs.workflow_data->>'completionRunId', '') <> ''
    OR sales_order.completion_run_id IS NOT NULL
  );

SELECT
  'billgo_baseline_counts' AS section,
  (SELECT COUNT(*) FROM public.billgo_subscriptions) AS subscriptions,
  (SELECT COUNT(*) FROM public.billgo_receivables) AS receivables,
  (SELECT COUNT(*) FROM public.billgo_receipts) AS receipts,
  (SELECT COUNT(*) FROM public.billgo_subscriptions WHERE internet_account LIKE 'SALE-%') AS sale_generated_subscriptions,
  (SELECT COUNT(*) FROM public.billgo_receivables WHERE note LIKE 'Tao tu don ban %') AS sale_generated_receivables;

SELECT
  'billgo_active_root_internet_duplicate_risk' AS section,
  COUNT(*) AS duplicate_worker_account_groups,
  COALESCE(SUM(subscription_count), 0) AS duplicate_subscription_rows,
  COALESCE(SUM(receivable_count), 0) AS linked_receivable_rows,
  COALESCE(SUM(receivable_total_amount), 0) AS linked_receivable_total_amount,
  COALESCE(SUM(receivable_paid_amount), 0) AS linked_receivable_paid_amount
FROM (
  SELECT
    subscription.worker_id,
    lower(trim(subscription.internet_account)) AS account_key,
    COUNT(*) AS subscription_count,
    COALESCE(SUM(receivable_totals.receivable_count), 0) AS receivable_count,
    COALESCE(SUM(receivable_totals.total_amount), 0) AS receivable_total_amount,
    COALESCE(SUM(receivable_totals.paid_amount), 0) AS receivable_paid_amount
  FROM public.billgo_subscriptions subscription
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS receivable_count,
      SUM(COALESCE(receivable.total_amount, 0)) AS total_amount,
      SUM(COALESCE(receivable.paid_amount, 0)) AS paid_amount
    FROM public.billgo_receivables receivable
    WHERE receivable.subscription_id = subscription.id
      AND to_jsonb(receivable)->>'deleted_at' IS NULL
      AND receivable.status NOT IN ('cancelled', 'deleted')
  ) receivable_totals ON TRUE
  WHERE subscription.worker_id IS NOT NULL
    AND subscription.internet_account IS NOT NULL
    AND trim(subscription.internet_account) <> ''
    AND to_jsonb(subscription)->>'deleted_at' IS NULL
    AND subscription.status NOT IN ('cancelled', 'deleted')
    AND to_jsonb(subscription)->>'parent_subscription_id' IS NULL
    AND COALESCE(subscription.service_type, 'internet') = 'internet'
  GROUP BY subscription.worker_id, lower(trim(subscription.internet_account))
  HAVING COUNT(*) > 1
) duplicate_accounts;

WITH duplicate_accounts AS (
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
)
SELECT
  'billgo_active_root_internet_duplicate_detail' AS section,
  duplicate_account.worker_id,
  worker_profile.full_name AS worker_name,
  duplicate_account.account_key,
  COUNT(subscription.id) AS subscription_count,
  COUNT(*) FILTER (WHERE subscription.customer_id IS NULL) AS null_customer_id_count,
  COALESCE(SUM(receivable_totals.receivable_count), 0) AS receivable_count,
  COALESCE(SUM(receivable_totals.total_amount), 0) AS receivable_total_amount,
  COALESCE(SUM(receivable_totals.paid_amount), 0) AS receivable_paid_amount,
  array_agg(subscription.id ORDER BY subscription.created_at, subscription.id) AS subscription_ids,
  array_agg(DISTINCT COALESCE(subscription.status, '[null]') ORDER BY COALESCE(subscription.status, '[null]')) AS statuses,
  array_agg(DISTINCT COALESCE(subscription.service_type, '[null]') ORDER BY COALESCE(subscription.service_type, '[null]')) AS service_types
FROM duplicate_accounts duplicate_account
JOIN public.billgo_subscriptions subscription
  ON subscription.worker_id = duplicate_account.worker_id
 AND lower(trim(subscription.internet_account)) = duplicate_account.account_key
 AND to_jsonb(subscription)->>'deleted_at' IS NULL
 AND subscription.status NOT IN ('cancelled', 'deleted')
 AND to_jsonb(subscription)->>'parent_subscription_id' IS NULL
 AND COALESCE(subscription.service_type, 'internet') = 'internet'
LEFT JOIN public.workers worker
  ON worker.id = subscription.worker_id
LEFT JOIN public.profiles worker_profile
  ON worker_profile.id = worker.user_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS receivable_count,
    SUM(COALESCE(receivable.total_amount, 0)) AS total_amount,
    SUM(COALESCE(receivable.paid_amount, 0)) AS paid_amount
  FROM public.billgo_receivables receivable
  WHERE receivable.subscription_id = subscription.id
    AND to_jsonb(receivable)->>'deleted_at' IS NULL
    AND receivable.status NOT IN ('cancelled', 'deleted')
) receivable_totals ON TRUE
GROUP BY duplicate_account.worker_id, worker_profile.full_name, duplicate_account.account_key
ORDER BY receivable_paid_amount DESC, receivable_total_amount DESC, duplicate_account.account_key;

WITH duplicate_receivables AS (
  SELECT
    subscription.worker_id,
    lower(trim(subscription.internet_account)) AS account_key,
    subscription.id AS subscription_id,
    receivable.id AS receivable_id,
    COALESCE(
      receivable.period_start,
      make_date(COALESCE(receivable.billing_year, 2000), COALESCE(receivable.billing_month, 1), 1),
      receivable.collection_month
    ) AS period_key,
    receivable.total_amount,
    receivable.paid_amount,
    receivable.status
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
),
overlaps AS (
  SELECT
    worker_id,
    account_key,
    period_key,
    COUNT(*) AS receivable_count,
    COUNT(DISTINCT subscription_id) AS subscription_count,
    SUM(COALESCE(total_amount, 0)) AS total_amount,
    SUM(COALESCE(paid_amount, 0)) AS paid_amount,
    array_agg(DISTINCT subscription_id ORDER BY subscription_id) AS subscription_ids,
    array_agg(receivable_id ORDER BY receivable_id) AS receivable_ids,
    array_agg(DISTINCT COALESCE(status, '[null]') ORDER BY COALESCE(status, '[null]')) AS statuses
  FROM duplicate_receivables
  GROUP BY worker_id, account_key, period_key
  HAVING COUNT(DISTINCT subscription_id) > 1
)
SELECT
  'billgo_revenue_overlap_by_account_period' AS section,
  worker_id,
  account_key,
  period_key,
  receivable_count,
  subscription_count,
  total_amount,
  paid_amount,
  subscription_ids,
  receivable_ids,
  statuses,
  CASE
    WHEN paid_amount > 0 THEN 'NO_GO_PAID_REVENUE_OVERLAP'
    ELSE 'REVIEW_UNPAID_OVERLAP'
  END AS classification
FROM overlaps
ORDER BY paid_amount DESC, total_amount DESC, worker_id, account_key, period_key;

WITH active_receivables AS (
  SELECT *
  FROM public.billgo_receivables receivable
  WHERE receivable.subscription_id IS NOT NULL
    AND to_jsonb(receivable)->>'deleted_at' IS NULL
    AND receivable.status NOT IN ('cancelled', 'deleted')
),
duplicate_periods AS (
  SELECT
    subscription_id,
    COALESCE(
      period_start,
      make_date(COALESCE(billing_year, 2000), COALESCE(billing_month, 1), 1),
      collection_month
    ) AS period_key,
    COUNT(*) AS receivable_count,
    SUM(COALESCE(total_amount, 0)) AS total_amount,
    SUM(COALESCE(paid_amount, 0)) AS paid_amount,
    array_agg(id ORDER BY created_at, id) AS receivable_ids,
    array_agg(DISTINCT COALESCE(status, '[null]') ORDER BY COALESCE(status, '[null]')) AS statuses
  FROM active_receivables
  GROUP BY subscription_id, COALESCE(period_start, make_date(COALESCE(billing_year, 2000), COALESCE(billing_month, 1), 1), collection_month)
  HAVING COUNT(*) > 1
)
SELECT
  'billgo_duplicate_periods_by_subscription' AS section,
  subscription_id,
  period_key,
  receivable_count,
  total_amount,
  paid_amount,
  receivable_ids,
  statuses,
  CASE
    WHEN paid_amount > 0 THEN 'NO_GO_DUPLICATE_PAID_PERIOD'
    ELSE 'REVIEW_DUPLICATE_UNPAID_PERIOD'
  END AS classification
FROM duplicate_periods
ORDER BY paid_amount DESC, total_amount DESC, subscription_id, period_key;

SELECT
  'billgo_cycle_distribution' AS section,
  cycle,
  current_cycle,
  COUNT(*) AS row_count
FROM public.billgo_subscriptions
GROUP BY cycle, current_cycle
ORDER BY row_count DESC, cycle, current_cycle;

SELECT
  'billgo_receivable_cycle_distribution' AS section,
  cycle_at_collection,
  billing_months,
  bonus_months,
  service_months,
  COUNT(*) AS row_count
FROM public.billgo_receivables
GROUP BY cycle_at_collection, billing_months, bonus_months, service_months
ORDER BY row_count DESC, cycle_at_collection, billing_months, bonus_months, service_months;

SELECT
  'table_size_and_lock_risk_inputs' AS section,
  relname AS table_name,
  n_live_tup AS estimated_live_rows,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  seq_scan,
  idx_scan,
  n_dead_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN (
    'worker_sales_orders',
    'worker_sales_order_items',
    'worker_inventory_receipt_item_serials',
    'worker_inventory_products',
    'billgo_subscriptions',
    'billgo_receivables',
    'jobs'
  )
ORDER BY pg_total_relation_size(relid) DESC;

WITH checks AS (
  SELECT
    'required tables exist' AS check_name,
    NOT EXISTS (
      SELECT 1
      FROM (VALUES
        ('profiles'), ('workers'), ('jobs'), ('job_logs'),
        ('worker_inventory_products'), ('worker_inventory_receipts'),
        ('worker_inventory_receipt_items'), ('worker_inventory_receipt_item_serials'),
        ('worker_sales_orders'), ('worker_sales_order_items'),
        ('worker_product_warranties'), ('billgo_subscriptions'), ('billgo_receivables'), ('billgo_receipts')
      ) required(table_name)
      WHERE to_regclass('public.' || required.table_name) IS NULL
    ) AS pass,
    'Missing base tables means do not run these migrations yet.' AS detail
  UNION ALL
  SELECT
    'required pre-existing columns exist',
    NOT EXISTS (
      SELECT 1
      FROM (VALUES
        ('jobs','workflow_data'), ('worker_sales_orders','job_id'),
        ('worker_sales_orders','completion_run_id'), ('worker_sales_order_items','line_total'),
        ('worker_inventory_products','recurring_cycle'), ('worker_inventory_products','purchase_price'),
        ('billgo_subscriptions','internet_account'), ('billgo_receivables','cycle_at_collection')
      ) required(table_name, column_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns columns
        WHERE columns.table_schema = 'public'
          AND columns.table_name = required.table_name
          AND columns.column_name = required.column_name
      )
    ),
    'These two migrations assume earlier inventory/sales/BillGo migrations are already present.'
  UNION ALL
  SELECT
    'uuid-ossp available through public or extensions search path',
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'uuid_generate_v4'
        AND n.nspname IN ('public', 'extensions')
    ),
    'Final sales RPC uses uuid_generate_v4(); staging required search_path public, extensions.'
  UNION ALL
  SELECT
    'recurring_cycle values accepted by new constraint',
    NOT EXISTS (
      SELECT 1
      FROM public.worker_inventory_products
      WHERE recurring_cycle IS NOT NULL
        AND recurring_cycle NOT IN ('monthly', 'two_months', 'three_months', 'six_months', 'yearly')
    ),
    'Invalid recurring_cycle values would make the CHECK constraint fail.'
  UNION ALL
  SELECT
    'serial status values accepted by new constraint if column already exists',
    NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'worker_inventory_receipt_item_serials'
        AND column_name = 'status'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.worker_inventory_receipt_item_serials
      WHERE to_jsonb(worker_inventory_receipt_item_serials)->>'status' NOT IN ('in_stock', 'sold', 'canceled')
    ),
    'Invalid serial status values would make the CHECK constraint fail.'
  UNION ALL
  SELECT
    'BillGo has no duplicate active root Internet accounts per worker',
    NOT EXISTS (
      SELECT 1
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
    'Only root active Internet subscriptions with the same worker/account block deployment. TV360 child rows, standalone customer_id NULL rows, and deleted/cancelled subscriptions do not block by themselves.'
  UNION ALL
  SELECT
    'BillGo has no paid revenue overlap across duplicate root account periods',
    NOT EXISTS (
      SELECT 1
      FROM (
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
      ) paid_overlaps
    ),
    'Paid overlap means two active root subscriptions for the same worker/account carry paid receivables in the same period; review accounting source of truth before deployment.'
  UNION ALL
  SELECT
    'BillGo has no duplicate paid periods within one subscription',
    NOT EXISTS (
      SELECT 1
      FROM public.billgo_receivables receivable
      WHERE receivable.subscription_id IS NOT NULL
        AND to_jsonb(receivable)->>'deleted_at' IS NULL
        AND receivable.status NOT IN ('cancelled', 'deleted')
      GROUP BY receivable.subscription_id, COALESCE(receivable.period_start, make_date(COALESCE(receivable.billing_year, 2000), COALESCE(receivable.billing_month, 1), 1), receivable.collection_month)
      HAVING COUNT(*) > 1
         AND SUM(COALESCE(receivable.paid_amount, 0)) > 0
    ),
    'Duplicate paid periods within one subscription can double count revenue and must be reviewed before deployment.'
  UNION ALL
  SELECT
    'current sales RPC body captured for manual review',
    to_regprocedure('public.create_worker_sales_order(uuid,text,jsonb,boolean,text,date)') IS NOT NULL,
    'Review function_body_probe before replacing this RPC; mismatch with final shape is expected if production has not been upgraded yet.'
)
SELECT
  'GO/NO-GO summary' AS section,
  check_name,
  pass,
  CASE WHEN pass THEN 'GO' ELSE 'NO-GO' END AS decision,
  detail
FROM checks
ORDER BY pass, check_name;

COMMIT;
