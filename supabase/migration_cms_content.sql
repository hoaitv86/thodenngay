-- CMS content management and public policy pages

CREATE TABLE IF NOT EXISTS public.cms_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  display_locations TEXT[] NOT NULL DEFAULT '{footer}',
  content_type TEXT NOT NULL DEFAULT 'article' CHECK (content_type IN ('article', 'fixed_page')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cms_posts
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS display_locations TEXT[] NOT NULL DEFAULT '{footer}',
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'article' CHECK (content_type IN ('article', 'fixed_page')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'));

CREATE INDEX IF NOT EXISTS cms_posts_published_sort_idx
  ON public.cms_posts (is_published, sort_order, title);

CREATE INDEX IF NOT EXISTS cms_posts_slug_idx
  ON public.cms_posts (slug);

CREATE INDEX IF NOT EXISTS cms_posts_display_locations_idx
  ON public.cms_posts USING GIN (display_locations);

ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view published cms posts" ON public.cms_posts;
CREATE POLICY "Public view published cms posts"
  ON public.cms_posts FOR SELECT
  USING (is_published = TRUE AND status = 'published');

DROP POLICY IF EXISTS "Admins view all cms posts" ON public.cms_posts;
CREATE POLICY "Admins view all cms posts"
  ON public.cms_posts FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins create cms posts" ON public.cms_posts;
CREATE POLICY "Admins create cms posts"
  ON public.cms_posts FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update cms posts" ON public.cms_posts;
CREATE POLICY "Admins update cms posts"
  ON public.cms_posts FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete cms posts" ON public.cms_posts;
CREATE POLICY "Admins delete cms posts"
  ON public.cms_posts FOR DELETE
  USING (public.is_admin());

DROP TRIGGER IF EXISTS update_cms_posts_updated_at ON public.cms_posts;
CREATE TRIGGER update_cms_posts_updated_at
  BEFORE UPDATE ON public.cms_posts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('cms-images', 'cms-images', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access CMS Images" ON storage.objects;
CREATE POLICY "Public Access CMS Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cms-images');

DROP POLICY IF EXISTS "Admins Upload CMS Images" ON storage.objects;
CREATE POLICY "Admins Upload CMS Images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cms-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins Update CMS Images" ON storage.objects;
CREATE POLICY "Admins Update CMS Images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'cms-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'cms-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins Delete CMS Images" ON storage.objects;
CREATE POLICY "Admins Delete CMS Images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'cms-images' AND public.is_admin());

INSERT INTO public.cms_posts (slug, title, excerpt, content_html, image_urls, display_locations, content_type, status, is_published, sort_order, published_at)
VALUES
  ('ve-chung-toi', 'Về chúng tôi', NULL, '', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 10, NOW()),
  ('dieu-khoan-su-dung', 'Điều khoản sử dụng', NULL, '', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 20, NOW()),
  ('chinh-sach-bao-mat', 'Chính sách bảo mật', NULL, '', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 30, NOW()),
  ('chinh-sach-tho', 'Chính sách dành cho thợ', NULL, '', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 40, NOW()),
  ('chinh-sach-khach-hang', 'Chính sách dành cho khách hàng', NULL, '', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 50, NOW())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  image_urls = COALESCE(public.cms_posts.image_urls, '{}'),
  display_locations = EXCLUDED.display_locations,
  content_type = 'fixed_page',
  sort_order = EXCLUDED.sort_order,
  published_at = COALESCE(public.cms_posts.published_at, NOW());
