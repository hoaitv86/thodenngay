-- BillGo worker RLS fix for servers without SUPABASE_SERVICE_ROLE_KEY.
-- Safe to run multiple times after the BillGo lifecycle migrations.

ALTER TABLE public.billgo_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billgo_receivables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers create own BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Workers update own BillGo subscriptions" ON public.billgo_subscriptions;
DROP POLICY IF EXISTS "Workers create own BillGo receivables" ON public.billgo_receivables;
DROP POLICY IF EXISTS "Workers update own BillGo receivables" ON public.billgo_receivables;

CREATE POLICY "Workers create own BillGo subscriptions"
ON public.billgo_subscriptions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = billgo_subscriptions.worker_id
      AND worker.user_id = auth.uid()
  )
);

CREATE POLICY "Workers update own BillGo subscriptions"
ON public.billgo_subscriptions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = billgo_subscriptions.worker_id
      AND worker.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = billgo_subscriptions.worker_id
      AND worker.user_id = auth.uid()
  )
);

CREATE POLICY "Workers create own BillGo receivables"
ON public.billgo_receivables
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = billgo_receivables.worker_id
      AND worker.user_id = auth.uid()
  )
);

CREATE POLICY "Workers update own BillGo receivables"
ON public.billgo_receivables
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = billgo_receivables.worker_id
      AND worker.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workers worker
    WHERE worker.id = billgo_receivables.worker_id
      AND worker.user_id = auth.uid()
  )
);

DO $$
BEGIN
  IF to_regclass('public.billgo_payment_coverages') IS NOT NULL THEN
    ALTER TABLE public.billgo_payment_coverages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Workers create own BillGo payment coverages" ON public.billgo_payment_coverages;
    CREATE POLICY "Workers create own BillGo payment coverages"
    ON public.billgo_payment_coverages
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.billgo_receivables receivable
        JOIN public.workers worker ON worker.id = receivable.worker_id
        WHERE receivable.id = billgo_payment_coverages.receivable_id
          AND worker.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.billgo_cycle_changes') IS NOT NULL THEN
    ALTER TABLE public.billgo_cycle_changes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Workers create own BillGo cycle changes" ON public.billgo_cycle_changes;
    CREATE POLICY "Workers create own BillGo cycle changes"
    ON public.billgo_cycle_changes
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.billgo_subscriptions subscription
        JOIN public.workers worker ON worker.id = subscription.worker_id
        WHERE subscription.id = billgo_cycle_changes.subscription_id
          AND worker.user_id = auth.uid()
      )
    );
  END IF;

  IF to_regclass('public.billgo_status_events') IS NOT NULL THEN
    ALTER TABLE public.billgo_status_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Workers create own BillGo status events" ON public.billgo_status_events;
    CREATE POLICY "Workers create own BillGo status events"
    ON public.billgo_status_events
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.billgo_subscriptions subscription
        JOIN public.workers worker ON worker.id = subscription.worker_id
        WHERE subscription.id = billgo_status_events.subscription_id
          AND worker.user_id = auth.uid()
      )
    );
  END IF;

  IF to_regclass('public.billgo_area_changes') IS NOT NULL THEN
    ALTER TABLE public.billgo_area_changes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Workers create own BillGo area changes" ON public.billgo_area_changes;
    CREATE POLICY "Workers create own BillGo area changes"
    ON public.billgo_area_changes
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.billgo_subscriptions subscription
        JOIN public.workers worker ON worker.id = subscription.worker_id
        WHERE subscription.id = billgo_area_changes.subscription_id
          AND worker.user_id = auth.uid()
      )
    );
  END IF;
END $$;
