-- Backfill missing worker inventory product codes without changing existing valid codes.
-- Product codes remain unique in the existing worker_id + sku scope.

WITH products_with_prefix AS (
  SELECT
    id,
    worker_id,
    sku,
    CASE
      WHEN category ILIKE '%internet%'
        OR category ILIKE '%mạng%'
        OR category ILIKE '%mang%'
        OR category ILIKE '%wifi%'
        OR category ILIKE '%router%'
        OR category ILIKE '%network%'
        OR category ILIKE '%thiết bị mạng%'
      THEN 'NET'
      WHEN category ILIKE '%camera%'
        OR category ILIKE '%cctv%'
        OR category ILIKE '%đầu ghi%'
        OR category ILIKE '%dau ghi%'
      THEN 'CAM'
      WHEN category ILIKE '%máy tính%'
        OR category ILIKE '%may tinh%'
        OR category ILIKE '%laptop%'
        OR category ILIKE '%computer%'
        OR category ILIKE '%pc%'
      THEN 'PC'
      WHEN category ILIKE '%máy in%'
        OR category ILIKE '%may in%'
        OR category ILIKE '%printer%'
      THEN 'PRI'
      ELSE 'SP'
    END AS prefix
  FROM public.worker_inventory_products
),
existing_prefix_max AS (
  SELECT
    worker_id,
    prefix,
    COALESCE(MAX((SUBSTRING(UPPER(TRIM(sku)) FROM LENGTH(prefix) + 1))::INTEGER), 0) AS max_sequence
  FROM products_with_prefix
  WHERE UPPER(TRIM(sku)) ~ ('^' || prefix || '[0-9]+$')
  GROUP BY worker_id, prefix
),
blank_products AS (
  SELECT
    product.id,
    product.worker_id,
    product.prefix,
    COALESCE(existing.max_sequence, 0)
      + ROW_NUMBER() OVER (
        PARTITION BY product.worker_id, product.prefix
        ORDER BY inventory.created_at, inventory.id
      ) AS next_sequence
  FROM products_with_prefix product
  JOIN public.worker_inventory_products inventory ON inventory.id = product.id
  LEFT JOIN existing_prefix_max existing
    ON existing.worker_id = product.worker_id
   AND existing.prefix = product.prefix
  WHERE COALESCE(BTRIM(product.sku), '') = ''
)
UPDATE public.worker_inventory_products inventory
SET sku = blank.prefix
  || CASE
    WHEN LENGTH(blank.next_sequence::TEXT) < 4 THEN LPAD(blank.next_sequence::TEXT, 4, '0')
    ELSE blank.next_sequence::TEXT
  END,
  updated_at = NOW()
FROM blank_products blank
WHERE inventory.id = blank.id;
