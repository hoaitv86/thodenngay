CREATE TABLE IF NOT EXISTS public.worker_monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  goal_month DATE NOT NULL,
  revenue_target NUMERIC NOT NULL DEFAULT 20000000 CHECK (revenue_target >= 0),
  total_customers_target INTEGER NOT NULL DEFAULT 40 CHECK (total_customers_target >= 0),
  new_customers_target INTEGER NOT NULL DEFAULT 10 CHECK (new_customers_target >= 0),
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, goal_month)
);

CREATE INDEX IF NOT EXISTS worker_monthly_goals_worker_month_idx
  ON public.worker_monthly_goals(worker_id, goal_month DESC);

ALTER TABLE public.worker_monthly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers manage own monthly goals" ON public.worker_monthly_goals;
CREATE POLICY "Workers manage own monthly goals"
ON public.worker_monthly_goals
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.workers
    WHERE workers.id = worker_monthly_goals.worker_id
      AND workers.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workers
    WHERE workers.id = worker_monthly_goals.worker_id
      AND workers.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins manage all monthly goals" ON public.worker_monthly_goals;
CREATE POLICY "Admins manage all monthly goals"
ON public.worker_monthly_goals
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS update_worker_monthly_goals_updated_at ON public.worker_monthly_goals;
CREATE TRIGGER update_worker_monthly_goals_updated_at
BEFORE UPDATE ON public.worker_monthly_goals
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();
