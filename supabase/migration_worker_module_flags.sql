-- Worker menu module flags. Specialties stay technical-only; BillGo/Sales/Inventory are toggled here.

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS module_flags JSONB NOT NULL DEFAULT '{"billgo": false, "sales": false}'::jsonb;

ALTER TABLE public.worker_units
  ADD COLUMN IF NOT EXISTS module_flags JSONB NOT NULL DEFAULT '{"billgo": false, "sales": false}'::jsonb;

UPDATE public.workers
SET module_flags = COALESCE(module_flags, '{}'::jsonb) || '{"billgo": true, "sales": true}'::jsonb
WHERE user_id IN (
  SELECT id
  FROM public.profiles
  WHERE normalized_phone = '0912345679' OR phone = '0912345679'
);

UPDATE public.workers worker
SET module_flags = COALESCE(worker.module_flags, '{}'::jsonb) || '{"billgo": true}'::jsonb
WHERE EXISTS (
  SELECT 1 FROM public.billgo_subscriptions subscription WHERE subscription.worker_id = worker.id
) OR EXISTS (
  SELECT 1 FROM public.billgo_receivables receivable WHERE receivable.worker_id = worker.id
);

UPDATE public.workers worker
SET module_flags = COALESCE(worker.module_flags, '{}'::jsonb) || '{"sales": true}'::jsonb
WHERE EXISTS (
  SELECT 1 FROM public.worker_inventory_products product WHERE product.worker_id = worker.id
) OR EXISTS (
  SELECT 1 FROM public.worker_sales_orders sales_order WHERE sales_order.worker_id = worker.id
);

UPDATE public.worker_units unit
SET module_flags = COALESCE(unit.module_flags, '{}'::jsonb) || '{"billgo": true}'::jsonb
WHERE EXISTS (
  SELECT 1
  FROM public.workers owner_worker
  WHERE owner_worker.user_id = unit.owner_id
    AND COALESCE(owner_worker.module_flags->>'billgo', 'false') = 'true'
);

UPDATE public.worker_units unit
SET module_flags = COALESCE(unit.module_flags, '{}'::jsonb) || '{"sales": true}'::jsonb
WHERE EXISTS (
  SELECT 1
  FROM public.workers owner_worker
  WHERE owner_worker.user_id = unit.owner_id
    AND COALESCE(owner_worker.module_flags->>'sales', 'false') = 'true'
);
