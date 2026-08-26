-- Add fixed CMS information and policy pages

ALTER TABLE public.cms_posts
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS display_locations TEXT[] NOT NULL DEFAULT '{footer}',
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'article' CHECK (content_type IN ('article', 'fixed_page')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'));

ALTER TABLE public.cms_posts
  ALTER COLUMN display_locations SET DEFAULT '{footer}';

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
  status = CASE WHEN public.cms_posts.is_published THEN 'published' ELSE COALESCE(public.cms_posts.status, 'draft') END,
  sort_order = EXCLUDED.sort_order,
  published_at = CASE WHEN public.cms_posts.is_published THEN COALESCE(public.cms_posts.published_at, NOW()) ELSE public.cms_posts.published_at END,
  updated_at = NOW();

DROP POLICY IF EXISTS "Public view published cms posts" ON public.cms_posts;
CREATE POLICY "Public view published cms posts"
  ON public.cms_posts FOR SELECT
  USING (is_published = TRUE AND status = 'published');
