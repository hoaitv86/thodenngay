-- Add display locations and multiple images to CMS articles

ALTER TABLE public.cms_posts
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS display_locations TEXT[] NOT NULL DEFAULT '{footer}';

CREATE INDEX IF NOT EXISTS cms_posts_display_locations_idx
  ON public.cms_posts USING GIN (display_locations);

UPDATE public.cms_posts
SET display_locations = CASE slug
  WHEN 've-tho-den-ngay' THEN ARRAY['footer','home']::TEXT[]
  WHEN 'dieu-khoan-su-dung' THEN ARRAY['footer']::TEXT[]
  WHEN 'dieu-khoan' THEN ARRAY['footer']::TEXT[]
  WHEN 'chinh-sach-bao-mat' THEN ARRAY['footer']::TEXT[]
  WHEN 'chinh-sach-danh-cho-tho' THEN ARRAY['footer']::TEXT[]
  WHEN 'chinh-sach-tho' THEN ARRAY['footer']::TEXT[]
  WHEN 'chinh-sach-danh-cho-khach-hang' THEN ARRAY['footer']::TEXT[]
  WHEN 'chinh-sach-khach-hang' THEN ARRAY['footer']::TEXT[]
  WHEN 'quy-che-hoat-dong' THEN ARRAY['footer']::TEXT[]
  WHEN 'lien-he' THEN ARRAY['footer','popup']::TEXT[]
  ELSE display_locations
END
WHERE slug IN ('ve-tho-den-ngay','dieu-khoan-su-dung','dieu-khoan','chinh-sach-bao-mat','chinh-sach-danh-cho-tho','chinh-sach-tho','chinh-sach-danh-cho-khach-hang','chinh-sach-khach-hang','quy-che-hoat-dong','lien-he');

INSERT INTO public.cms_posts (slug, title, excerpt, content_html, image_urls, display_locations, is_published, sort_order, published_at)
VALUES
  ('ve-tho-den-ngay', 'Về Thợ Đến Ngay', 'Giới thiệu nền tảng kết nối khách hàng với thợ sửa chữa chuyên nghiệp.', '<p>Thợ Đến Ngay là nền tảng hỗ trợ khách hàng tìm thợ sửa chữa, lắp đặt và bảo trì tại nhà nhanh chóng, minh bạch và thuận tiện.</p>', '{}', ARRAY['footer','home']::TEXT[], TRUE, 10, NOW()),
  ('dieu-khoan', 'Điều khoản', 'Các điều kiện khi truy cập, đăng ký và sử dụng dịch vụ.', '<p>Khi sử dụng Thợ Đến Ngay, người dùng đồng ý cung cấp thông tin chính xác và tuân thủ quy trình đặt dịch vụ.</p>', '{}', ARRAY['footer']::TEXT[], TRUE, 20, NOW()),
  ('chinh-sach-bao-mat', 'Chính sách bảo mật', 'Cách thu thập, sử dụng và bảo vệ thông tin cá nhân.', '<p>Thợ Đến Ngay chỉ thu thập thông tin cần thiết để cung cấp dịch vụ, xác thực tài khoản, điều phối thợ và chăm sóc khách hàng.</p>', '{}', ARRAY['footer']::TEXT[], TRUE, 30, NOW()),
  ('chinh-sach-tho', 'Chính sách thợ', 'Quy định tham gia, nhận việc và trách nhiệm của thợ.', '<p>Thợ tham gia nền tảng cần cung cấp hồ sơ chính xác, nhận việc đúng khả năng chuyên môn và thực hiện dịch vụ chuyên nghiệp.</p>', '{}', ARRAY['footer']::TEXT[], TRUE, 40, NOW()),
  ('chinh-sach-khach-hang', 'Chính sách khách hàng', 'Quyền lợi, trách nhiệm và hướng dẫn sử dụng dịch vụ.', '<p>Khách hàng có quyền nhận thông tin dịch vụ, chi phí dự kiến và trạng thái xử lý công việc một cách minh bạch.</p>', '{}', ARRAY['footer']::TEXT[], TRUE, 50, NOW()),
  ('quy-che-hoat-dong', 'Quy chế hoạt động', 'Nguyên tắc vận hành, điều phối dịch vụ và xử lý phát sinh.', '<p>Thợ Đến Ngay vận hành theo mô hình kết nối nhu cầu sửa chữa của khách hàng với đội ngũ thợ phù hợp.</p>', '{}', ARRAY['footer']::TEXT[], TRUE, 60, NOW()),
  ('lien-he', 'Liên hệ', 'Thông tin liên hệ và kênh hỗ trợ chính thức.', '<p>Đội ngũ Thợ Đến Ngay luôn sẵn sàng tiếp nhận phản hồi, hỗ trợ tài khoản và xử lý các vấn đề phát sinh.</p>', '{}', ARRAY['footer','popup']::TEXT[], TRUE, 70, NOW())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  display_locations = EXCLUDED.display_locations,
  image_urls = COALESCE(public.cms_posts.image_urls, '{}'),
  is_published = TRUE,
  sort_order = EXCLUDED.sort_order,
  published_at = COALESCE(public.cms_posts.published_at, NOW());
