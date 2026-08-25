-- Journey posts for public /hanh-trinh pages and Admin management

BEGIN;

-- ===== JOURNEY POSTS =====
CREATE TABLE IF NOT EXISTS public.journey_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journey_posts_public_order_idx
  ON public.journey_posts (status, sort_order, created_at);
CREATE INDEX IF NOT EXISTS journey_posts_slug_idx
  ON public.journey_posts (slug);

ALTER TABLE public.journey_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_view_published_journey_posts ON public.journey_posts;
CREATE POLICY public_view_published_journey_posts ON public.journey_posts FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS admins_view_all_journey_posts ON public.journey_posts;
CREATE POLICY admins_view_all_journey_posts ON public.journey_posts FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS admins_create_journey_posts ON public.journey_posts;
CREATE POLICY admins_create_journey_posts ON public.journey_posts FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS admins_update_journey_posts ON public.journey_posts;
CREATE POLICY admins_update_journey_posts ON public.journey_posts FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS admins_delete_journey_posts ON public.journey_posts;
CREATE POLICY admins_delete_journey_posts ON public.journey_posts FOR DELETE USING (public.is_admin());

DROP TRIGGER IF EXISTS update_journey_posts_updated_at ON public.journey_posts;
CREATE TRIGGER update_journey_posts_updated_at BEFORE UPDATE ON public.journey_posts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

INSERT INTO public.journey_posts (title, slug, summary, content, sort_order, status)
VALUES
  ('2026 – Xây dựng nền tảng', '2026-xay-dung-nen-tang', 'Giai đoạn đặt nền móng cho hệ sinh thái Thợ Đến Ngay, chuẩn hóa vận hành và trải nghiệm cốt lõi.', '<h2>Đang chờ nội dung chính thức</h2><p>Nội dung chi tiết cho chặng 2026 sẽ được cập nhật theo bản người quản trị gửi sau. Bài viết này đang đóng vai trò khung ban đầu để hệ thống Hành trình có thể vận hành bằng Admin.</p><ul><li>Xây dựng nền tảng đặt dịch vụ và điều phối thợ.</li><li>Chuẩn hóa tài khoản khách hàng, thợ và quản trị.</li><li>Hoàn thiện các dữ liệu vận hành cần thiết.</li></ul>', 10, 'published'),
  ('Đang phát triển', 'dang-phat-trien', 'Các hạng mục đang được hoàn thiện để giúp khách hàng và thợ làm việc nhanh, rõ ràng hơn.', '<h2>Những phần đang phát triển</h2><p>Thợ Đến Ngay đang tiếp tục hoàn thiện trải nghiệm đặt dịch vụ, quản lý công việc, chăm sóc khách hàng và các công cụ hỗ trợ thợ trong quá trình nhận việc.</p><ul><li>Tối ưu luồng điều phối và nhận việc.</li><li>Nâng cấp quản lý khách hàng và lịch sử dịch vụ.</li><li>Cải thiện hiệu năng và trải nghiệm trên di động.</li></ul>', 20, 'published'),
  ('Kế hoạch tiếp theo', 'ke-hoach-tiep-theo', 'Những bước tiếp theo tập trung vào độ ổn định, dữ liệu vận hành và mở rộng dịch vụ.', '<h2>Định hướng gần hạn</h2><p>Giai đoạn tiếp theo ưu tiên các tính năng giúp nền tảng vận hành ổn định hơn, dễ đo lường hơn và tạo thêm giá trị cho cả khách hàng lẫn đội ngũ thợ.</p><ul><li>Mở rộng nhóm dịch vụ và danh mục báo giá.</li><li>Hoàn thiện báo cáo vận hành theo thời gian thực.</li><li>Tăng cường kiểm soát chất lượng dịch vụ.</li></ul>', 30, 'published'),
  ('Tầm nhìn dài hạn', 'tam-nhin-dai-han', 'Xây dựng một mạng lưới thợ dịch vụ đáng tin cậy, minh bạch và gần khách hàng hơn.', '<h2>Tầm nhìn</h2><p>Thợ Đến Ngay hướng tới việc trở thành nền tảng kết nối dịch vụ tại nhà đáng tin cậy, nơi khách hàng dễ tìm được thợ phù hợp và thợ có thêm công cụ để phát triển nghề nghiệp bền vững.</p><ul><li>Minh bạch về chất lượng và lịch sử dịch vụ.</li><li>Hỗ trợ thợ phát triển hồ sơ nghề nghiệp.</li><li>Đưa dịch vụ sửa chữa đến gần người dùng hơn.</li></ul>', 40, 'published'),
  ('Hợp tác cùng Thợ Đến Ngay', 'hop-tac-cung-tho-den-ngay', 'Cơ hội hợp tác cho thợ, đơn vị dịch vụ và đối tác muốn cùng mở rộng hệ sinh thái.', '<h2>Cùng xây dựng mạng lưới dịch vụ</h2><p>Thợ Đến Ngay luôn chào đón các thợ chuyên nghiệp, đội nhóm dịch vụ và đối tác địa phương cùng tham gia xây dựng hệ sinh thái dịch vụ tại nhà nhanh, rõ ràng và uy tín.</p><ul><li>Thợ có thể mở rộng nguồn việc và hồ sơ uy tín.</li><li>Đối tác địa phương có thêm kênh tiếp cận khách hàng.</li><li>Khách hàng được phục vụ bởi mạng lưới được quản lý tốt hơn.</li></ul>', 50, 'published')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
