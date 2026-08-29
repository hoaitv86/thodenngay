-- Track whether profile GPS is fresh enough to be considered live.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_location_updated_at_idx
  ON public.profiles(location_updated_at)
  WHERE gps_location IS NOT NULL;
