ALTER TABLE public.billgo_packages
ALTER COLUMN allowed_cycles SET DEFAULT ARRAY['monthly', 'two_months', 'three_months', 'six_months', 'yearly']::TEXT[];

ALTER TABLE public.billgo_packages
DROP CONSTRAINT IF EXISTS billgo_packages_allowed_cycles_check;

ALTER TABLE public.billgo_packages
ADD CONSTRAINT billgo_packages_allowed_cycles_check
CHECK (allowed_cycles <@ ARRAY['monthly', 'two_months', 'three_months', 'six_months', 'yearly']::TEXT[]);

UPDATE public.billgo_packages
SET allowed_cycles = ARRAY(
  SELECT DISTINCT cycle
  FROM unnest(allowed_cycles || ARRAY['two_months', 'three_months']::TEXT[]) AS cycle
)
WHERE allowed_cycles IS NOT NULL
  AND NOT allowed_cycles @> ARRAY['two_months', 'three_months']::TEXT[];
