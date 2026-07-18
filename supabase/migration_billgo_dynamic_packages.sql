-- Dynamic BillGo package catalog.
-- Adds editable Internet/TV360/receiver packages while keeping subscription and receivable snapshots stable.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.billgo_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'internet' CHECK (type IN ('internet', 'tv360', 'receiver')),
  provider TEXT,
  monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  setup_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (setup_price >= 0),
  allowed_cycles TEXT[] NOT NULL DEFAULT ARRAY['monthly', 'six_months', 'yearly']::TEXT[],
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.billgo_packages
DROP CONSTRAINT IF EXISTS billgo_packages_allowed_cycles_check;

ALTER TABLE public.billgo_packages
ADD CONSTRAINT billgo_packages_allowed_cycles_check
CHECK (allowed_cycles <@ ARRAY['monthly', 'six_months', 'yearly']::TEXT[]);

ALTER TABLE public.billgo_subscriptions
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.billgo_packages(id) ON DELETE SET NULL;

ALTER TABLE public.billgo_receivables
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.billgo_packages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS package_name_at_collection TEXT;

UPDATE public.billgo_receivables receivable
SET package_name_at_collection = COALESCE(receivable.package_name_at_collection, subscription.package_name)
FROM public.billgo_subscriptions subscription
WHERE receivable.subscription_id = subscription.id
  AND receivable.package_name_at_collection IS NULL;

CREATE INDEX IF NOT EXISTS billgo_packages_active_type_idx
ON public.billgo_packages(is_active, type, sort_order, name);

CREATE INDEX IF NOT EXISTS billgo_subscriptions_package_id_idx
ON public.billgo_subscriptions(package_id);

CREATE INDEX IF NOT EXISTS billgo_receivables_package_id_idx
ON public.billgo_receivables(package_id);

DROP TRIGGER IF EXISTS update_billgo_packages_updated_at ON public.billgo_packages;
CREATE TRIGGER update_billgo_packages_updated_at
BEFORE UPDATE ON public.billgo_packages
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

INSERT INTO public.billgo_packages (code, name, type, provider, monthly_price, setup_price, sort_order)
VALUES
  ('internet-basic', 'Internet Basic', 'internet', 'Viettel', 165000, 0, 10),
  ('internet-plus', 'Internet Plus', 'internet', 'Viettel', 220000, 0, 20),
  ('tv360-standard', 'TV360 Standard', 'tv360', 'Viettel', 60000, 0, 30),
  ('receiver-standard', 'Đầu thu Standard', 'receiver', 'Viettel', 50000, 0, 40)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.billgo_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage BillGo packages" ON public.billgo_packages;
DROP POLICY IF EXISTS "Authenticated users view active BillGo packages" ON public.billgo_packages;

CREATE POLICY "Admins manage BillGo packages"
ON public.billgo_packages
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users view active BillGo packages"
ON public.billgo_packages
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = TRUE);
