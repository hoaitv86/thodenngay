-- Fix GPS columns required by customer/worker location features.
-- Run this in Supabase SQL Editor if the app shows:
-- "Could not find the 'gps_location' column of 'profiles' in the schema cache".

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gps_location JSONB;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS gps_location JSONB,
ADD COLUMN IF NOT EXISTS customer_gps_location JSONB,
ADD COLUMN IF NOT EXISTS worker_gps_location JSONB;

-- Ask Supabase/PostgREST to refresh its schema cache after the DDL change.
NOTIFY pgrst, 'reload schema';
