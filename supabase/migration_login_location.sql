-- Store normalized login location without removing the legacy gps_location field.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS location_updated_by TEXT;
