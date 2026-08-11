-- Optimize BillGo customer list loading before offline-first sync.
-- Safe to run repeatedly; all indexes are additive and non-destructive.

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_customer_idx
  ON public.billgo_subscriptions(worker_id, customer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_phone_idx
  ON public.billgo_subscriptions(worker_id, phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_account_lookup_perf_idx
  ON public.billgo_subscriptions(worker_id, lower(internet_account))
  WHERE deleted_at IS NULL AND internet_account IS NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_next_due_status_idx
  ON public.billgo_subscriptions(worker_id, next_due_date, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_subscriptions_worker_area_status_idx
  ON public.billgo_subscriptions(worker_id, area_id, sub_area_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_receivables_worker_due_status_idx
  ON public.billgo_receivables(worker_id, due_date, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_receivables_worker_period_status_perf_idx
  ON public.billgo_receivables(worker_id, billing_year, billing_month, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_receivables_subscription_status_period_idx
  ON public.billgo_receivables(subscription_id, status, period_end)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_receivables_customer_idx
  ON public.billgo_receivables(customer_id)
  WHERE customer_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billgo_payment_coverages_subscription_month_idx
  ON public.billgo_payment_coverages(subscription_id, covered_month);

CREATE INDEX IF NOT EXISTS payments_receivable_status_paid_at_idx
  ON public.payments(receivable_id, status, paid_at DESC)
  WHERE receivable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billgo_receipts_subscription_paid_at_perf_idx
  ON public.billgo_receipts(subscription_id, paid_at DESC)
  WHERE subscription_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billgo_subscriptions' AND column_name = 'store_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_subscriptions_store_status_due_idx ON public.billgo_subscriptions(store_id, status, next_due_date) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_subscriptions_store_account_idx ON public.billgo_subscriptions(store_id, lower(internet_account)) WHERE deleted_at IS NULL AND internet_account IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_subscriptions_store_phone_idx ON public.billgo_subscriptions(store_id, phone) WHERE deleted_at IS NULL AND phone IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billgo_receivables' AND column_name = 'store_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_receivables_store_status_due_idx ON public.billgo_receivables(store_id, status, due_date) WHERE deleted_at IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billgo_receivables' AND column_name = 'payment_status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS billgo_receivables_payment_status_idx ON public.billgo_receivables(payment_status) WHERE deleted_at IS NULL';
  END IF;
END $$;
-- Server-side list projection for BillGo customer loading.
-- Keeps the list endpoint offline-first friendly: one compact JSON page + totals,
-- with payment/detail history loaded only by the detail endpoint.
CREATE OR REPLACE FUNCTION public.billgo_customer_list_page(
  p_worker_id UUID,
  p_month TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 30,
  p_cycle TEXT DEFAULT 'all',
  p_status TEXT DEFAULT 'all',
  p_due TEXT DEFAULT 'all',
  p_area_id UUID DEFAULT NULL,
  p_sub_area_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
WITH params AS (
  SELECT
    GREATEST(COALESCE(p_page, 1), 1) AS page,
    LEAST(GREATEST(COALESCE(p_limit, 30), 1), 50) AS page_limit,
    COALESCE(NULLIF(p_cycle, ''), 'all') AS cycle_filter,
    COALESCE(NULLIF(p_status, ''), 'all') AS status_filter,
    COALESCE(NULLIF(p_due, ''), 'all') AS due_filter,
    lower(trim(COALESCE(p_search, ''))) AS search_text,
    COALESCE(to_date(NULLIF(p_month, ''), 'YYYY-MM'), date_trunc('month', CURRENT_DATE)::DATE) AS covered_month
), month_bounds AS (
  SELECT
    params.*,
    EXTRACT(YEAR FROM params.covered_month)::INTEGER AS bill_year,
    EXTRACT(MONTH FROM params.covered_month)::INTEGER AS bill_month,
    (date_trunc('month', params.covered_month) + INTERVAL '1 month - 1 day')::DATE AS covered_month_end
  FROM params
), subscriptions AS (
  SELECT
    subscription.*,
    COALESCE(subscription.covered_until + INTERVAL '1 day', subscription.next_period_start)::DATE AS effective_next_period_start,
    lower(concat_ws(' ',
      subscription.customer_name,
      subscription.phone,
      subscription.internet_account,
      to_jsonb(subscription)->>'tv360_account',
      subscription.customer_address,
      subscription.address_detail,
      subscription.legacy_address,
      subscription.provider,
      subscription.package_name
    )) AS search_blob
  FROM public.billgo_subscriptions subscription, month_bounds params
  WHERE subscription.worker_id = p_worker_id
    AND subscription.deleted_at IS NULL
    AND subscription.status NOT IN ('cancelled', 'deleted')
    AND (p_area_id IS NULL OR subscription.area_id = p_area_id)
    AND (p_sub_area_id IS NULL OR subscription.sub_area_id = p_sub_area_id)
    AND (params.search_text = '' OR lower(concat_ws(' ',
      subscription.customer_name,
      subscription.phone,
      subscription.internet_account,
      to_jsonb(subscription)->>'tv360_account',
      subscription.customer_address,
      subscription.address_detail,
      subscription.legacy_address,
      subscription.provider,
      subscription.package_name
    )) LIKE '%' || params.search_text || '%')
), current_receivables AS (
  SELECT receivable.*
  FROM public.billgo_receivables receivable
  JOIN subscriptions subscription ON subscription.id = receivable.subscription_id
  CROSS JOIN month_bounds params
  WHERE receivable.worker_id = p_worker_id
    AND receivable.deleted_at IS NULL
    AND (
      (receivable.billing_month = params.bill_month AND receivable.billing_year = params.bill_year)
      OR (receivable.period_start <= params.covered_month_end AND receivable.period_end >= params.covered_month)
    )
), current_subscription_ids AS (
  SELECT DISTINCT subscription_id FROM current_receivables WHERE subscription_id IS NOT NULL
), coverage AS (
  SELECT coverage.subscription_id, max(coverage.coverage_type) AS coverage_type
  FROM public.billgo_payment_coverages coverage
  JOIN subscriptions subscription ON subscription.id = coverage.subscription_id
  CROSS JOIN month_bounds params
  WHERE coverage.covered_month = params.covered_month
  GROUP BY coverage.subscription_id
), base_rows AS (
  SELECT
    receivable.id::TEXT AS id,
    receivable.customer_id,
    receivable.worker_id,
    receivable.subscription_id,
    receivable.total_amount,
    receivable.due_date,
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
    receivable.next_period_start,
    receivable.next_due_date,
    receivable.paid_amount,
    receivable.paid_at,
    receivable.payment_method,
    receivable.status,
    receivable.note,
    to_jsonb(subscription) - 'search_blob' - 'effective_next_period_start' AS subscription
  FROM current_receivables receivable
  JOIN subscriptions subscription ON subscription.id = receivable.subscription_id

  UNION ALL

  SELECT
    ('not_due_' || subscription.id)::TEXT AS id,
    subscription.customer_id,
    subscription.worker_id,
    subscription.id AS subscription_id,
    0::NUMERIC AS total_amount,
    subscription.next_due_date AS due_date,
    params.covered_month AS period_start,
    params.covered_month_end AS period_end,
    params.covered_month AS collection_month,
    params.covered_month AS usage_month,
    NULL::INTEGER AS billing_month,
    NULL::INTEGER AS billing_year,
    COALESCE(subscription.current_cycle, subscription.cycle, 'monthly') AS cycle_at_collection,
    CASE COALESCE(subscription.current_cycle, subscription.cycle, 'monthly')
      WHEN 'two_months' THEN 2 WHEN 'three_months' THEN 3 WHEN 'six_months' THEN 6 WHEN 'yearly' THEN 12 ELSE 1
    END AS billing_months,
    CASE COALESCE(subscription.current_cycle, subscription.cycle, 'monthly') WHEN 'yearly' THEN 1 ELSE 0 END AS bonus_months,
    CASE COALESCE(subscription.current_cycle, subscription.cycle, 'monthly')
      WHEN 'two_months' THEN 2 WHEN 'three_months' THEN 3 WHEN 'six_months' THEN 6 WHEN 'yearly' THEN 13 ELSE 1
    END AS service_months,
    subscription.effective_next_period_start AS next_period_start,
    subscription.next_due_date,
    0::NUMERIC AS paid_amount,
    NULL::TIMESTAMPTZ AS paid_at,
    NULL::TEXT AS payment_method,
    CASE coverage.coverage_type WHEN 'paid' THEN 'paid' WHEN 'promo' THEN 'promo' ELSE 'not_due' END AS status,
    NULL::TEXT AS note,
    to_jsonb(subscription) - 'search_blob' - 'effective_next_period_start' AS subscription
  FROM subscriptions subscription
  JOIN coverage ON coverage.subscription_id = subscription.id
  CROSS JOIN month_bounds params
  LEFT JOIN current_subscription_ids current_ids ON current_ids.subscription_id = subscription.id
  WHERE current_ids.subscription_id IS NULL

  UNION ALL

  SELECT
    ('pending_cycle_' || subscription.id)::TEXT AS id,
    subscription.customer_id,
    subscription.worker_id,
    subscription.id AS subscription_id,
    0::NUMERIC AS total_amount,
    NULL::DATE AS due_date,
    NULL::DATE AS period_start,
    NULL::DATE AS period_end,
    NULL::DATE AS collection_month,
    NULL::DATE AS usage_month,
    NULL::INTEGER AS billing_month,
    NULL::INTEGER AS billing_year,
    NULL::TEXT AS cycle_at_collection,
    0::INTEGER AS billing_months,
    0::INTEGER AS bonus_months,
    0::INTEGER AS service_months,
    NULL::DATE AS next_period_start,
    NULL::DATE AS next_due_date,
    0::NUMERIC AS paid_amount,
    NULL::TIMESTAMPTZ AS paid_at,
    NULL::TEXT AS payment_method,
    'pending_cycle'::TEXT AS status,
    CASE WHEN subscription.next_period_start IS NOT NULL THEN 'Pending cycle reset' ELSE 'Pending cycle setup' END AS note,
    to_jsonb(subscription) - 'search_blob' - 'effective_next_period_start' AS subscription
  FROM subscriptions subscription
  CROSS JOIN month_bounds params
  LEFT JOIN current_subscription_ids current_ids ON current_ids.subscription_id = subscription.id
  WHERE current_ids.subscription_id IS NULL
    AND subscription.status = 'pending_cycle'
), scored_rows AS (
  SELECT
    base_rows.*,
    CASE
      WHEN base_rows.status = 'pending_cycle' THEN 'pending_cycle'
      WHEN COALESCE(base_rows.total_amount, 0) > 0 AND GREATEST(COALESCE(base_rows.total_amount, 0) - COALESCE(base_rows.paid_amount, 0), 0) <= 0 THEN 'paid'
      WHEN COALESCE(base_rows.paid_amount, 0) > 0 AND GREATEST(COALESCE(base_rows.total_amount, 0) - COALESCE(base_rows.paid_amount, 0), 0) > 0 THEN 'partial'
      WHEN base_rows.due_date IS NOT NULL AND base_rows.due_date < CURRENT_DATE AND GREATEST(COALESCE(base_rows.total_amount, 0) - COALESCE(base_rows.paid_amount, 0), 0) > 0 THEN 'overdue'
      WHEN base_rows.status IN ('paid', 'not_due', 'promo') THEN base_rows.status
      ELSE 'unpaid'
    END AS list_status,
    COALESCE(base_rows.cycle_at_collection, base_rows.subscription->>'current_cycle', base_rows.subscription->>'cycle', 'monthly') AS list_cycle
  FROM base_rows
), filtered_rows AS (
  SELECT scored_rows.*
  FROM scored_rows, month_bounds params
  WHERE (params.cycle_filter = 'all' OR scored_rows.list_cycle = params.cycle_filter)
    AND (
      params.status_filter = 'all'
      OR (params.status_filter = 'unpaid' AND scored_rows.list_status IN ('unpaid', 'partial', 'overdue'))
      OR scored_rows.list_status = params.status_filter
    )
    AND (
      params.due_filter = 'all'
      OR (params.due_filter = 'due_this_month' AND to_char(scored_rows.due_date, 'YYYY-MM') = to_char(params.covered_month, 'YYYY-MM'))
      OR (params.due_filter = 'not_due' AND (scored_rows.list_status = 'not_due' OR (scored_rows.list_status NOT IN ('paid', 'promo') AND scored_rows.due_date > CURRENT_DATE)))
    )
), totals AS (
  SELECT
    COUNT(*)::INTEGER AS total_customers,
    COUNT(*) FILTER (WHERE list_status = 'pending_cycle')::INTEGER AS pending_cycle,
    COUNT(*) FILTER (WHERE list_status = 'unpaid')::INTEGER AS unpaid,
    COUNT(*) FILTER (WHERE list_status = 'paid')::INTEGER AS paid,
    COUNT(*) FILTER (WHERE list_status = 'partial')::INTEGER AS partial,
    COUNT(*) FILTER (WHERE list_status = 'overdue')::INTEGER AS overdue,
    COUNT(*) FILTER (WHERE list_status = 'promo')::INTEGER AS promo,
    COUNT(*) FILTER (WHERE list_status = 'not_due')::INTEGER AS not_due,
    COALESCE(SUM(COALESCE(total_amount, 0)), 0) AS total_receivable,
    COALESCE(SUM(COALESCE(paid_amount, 0)), 0) AS total_paid,
    COALESCE(SUM(GREATEST(COALESCE(total_amount, 0) - COALESCE(paid_amount, 0), 0)), 0) AS total_debt
  FROM filtered_rows
), page_context AS (
  SELECT
    params.page_limit,
    GREATEST(CEIL(totals.total_customers::NUMERIC / params.page_limit)::INTEGER, 1) AS page_count,
    LEAST(params.page, GREATEST(CEIL(totals.total_customers::NUMERIC / params.page_limit)::INTEGER, 1)) AS effective_page
  FROM month_bounds params, totals
), numbered_rows AS (
  SELECT filtered_rows.*, row_number() OVER (ORDER BY COALESCE(due_date, DATE '9999-12-31'), subscription->>'customer_name') AS row_number
  FROM filtered_rows
), page_rows AS (
  SELECT numbered_rows.*
  FROM numbered_rows, page_context params
  WHERE numbered_rows.row_number > ((params.effective_page - 1) * params.page_limit)
    AND numbered_rows.row_number <= (params.effective_page * params.page_limit)
), hydrated_rows AS (
  SELECT jsonb_build_object(
    'id', page_rows.id,
    'customer_id', page_rows.customer_id,
    'worker_id', page_rows.worker_id,
    'subscription_id', page_rows.subscription_id,
    'total_amount', page_rows.total_amount,
    'due_date', page_rows.due_date,
    'period_start', page_rows.period_start,
    'period_end', page_rows.period_end,
    'collection_month', page_rows.collection_month,
    'usage_month', page_rows.usage_month,
    'billing_month', page_rows.billing_month,
    'billing_year', page_rows.billing_year,
    'cycle_at_collection', page_rows.cycle_at_collection,
    'billing_months', page_rows.billing_months,
    'bonus_months', page_rows.bonus_months,
    'service_months', page_rows.service_months,
    'next_period_start', page_rows.next_period_start,
    'next_due_date', page_rows.next_due_date,
    'paid_amount', page_rows.paid_amount,
    'paid_at', page_rows.paid_at,
    'payment_method', page_rows.payment_method,
    'status', page_rows.status,
    'note', page_rows.note,
    'subscription', page_rows.subscription || jsonb_build_object('billgo_cycle_changes', '[]'::jsonb, 'billgo_status_events', '[]'::jsonb, 'billgo_receipts', '[]'::jsonb),
    'previous_unpaid_receivables', COALESCE(previous.previous_rows, '[]'::jsonb),
    'payments', '[]'::jsonb
  ) AS row_json
  FROM page_rows
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(to_jsonb(previous_row) - 'subscription_id' ORDER BY previous_row.billing_year DESC, previous_row.billing_month DESC) AS previous_rows
    FROM public.billgo_receivables previous_row, month_bounds params
    WHERE previous_row.worker_id = p_worker_id
      AND previous_row.subscription_id = page_rows.subscription_id
      AND previous_row.deleted_at IS NULL
      AND previous_row.status IN ('unpaid', 'partial', 'overdue', 'due')
      AND (
        previous_row.period_end < params.covered_month
        OR (previous_row.period_end IS NULL AND previous_row.billing_year < params.bill_year)
        OR (previous_row.period_end IS NULL AND previous_row.billing_year = params.bill_year AND previous_row.billing_month < params.bill_month)
      )
  ) previous ON TRUE
)
SELECT jsonb_build_object(
  'rows', COALESCE((SELECT jsonb_agg(row_json) FROM hydrated_rows), '[]'::jsonb),
  'total', (SELECT total_customers FROM totals),
  'page', (SELECT effective_page FROM page_context),
  'limit', (SELECT page_limit FROM page_context),
  'pageCount', (SELECT page_count FROM page_context),
  'totals', jsonb_build_object(
    'totalCustomers', (SELECT total_customers FROM totals),
    'pendingCycle', (SELECT pending_cycle FROM totals),
    'unpaid', (SELECT unpaid FROM totals),
    'paid', (SELECT paid FROM totals),
    'partial', (SELECT partial FROM totals),
    'overdue', (SELECT overdue FROM totals),
    'promo', (SELECT promo FROM totals),
    'notDue', (SELECT not_due FROM totals),
    'totalReceivable', (SELECT total_receivable FROM totals),
    'totalPaid', (SELECT total_paid FROM totals),
    'totalDebt', (SELECT total_debt FROM totals)
  )
);
$$;
