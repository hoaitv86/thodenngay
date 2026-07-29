-- Add fixed CMS information and policy pages

ALTER TABLE public.cms_posts
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS display_locations TEXT[] NOT NULL DEFAULT '{footer}',
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'article' CHECK (content_type IN ('article', 'fixed_page')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'));

ALTER TABLE public.cms_posts
  ALTER COLUMN display_locations SET DEFAULT '{footer}';

UPDATE public.cms_posts
SET content_type = 'fixed_page',
    status = 'published',
    is_published = TRUE,
    display_locations = ARRAY['footer','app_info'],
    published_at = COALESCE(published_at, NOW())
WHERE slug IN ('ve-chung-toi', 'dieu-khoan-su-dung', 'chinh-sach-bao-mat', 'chinh-sach-tho', 'chinh-sach-khach-hang');

INSERT INTO public.cms_posts (slug, title, excerpt, content_html, image_urls, display_locations, content_type, status, is_published, sort_order, published_at)
VALUES
  ('ve-chung-toi', 'Về chúng tôi', 'Giới thiệu về Thợ Đến Ngay và cách nền tảng hỗ trợ khách hàng, thợ.', '<p>Thợ Đến Ngay là nền tảng kết nối khách hàng với thợ sửa chữa, lắp đặt và bảo trì tại nhà một cách nhanh chóng, minh bạch và thuận tiện.</p>', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 10, NOW()),
  ('dieu-khoan-su-dung', 'Điều khoản sử dụng', 'Các điều kiện khi truy cập, đăng ký và sử dụng dịch vụ.', '<p>Khi sử dụng Thợ Đến Ngay, người dùng đồng ý cung cấp thông tin chính xác và tuân thủ quy trình đặt dịch vụ.</p>', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 20, NOW()),
  ('chinh-sach-bao-mat', 'Chính sách bảo mật', 'Cách Thợ Đến Ngay thu thập, sử dụng và bảo vệ thông tin cá nhân.', '<p>Thợ Đến Ngay chỉ thu thập thông tin cần thiết để cung cấp dịch vụ, xác thực tài khoản, điều phối thợ và chăm sóc khách hàng.</p>', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 30, NOW()),
  ('chinh-sach-tho', 'Chính sách dành cho thợ', 'Quy định tham gia, nhận việc và trách nhiệm của thợ.', '<p>Thợ tham gia nền tảng cần cung cấp hồ sơ chính xác, nhận việc đúng khả năng chuyên môn và thực hiện dịch vụ chuyên nghiệp.</p>', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 40, NOW()),
  ('chinh-sach-khach-hang', 'Chính sách dành cho khách hàng', 'Quyền lợi, trách nhiệm và hướng dẫn sử dụng dịch vụ.', '<p>Khách hàng có quyền nhận thông tin dịch vụ, chi phí dự kiến và trạng thái xử lý công việc một cách minh bạch.</p>', '{}', ARRAY['footer','app_info'], 'fixed_page', 'published', TRUE, 50, NOW())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content_html = EXCLUDED.content_html,
  image_urls = EXCLUDED.image_urls,
  display_locations = EXCLUDED.display_locations,
  content_type = 'fixed_page',
  status = 'published',
  is_published = TRUE,
  sort_order = EXCLUDED.sort_order,
  published_at = COALESCE(public.cms_posts.published_at, NOW()),
  updated_at = NOW();

DROP POLICY IF EXISTS "Public view published cms posts" ON public.cms_posts;
CREATE POLICY "Public view published cms posts"
  ON public.cms_posts FOR SELECT
  USING (is_published = TRUE AND status = 'published');
