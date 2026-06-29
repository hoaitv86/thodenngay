-- Store customer and worker location snapshots on the job when work is assigned.
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS customer_gps_location JSONB,
ADD COLUMN IF NOT EXISTS worker_gps_location JSONB;
