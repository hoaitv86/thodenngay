-- Deprecated compatibility migration.
-- Worker acceptance now uses public.worker_accept_job() in
-- migration_worker_accept_job_no_approval.sql, assigning jobs immediately.

DROP POLICY IF EXISTS "Workers request pending jobs" ON public.jobs;
