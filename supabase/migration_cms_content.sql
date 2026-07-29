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
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  USING (is_published = TRUE);

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

INSERT INTO public.cms_posts (slug, title, excerpt, content_html, is_published, sort_order, published_at)
VALUES
  ('ve-tho-den-ngay', 'Về Thợ Đến Ngay', 'Giới thiệu nền tảng kết nối khách hàng với thợ sửa chữa chuyên nghiệp.', '<p>Thợ Đến Ngay là nền tảng hỗ trợ khách hàng tìm thợ sửa chữa, lắp đặt và bảo trì tại nhà một cách nhanh chóng, minh bạch và thuận tiện.</p><p>Chúng tôi xây dựng quy trình đặt lịch, xác nhận công việc, theo dõi trạng thái và đánh giá sau dịch vụ để nâng cao trải nghiệm cho cả khách hàng và đội ngũ thợ.</p>', TRUE, 10, NOW()),
  ('dieu-khoan-su-dung', 'Điều khoản sử dụng', 'Các điều kiện khi truy cập, đăng ký và sử dụng dịch vụ Thợ Đến Ngay.', '<p>Khi sử dụng Thợ Đến Ngay, người dùng đồng ý cung cấp thông tin chính xác, tuân thủ quy trình đặt dịch vụ và thanh toán các chi phí đã được xác nhận.</p><p>Nền tảng có quyền cập nhật điều khoản để phù hợp với vận hành thực tế và quy định pháp luật.</p>', TRUE, 20, NOW()),
  ('chinh-sach-bao-mat', 'Chính sách bảo mật', 'Cách Thợ Đến Ngay thu thập, sử dụng và bảo vệ thông tin cá nhân.', '<p>Thợ Đến Ngay chỉ thu thập thông tin cần thiết để cung cấp dịch vụ, xác thực tài khoản, điều phối thợ và chăm sóc khách hàng.</p><p>Thông tin cá nhân được bảo vệ bằng các biện pháp phù hợp và chỉ chia sẻ trong phạm vi cần thiết cho việc thực hiện dịch vụ hoặc theo yêu cầu pháp luật.</p>', TRUE, 30, NOW()),
  ('chinh-sach-danh-cho-tho', 'Chính sách dành cho thợ', 'Quy định tham gia, nhận việc, chất lượng dịch vụ và trách nhiệm của thợ.', '<p>Thợ tham gia nền tảng cần cung cấp hồ sơ chính xác, nhận việc đúng khả năng chuyên môn và thực hiện dịch vụ với thái độ chuyên nghiệp.</p><p>Thợ có trách nhiệm báo giá rõ ràng, cập nhật trạng thái công việc và tuân thủ quy chuẩn an toàn trong quá trình thi công.</p>', TRUE, 40, NOW()),
  ('chinh-sach-danh-cho-khach-hang', 'Chính sách dành cho khách hàng', 'Quyền lợi, trách nhiệm và hướng dẫn sử dụng dịch vụ cho khách hàng.', '<p>Khách hàng có quyền nhận thông tin dịch vụ, chi phí dự kiến và trạng thái xử lý công việc một cách minh bạch.</p><p>Khách hàng cần cung cấp địa chỉ, mô tả sự cố và thông tin liên hệ chính xác để quá trình điều phối được nhanh chóng.</p>', TRUE, 50, NOW()),
  ('quy-che-hoat-dong', 'Quy chế hoạt động', 'Nguyên tắc vận hành, điều phối dịch vụ và xử lý phát sinh trên nền tảng.', '<p>Thợ Đến Ngay vận hành theo mô hình kết nối nhu cầu sửa chữa của khách hàng với đội ngũ thợ phù hợp theo khu vực, chuyên môn và trạng thái sẵn sàng.</p><p>Các phát sinh trong quá trình sử dụng dịch vụ sẽ được ghi nhận, xác minh và xử lý dựa trên dữ liệu công việc, trao đổi giữa các bên và quy định hiện hành.</p>', TRUE, 60, NOW()),
  ('lien-he', 'Liên hệ', 'Thông tin liên hệ và kênh hỗ trợ chính thức của Thợ Đến Ngay.', '<p>Đội ngũ Thợ Đến Ngay luôn sẵn sàng tiếp nhận phản hồi, hỗ trợ tài khoản và xử lý các vấn đề phát sinh trong quá trình sử dụng dịch vụ.</p><p>Vui lòng liên hệ qua hotline, email hỗ trợ hoặc các kênh chính thức được công bố trên ứng dụng.</p>', TRUE, 70, NOW())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content_html = CASE
    WHEN public.cms_posts.content_html = '' THEN EXCLUDED.content_html
    ELSE public.cms_posts.content_html
  END,
  is_published = TRUE,
  sort_order = EXCLUDED.sort_order,
  published_at = COALESCE(public.cms_posts.published_at, NOW());
