-- Performance indexes for common Supabase query filters and ordering.
-- This migration is data-safe: it only creates indexes when they are missing.

CREATE INDEX IF NOT EXISTS jobs_customer_created_at_idx
  ON public.jobs(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS jobs_worker_updated_at_idx
  ON public.jobs(worker_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS jobs_status_created_at_idx
  ON public.jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS jobs_service_id_idx
  ON public.jobs(service_id);

CREATE INDEX IF NOT EXISTS jobs_scheduled_at_idx
  ON public.jobs(scheduled_at);

CREATE INDEX IF NOT EXISTS workers_user_id_idx
  ON public.workers(user_id);

CREATE INDEX IF NOT EXISTS workers_status_idx
  ON public.workers(status);

CREATE INDEX IF NOT EXISTS profiles_role_idx
  ON public.profiles(role);

CREATE INDEX IF NOT EXISTS profiles_phone_idx
  ON public.profiles(phone);

CREATE INDEX IF NOT EXISTS services_parent_service_id_idx
  ON public.services(parent_service_id);

CREATE INDEX IF NOT EXISTS services_is_active_idx
  ON public.services(is_active);

CREATE INDEX IF NOT EXISTS ratings_worker_id_idx
  ON public.ratings(worker_id);

CREATE INDEX IF NOT EXISTS payments_job_id_idx
  ON public.payments(job_id);

CREATE INDEX IF NOT EXISTS billgo_receivables_worker_due_date_idx
  ON public.billgo_receivables(worker_id, due_date);

CREATE INDEX IF NOT EXISTS billgo_receivables_status_due_date_idx
  ON public.billgo_receivables(status, due_date);

CREATE INDEX IF NOT EXISTS billgo_receivables_subscription_due_date_idx
  ON public.billgo_receivables(subscription_id, due_date);
