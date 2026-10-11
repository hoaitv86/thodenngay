-- BillGo duplicate investigation, SELECT-only.
-- Use in Supabase SQL Editor before deciding GO/NO-GO.
-- This script does not delete, merge, update, insert, or run migrations.

BEGIN READ ONLY;

SELECT
  'context' AS section,
  current_database() AS database_name,
  current_user AS sql_user,
  now() AS checked_at;

WITH duplicate_accounts AS (
  SELECT
    lower(trim(subscription.internet_account)) AS account_key
  FROM public.billgo_subscriptions subscription
  WHERE subscription.internet_account IS NOT NULL
    AND trim(subscription.internet_account) <> ''
  GROUP BY lower(trim(subscription.internet_account))
  HAVING COUNT(*) > 1
),
duplicate_subscriptions AS (
  SELECT
    subscription.*,
    lower(trim(subscription.internet_account)) AS account_key
  FROM public.billgo_subscriptions subscription
  JOIN duplicate_accounts duplicate_account
    ON duplicate_account.account_key = lower(trim(subscription.internet_account))
)
SELECT
  '01_duplicate_account_groups_all_statuses' AS section,
  account_key,
  COUNT(*) AS subscription_count,
  COUNT(*) FILTER (WHERE customer_id IS NULL) AS null_customer_id_count,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND status NOT IN ('cancelled', 'deleted')
  ) AS active_not_deleted_count,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND status NOT IN ('cancelled', 'deleted')
      AND COALESCE(parent_subscription_id::text, '') = ''
      AND COALESCE(service_type, 'internet') = 'internet'
  ) AS active_root_internet_count,
  COUNT(DISTINCT worker_id) AS worker_count,
  array_agg(id ORDER BY created_at, id) AS subscription_ids,
  array_agg(DISTINCT COALESCE(status, '[null]') ORDER BY COALESCE(status, '[null]')) AS statuses,
  array_agg(DISTINCT COALESCE(service_type, '[null]') ORDER BY COALESCE(service_type, '[null]')) AS service_types
FROM duplicate_subscriptions
GROUP BY account_key
ORDER BY active_root_internet_count DESC, subscription_count DESC, account_key;

WITH duplicate_accounts AS (
  SELECT
    worker_id,
    lower(trim(internet_account)) AS account_key
  FROM public.billgo_subscriptions
  WHERE worker_id IS NOT NULL
    AND internet_account IS NOT NULL
    AND trim(internet_account) <> ''
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled', 'deleted')
    AND COALESCE(parent_subscription_id::text, '') = ''
    AND COALESCE(service_type, 'internet') = 'internet'
  GROUP BY worker_id, lower(trim(internet_account))
  HAVING COUNT(*) > 1
)
SELECT
  '02_true_active_root_internet_duplicates' AS section,
  duplicate_account.worker_id,
  worker_profile.full_name AS worker_name,
  duplicate_account.account_key,
  COUNT(subscription.id) AS subscription_count,
  COUNT(*) FILTER (WHERE subscription.customer_id IS NULL) AS null_customer_id_count,
  COALESCE(SUM(receivable_totals.receivable_count), 0) AS receivable_count,
  COALESCE(SUM(receivable_totals.total_amount), 0) AS receivable_total_amount,
  COALESCE(SUM(receivable_totals.paid_amount), 0) AS receivable_paid_amount,
  array_agg(subscription.id ORDER BY subscription.created_at, subscription.id) AS subscription_ids,
  CASE
    WHEN COUNT(subscription.id) > 1 THEN 'NO_GO_REVIEW_TRUE_DUPLICATE'
    ELSE 'GO'
  END AS classification
FROM duplicate_accounts duplicate_account
JOIN public.billgo_subscriptions subscription
  ON subscription.worker_id = duplicate_account.worker_id
 AND lower(trim(subscription.internet_account)) = duplicate_account.account_key
 AND subscription.deleted_at IS NULL
 AND subscription.status NOT IN ('cancelled', 'deleted')
 AND COALESCE(subscription.parent_subscription_id::text, '') = ''
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
    AND receivable.deleted_at IS NULL
    AND receivable.status NOT IN ('cancelled', 'deleted')
) receivable_totals ON TRUE
GROUP BY duplicate_account.worker_id, worker_profile.full_name, duplicate_account.account_key
ORDER BY receivable_paid_amount DESC, receivable_total_amount DESC, duplicate_account.account_key;

WITH duplicate_accounts AS (
  SELECT
    worker_id,
    lower(trim(internet_account)) AS account_key
  FROM public.billgo_subscriptions
  WHERE worker_id IS NOT NULL
    AND internet_account IS NOT NULL
    AND trim(internet_account) <> ''
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled', 'deleted')
    AND COALESCE(parent_subscription_id::text, '') = ''
    AND COALESCE(service_type, 'internet') = 'internet'
  GROUP BY worker_id, lower(trim(internet_account))
  HAVING COUNT(*) > 1
)
SELECT
  '03_duplicate_subscription_detail' AS section,
  subscription.worker_id,
  worker_profile.full_name AS worker_name,
  lower(trim(subscription.internet_account)) AS account_key,
  subscription.id AS subscription_id,
  subscription.customer_id,
  customer.full_name AS linked_customer_name,
  subscription.customer_name,
  subscription.phone,
  subscription.customer_address,
  subscription.area_id,
  subscription.sub_area_id,
  subscription.address_detail,
  subscription.provider,
  subscription.package_name,
  subscription.service_type,
  subscription.cycle,
  subscription.current_cycle,
  subscription.monthly_fee,
  subscription.amount_per_cycle,
  subscription.start_date,
  subscription.next_period_start,
  subscription.next_due_date,
  subscription.covered_until,
  subscription.status,
  subscription.deleted_at,
  subscription.parent_subscription_id,
  subscription.created_at,
  subscription.updated_at,
  subscription.note
FROM public.billgo_subscriptions subscription
JOIN duplicate_accounts duplicate_account
  ON duplicate_account.worker_id = subscription.worker_id
 AND duplicate_account.account_key = lower(trim(subscription.internet_account))
LEFT JOIN public.workers worker
  ON worker.id = subscription.worker_id
LEFT JOIN public.profiles worker_profile
  ON worker_profile.id = worker.user_id
LEFT JOIN public.profiles customer
  ON customer.id = subscription.customer_id
WHERE subscription.deleted_at IS NULL
  AND subscription.status NOT IN ('cancelled', 'deleted')
  AND COALESCE(subscription.parent_subscription_id::text, '') = ''
  AND COALESCE(subscription.service_type, 'internet') = 'internet'
ORDER BY subscription.worker_id, account_key, subscription.created_at, subscription.id;

WITH duplicate_accounts AS (
  SELECT
    worker_id,
    lower(trim(internet_account)) AS account_key
  FROM public.billgo_subscriptions
  WHERE worker_id IS NOT NULL
    AND internet_account IS NOT NULL
    AND trim(internet_account) <> ''
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled', 'deleted')
    AND COALESCE(parent_subscription_id::text, '') = ''
    AND COALESCE(service_type, 'internet') = 'internet'
  GROUP BY worker_id, lower(trim(internet_account))
  HAVING COUNT(*) > 1
)
SELECT
  '04_receivable_periods_for_duplicate_subscriptions' AS section,
  subscription.worker_id,
  lower(trim(subscription.internet_account)) AS account_key,
  subscription.id AS subscription_id,
  receivable.id AS receivable_id,
  receivable.type,
  receivable.title,
  receivable.period_start,
  receivable.period_end,
  receivable.collection_month,
  receivable.usage_month,
  receivable.billing_month,
  receivable.billing_year,
  receivable.cycle_at_collection,
  receivable.billing_months,
  receivable.bonus_months,
  receivable.service_months,
  receivable.due_date,
  receivable.total_amount,
  receivable.paid_amount,
  payment_totals.payment_count,
  payment_totals.payment_paid_amount,
  receipt_totals.receipt_count,
  receipt_totals.receipt_paid_amount,
  coverage_totals.coverage_months,
  receivable.status,
  receivable.deleted_at,
  receivable.created_at,
  receivable.updated_at,
  receivable.note
FROM public.billgo_subscriptions subscription
JOIN duplicate_accounts duplicate_account
  ON duplicate_account.worker_id = subscription.worker_id
 AND duplicate_account.account_key = lower(trim(subscription.internet_account))
JOIN public.billgo_receivables receivable
  ON receivable.subscription_id = subscription.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS payment_count,
    SUM(COALESCE(payment.amount, 0)) FILTER (WHERE payment.status = 'paid') AS payment_paid_amount
  FROM public.payments payment
  WHERE payment.receivable_id = receivable.id
) payment_totals ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS receipt_count,
    SUM(COALESCE(receipt.paid_amount, 0)) FILTER (WHERE receipt.status IS NULL OR receipt.status <> 'void') AS receipt_paid_amount
  FROM public.billgo_receipts receipt
  WHERE receipt.receivable_id = receivable.id
) receipt_totals ON TRUE
LEFT JOIN LATERAL (
  SELECT
    array_agg(coverage.covered_month ORDER BY coverage.covered_month) AS coverage_months
  FROM public.billgo_payment_coverages coverage
  WHERE coverage.receivable_id = receivable.id
) coverage_totals ON TRUE
WHERE subscription.deleted_at IS NULL
  AND subscription.status NOT IN ('cancelled', 'deleted')
  AND COALESCE(subscription.parent_subscription_id::text, '') = ''
  AND COALESCE(subscription.service_type, 'internet') = 'internet'
ORDER BY subscription.worker_id, account_key, receivable.period_start, receivable.due_date, subscription.id, receivable.id;

WITH duplicate_accounts AS (
  SELECT
    worker_id,
    lower(trim(internet_account)) AS account_key
  FROM public.billgo_subscriptions
  WHERE worker_id IS NOT NULL
    AND internet_account IS NOT NULL
    AND trim(internet_account) <> ''
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled', 'deleted')
    AND COALESCE(parent_subscription_id::text, '') = ''
    AND COALESCE(service_type, 'internet') = 'internet'
  GROUP BY worker_id, lower(trim(internet_account))
  HAVING COUNT(*) > 1
),
duplicate_receivables AS (
  SELECT
    subscription.worker_id,
    lower(trim(subscription.internet_account)) AS account_key,
    subscription.id AS subscription_id,
    receivable.id AS receivable_id,
    receivable.period_start,
    receivable.period_end,
    receivable.billing_month,
    receivable.billing_year,
    receivable.collection_month,
    receivable.total_amount,
    receivable.paid_amount,
    receivable.status
  FROM public.billgo_subscriptions subscription
  JOIN duplicate_accounts duplicate_account
    ON duplicate_account.worker_id = subscription.worker_id
   AND duplicate_account.account_key = lower(trim(subscription.internet_account))
  JOIN public.billgo_receivables receivable
    ON receivable.subscription_id = subscription.id
  WHERE subscription.deleted_at IS NULL
    AND subscription.status NOT IN ('cancelled', 'deleted')
    AND COALESCE(subscription.parent_subscription_id::text, '') = ''
    AND COALESCE(subscription.service_type, 'internet') = 'internet'
    AND receivable.deleted_at IS NULL
    AND receivable.status NOT IN ('cancelled', 'deleted')
)
SELECT
  '05_revenue_overlap_by_account_period' AS section,
  worker_id,
  account_key,
  COALESCE(period_start, make_date(COALESCE(billing_year, 2000), COALESCE(billing_month, 1), 1), collection_month) AS period_key,
  COUNT(*) AS receivable_count,
  COUNT(DISTINCT subscription_id) AS subscription_count,
  SUM(COALESCE(total_amount, 0)) AS total_amount,
  SUM(COALESCE(paid_amount, 0)) AS paid_amount,
  array_agg(subscription_id ORDER BY subscription_id) AS subscription_ids,
  array_agg(receivable_id ORDER BY receivable_id) AS receivable_ids,
  array_agg(DISTINCT COALESCE(status, '[null]') ORDER BY COALESCE(status, '[null]')) AS statuses,
  CASE
    WHEN COUNT(DISTINCT subscription_id) > 1 AND SUM(COALESCE(paid_amount, 0)) > 0 THEN 'NO_GO_PAID_REVENUE_OVERLAP'
    WHEN COUNT(DISTINCT subscription_id) > 1 THEN 'REVIEW_UNPAID_OVERLAP'
    ELSE 'OK'
  END AS classification
FROM duplicate_receivables
GROUP BY worker_id, account_key, COALESCE(period_start, make_date(COALESCE(billing_year, 2000), COALESCE(billing_month, 1), 1), collection_month)
HAVING COUNT(*) > 1
ORDER BY paid_amount DESC, total_amount DESC, worker_id, account_key, period_key;

WITH active_receivables AS (
  SELECT *
  FROM public.billgo_receivables
  WHERE subscription_id IS NOT NULL
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled', 'deleted')
)
SELECT
  '06_duplicate_periods_by_subscription' AS section,
  subscription_id,
  COALESCE(period_start, make_date(COALESCE(billing_year, 2000), COALESCE(billing_month, 1), 1), collection_month) AS period_key,
  COUNT(*) AS receivable_count,
  SUM(COALESCE(total_amount, 0)) AS total_amount,
  SUM(COALESCE(paid_amount, 0)) AS paid_amount,
  array_agg(id ORDER BY created_at, id) AS receivable_ids,
  array_agg(DISTINCT COALESCE(status, '[null]') ORDER BY COALESCE(status, '[null]')) AS statuses,
  CASE
    WHEN SUM(COALESCE(paid_amount, 0)) > 0 THEN 'NO_GO_DUPLICATE_PAID_PERIOD'
    ELSE 'REVIEW_DUPLICATE_UNPAID_PERIOD'
  END AS classification
FROM active_receivables
GROUP BY subscription_id, COALESCE(period_start, make_date(COALESCE(billing_year, 2000), COALESCE(billing_month, 1), 1), collection_month)
HAVING COUNT(*) > 1
ORDER BY paid_amount DESC, total_amount DESC, subscription_id, period_key;

WITH active_root_internet_duplicates AS (
  SELECT
    worker_id,
    lower(trim(internet_account)) AS account_key
  FROM public.billgo_subscriptions
  WHERE worker_id IS NOT NULL
    AND internet_account IS NOT NULL
    AND trim(internet_account) <> ''
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled', 'deleted')
    AND COALESCE(parent_subscription_id::text, '') = ''
    AND COALESCE(service_type, 'internet') = 'internet'
  GROUP BY worker_id, lower(trim(internet_account))
  HAVING COUNT(*) > 1
),
period_overlaps AS (
  SELECT
    subscription.worker_id,
    lower(trim(subscription.internet_account)) AS account_key,
    COALESCE(receivable.period_start, make_date(COALESCE(receivable.billing_year, 2000), COALESCE(receivable.billing_month, 1), 1), receivable.collection_month) AS period_key,
    COUNT(DISTINCT subscription.id) AS subscription_count,
    SUM(COALESCE(receivable.paid_amount, 0)) AS paid_amount
  FROM public.billgo_subscriptions subscription
  JOIN public.billgo_receivables receivable
    ON receivable.subscription_id = subscription.id
  WHERE subscription.worker_id IS NOT NULL
    AND subscription.internet_account IS NOT NULL
    AND trim(subscription.internet_account) <> ''
    AND subscription.deleted_at IS NULL
    AND subscription.status NOT IN ('cancelled', 'deleted')
    AND COALESCE(subscription.parent_subscription_id::text, '') = ''
    AND COALESCE(subscription.service_type, 'internet') = 'internet'
    AND receivable.deleted_at IS NULL
    AND receivable.status NOT IN ('cancelled', 'deleted')
  GROUP BY subscription.worker_id, lower(trim(subscription.internet_account)), COALESCE(receivable.period_start, make_date(COALESCE(receivable.billing_year, 2000), COALESCE(receivable.billing_month, 1), 1), receivable.collection_month)
  HAVING COUNT(DISTINCT subscription.id) > 1
)
SELECT
  '07_go_no_go_summary' AS section,
  check_name,
  pass,
  CASE WHEN pass THEN 'GO' ELSE 'NO-GO' END AS decision,
  detail
FROM (
  SELECT
    'No active root Internet account duplicates per worker' AS check_name,
    NOT EXISTS (SELECT 1 FROM active_root_internet_duplicates) AS pass,
    'Blocks the TV360 unique index and can create ambiguous customer identity.' AS detail
  UNION ALL
  SELECT
    'No paid revenue overlap across duplicate root subscriptions' AS check_name,
    NOT EXISTS (SELECT 1 FROM period_overlaps WHERE paid_amount > 0) AS pass,
    'If false, do not merge/delete automatically; first identify which paid receivable is the accounting source of truth.' AS detail
  UNION ALL
  SELECT
    'No unpaid period overlap across duplicate root subscriptions' AS check_name,
    NOT EXISTS (SELECT 1 FROM period_overlaps) AS pass,
    'If false with paid overlap false, the data issue may be resolvable by operator review before collection.' AS detail
) summary
ORDER BY pass, check_name;

COMMIT;
