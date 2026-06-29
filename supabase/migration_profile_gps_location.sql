-- Store the customer's default GPS location captured during registration/profile setup.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gps_location JSONB;
