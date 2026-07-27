-- ===== MIGRATION V3: System Settings =====

-- Create system_settings table if not exists
CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    app_name TEXT DEFAULT 'Thợ Đến Ngay',
    hotline TEXT DEFAULT '1900 1234',
    support_email TEXT DEFAULT 'support@thodenngay.vn',
    company_address TEXT DEFAULT '123 Đường A, Quận 1, TP.HCM',
    facebook_url TEXT DEFAULT 'https://facebook.com/thodenngay',
    zalo_url TEXT DEFAULT 'https://zalo.me/thodenngay',
    maintenance_mode BOOLEAN DEFAULT FALSE,
    terms_url TEXT DEFAULT 'https://thodenngay.vn/terms',
    privacy_url TEXT DEFAULT 'https://thodenngay.vn/privacy',
    apk_backup_download_url TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS apk_backup_download_url TEXT DEFAULT '';

-- Insert default settings row
INSERT INTO public.system_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users
DROP POLICY IF EXISTS "Allow public read access to system_settings" ON public.system_settings;
CREATE POLICY "Allow public read access to system_settings" ON public.system_settings
    FOR SELECT USING (true);

-- Allow write access to admins only
DROP POLICY IF EXISTS "Allow admins write access to system_settings" ON public.system_settings;
CREATE POLICY "Allow admins write access to system_settings" ON public.system_settings
    FOR ALL USING (public.is_admin());
