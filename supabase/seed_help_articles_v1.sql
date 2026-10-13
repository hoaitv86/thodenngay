-- Help Center V1 draft seed for Tho Den Ngay.
-- Safe/idempotent: inserts only missing categories/articles and never updates existing rows.
-- Run in Supabase SQL editor or psql after supabase/migration_help_center.sql exists.

BEGIN;

WITH seed_categories(slug, title, description, icon, sort_order) AS (
  VALUES
    ('bat-dau-tai-khoan', 'Bắt đầu & tài khoản', 'Đăng nhập, chuyển vai trò, hồ sơ và thiết lập cơ bản.', 'user', 10),
    ('dat-lich-cong-viec', 'Đặt lịch & công việc', 'Luồng đặt dịch vụ, theo dõi job, lịch sử và nghiệm thu.', 'briefcase', 20),
    ('chat-thong-bao', 'Chat & thông báo', 'Trao đổi giữa người dùng, thợ và admin; cài đặt nhận tin.', 'message-circle', 30),
    ('cua-hang-doi-nhom', 'Cửa hàng & đội nhóm', 'Quản lý đơn vị thợ, vai trò nhân sự và dữ liệu cửa hàng.', 'users', 40),
    ('billgo', 'BillGo', 'Thu cước, công nợ, biên nhận và chu kỳ thanh toán.', 'credit-card', 50),
    ('kho-ban-hang', 'Kho hàng & bán hàng', 'Sản phẩm, tồn kho, nhập hàng, bán hàng và bảo hành.', 'package', 60),
    ('admin-cms', 'Admin & CMS', 'Quản trị hệ thống, nội dung, hướng dẫn và phân quyền.', 'settings', 70)
)
INSERT INTO public.help_categories (slug, title, description, icon, sort_order, is_active)
SELECT slug, title, description, icon, sort_order, TRUE
FROM seed_categories
WHERE NOT EXISTS (
  SELECT 1 FROM public.help_categories existing
  WHERE existing.slug = seed_categories.slug
);

WITH seed_articles(primary_group, help_context, category_slug, slug, title, description, content_html, sort_order, audiences, is_featured) AS (
  VALUES
    (
      'customer',
      'help-v1-customer-dang-ky-dang-nhap',
      'bat-dau-tai-khoan',
      'khach-hang-dang-ky-dang-nhap',
      'Khách hàng: đăng ký, đăng nhập và dùng tài khoản demo',
      'Các cách vào tài khoản khách hàng hiện có trên màn hình đăng nhập.',
      $html$
<h2>Giới thiệu</h2>
<p>Bài này hướng dẫn khách hàng bắt đầu với Thợ Đến Ngay bằng tài khoản thật hoặc nút trải nghiệm demo đang có trên trang đăng nhập.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Mở trang <strong>Đăng nhập</strong>.</li><li>Nếu đã có tài khoản, nhập thông tin đăng nhập rồi vào khu vực khách hàng.</li><li>Nếu muốn thử nhanh, dùng nút <strong>Trải nghiệm với Khách hàng</strong>.</li><li>Nếu chưa có tài khoản, chọn liên kết <strong>Đăng ký</strong>.</li><li>Sau khi vào app, kiểm tra tên, số điện thoại và địa chỉ trong hồ sơ.</li></ol>
<h2>Lưu ý</h2>
<p>Tài khoản demo chỉ để xem luồng mẫu. Thông tin đặt lịch thật nên dùng tài khoản chính của khách hàng.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp màn hình trang đăng nhập, nút trải nghiệm khách hàng và liên kết đăng ký.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán URL YouTube vào trường YouTube URL trong Admin khi có video.</p>
$html$,
      1010,
      ARRAY['PUBLIC','CUSTOMER']::TEXT[],
      TRUE
    ),
    (
      'customer',
      'help-v1-customer-dat-dich-vu',
      'dat-lich-cong-viec',
      'khach-hang-dat-dich-vu',
      'Khách hàng: đặt dịch vụ sửa chữa',
      'Cách tạo yêu cầu dịch vụ từ khu vực khách hàng hoặc trang đặt lịch.',
      $html$
<h2>Giới thiệu</h2>
<p>Khách hàng có thể tạo yêu cầu dịch vụ từ màn hình đặt lịch. Hệ thống lưu thông tin khách, địa chỉ, dịch vụ và mô tả để admin hoặc thợ xử lý.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào khu vực <strong>Khách hàng</strong> rồi chọn đặt dịch vụ.</li><li>Chọn nhóm dịch vụ phù hợp trong danh mục đang hiển thị.</li><li>Nhập mô tả tình trạng, địa chỉ và số điện thoại liên hệ.</li><li>Kiểm tra lại thông tin trước khi gửi yêu cầu.</li><li>Theo dõi trạng thái trong danh sách đơn dịch vụ.</li></ol>
<h2>Lưu ý</h2>
<p>Chỉ mô tả đúng nhu cầu thực tế. Nếu cần thay đổi thông tin sau khi gửi, hãy dùng chat hoặc liên hệ hỗ trợ theo thông tin trong hồ sơ.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp màn hình form đặt dịch vụ, phần chọn danh mục và trạng thái sau khi gửi.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video hướng dẫn đặt dịch vụ vào trường YouTube URL.</p>
$html$,
      1020,
      ARRAY['CUSTOMER']::TEXT[],
      TRUE
    ),
    (
      'customer',
      'help-v1-customer-theo-doi-don',
      'dat-lich-cong-viec',
      'khach-hang-theo-doi-don-dich-vu',
      'Khách hàng: theo dõi đơn dịch vụ',
      'Xem danh sách job, trạng thái xử lý và chi tiết đơn của chính khách hàng.',
      $html$
<h2>Giới thiệu</h2>
<p>Trang đơn dịch vụ giúp khách hàng xem các yêu cầu đã tạo, trạng thái hiện tại và thông tin liên quan đến thợ được phân công nếu đã có.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Đơn dịch vụ</strong> trong khu vực khách hàng.</li><li>Mở đơn cần kiểm tra để xem chi tiết.</li><li>Đọc trạng thái đang hiển thị như chờ xử lý, đã phân công hoặc đang thực hiện.</li><li>Nếu cần trao đổi, dùng kênh chat liên quan đến đơn.</li><li>Sau khi công việc hoàn tất, kiểm tra lại lịch sử trong hồ sơ.</li></ol>
<h2>Lưu ý</h2>
<p>Khách hàng chỉ xem được đơn của chính mình theo phân quyền hiện có. Không tự ý tạo đơn trùng nếu đơn cũ vẫn đang xử lý.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách đơn và màn hình chi tiết một đơn.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video hướng dẫn theo dõi đơn vào trường YouTube URL.</p>
$html$,
      1030,
      ARRAY['CUSTOMER']::TEXT[],
      FALSE
    ),
    (
      'customer',
      'help-v1-customer-cap-nhat-ho-so-gps',
      'bat-dau-tai-khoan',
      'khach-hang-cap-nhat-ho-so-va-vi-tri',
      'Khách hàng: cập nhật hồ sơ và vị trí',
      'Cập nhật tên, điện thoại, địa chỉ và tọa độ GPS trong hồ sơ khách hàng.',
      $html$
<h2>Giới thiệu</h2>
<p>Hồ sơ khách hàng đang hỗ trợ thông tin cá nhân, số điện thoại, địa chỉ, ảnh đại diện và vị trí GPS để việc liên hệ, tìm đường thuận tiện hơn.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Hồ sơ</strong> trong khu vực khách hàng.</li><li>Chọn chỉnh sửa thông tin cá nhân.</li><li>Cập nhật họ tên, số điện thoại và địa chỉ.</li><li>Dùng nút cập nhật vị trí nếu muốn lưu tọa độ GPS từ thiết bị.</li><li>Lưu thay đổi và kiểm tra lại thông tin vừa cập nhật.</li></ol>
<h2>Lưu ý</h2>
<p>Trình duyệt hoặc điện thoại có thể hỏi quyền truy cập vị trí. Nếu từ chối, hệ thống vẫn dùng địa chỉ nhập tay.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp phần thông tin cá nhân, nút cập nhật GPS và trạng thái sau khi lưu.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video cập nhật hồ sơ vào trường YouTube URL.</p>
$html$,
      1040,
      ARRAY['CUSTOMER']::TEXT[],
      FALSE
    ),
    (
      'customer',
      'help-v1-customer-chat-ho-tro',
      'chat-thong-bao',
      'khach-hang-chat-voi-tho-hoac-admin',
      'Khách hàng: chat với thợ hoặc admin',
      'Sử dụng khu vực chat để trao đổi về đơn dịch vụ và hỗ trợ.',
      $html$
<h2>Giới thiệu</h2>
<p>Khách hàng có trang chat riêng để trao đổi trong phạm vi tài khoản. Khi database chat chưa sẵn sàng, giao diện có thông báo chế độ tạm theo trình duyệt.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào mục <strong>Chat</strong> trong khu vực khách hàng.</li><li>Chọn cuộc trò chuyện liên quan nếu có danh sách hiển thị.</li><li>Nhập nội dung cần trao đổi rõ ràng, kèm mã đơn nếu cần.</li><li>Gửi tin nhắn và chờ phản hồi.</li><li>Quay lại đơn dịch vụ để kiểm tra trạng thái sau khi trao đổi.</li></ol>
<h2>Lưu ý</h2>
<p>Không gửi thông tin nhạy cảm không cần thiết. Nếu chat tạm đang được hiển thị, admin cần chạy migration chat để dùng chat thật giữa nhiều tài khoản.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp trang chat, ô nhập tin nhắn và thông báo trạng thái chat nếu có.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video hướng dẫn chat vào trường YouTube URL.</p>
$html$,
      1050,
      ARRAY['CUSTOMER']::TEXT[],
      FALSE
    ),
    (
      'customer',
      'help-v1-customer-thong-bao',
      'chat-thong-bao',
      'khach-hang-xem-va-cai-dat-thong-bao',
      'Khách hàng: xem và cài đặt thông báo',
      'Xem thông báo về thợ nhận việc, đang đến, đã đến và tùy chỉnh nhận tin.',
      $html$
<h2>Giới thiệu</h2>
<p>Trang thông báo của khách hàng hiển thị các tin liên quan đến công việc và có phần cài đặt như âm thanh, rung, khung giờ không làm phiền.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Thông báo</strong> từ khu vực khách hàng.</li><li>Xem các nhóm thông báo như thợ đã nhận việc, đang đến hoặc đã đến.</li><li>Mở thông báo để đi tới màn hình liên quan nếu có liên kết.</li><li>Điều chỉnh cài đặt nhận thông báo theo nhu cầu.</li><li>Lưu cài đặt sau khi thay đổi.</li></ol>
<h2>Lưu ý</h2>
<p>Một số thông báo phụ thuộc vào quyền trình duyệt hoặc thiết bị. Nếu không nhận được, hãy kiểm tra quyền thông báo của trình duyệt.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách thông báo và phần cài đặt thông báo.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video hướng dẫn thông báo vào trường YouTube URL.</p>
$html$,
      1060,
      ARRAY['CUSTOMER']::TEXT[],
      FALSE
    ),
    (
      'customer',
      'help-v1-customer-billgo-cong-no',
      'billgo',
      'khach-hang-xem-cong-no-billgo',
      'Khách hàng: xem công nợ BillGo trong hồ sơ',
      'Theo dõi khoản phải thu, đã thu và còn nợ BillGo hiển thị cho khách hàng.',
      $html$
<h2>Giới thiệu</h2>
<p>Hồ sơ khách hàng có phần BillGo để xem các khoản phải thu, tiền đã thanh toán và khoản còn nợ khi dữ liệu BillGo được ghi nhận.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Hồ sơ</strong> trong khu vực khách hàng.</li><li>Mở phần BillGo hoặc công nợ nếu có dữ liệu.</li><li>Kiểm tra tổng phải thu, đã thu và còn nợ.</li><li>Mở từng khoản để xem gói cước, kỳ hạn và lịch sử thanh toán.</li><li>Nếu số liệu chưa đúng, liên hệ cửa hàng hoặc admin để kiểm tra.</li></ol>
<h2>Lưu ý</h2>
<p>Khách hàng chỉ xem dữ liệu của chính mình. Biên nhận công khai dùng đường dẫn riêng nếu hệ thống đã tạo mã biên nhận.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp phần BillGo trong hồ sơ và một khoản công nợ mẫu.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video hướng dẫn xem BillGo vào trường YouTube URL.</p>
$html$,
      1070,
      ARRAY['CUSTOMER']::TEXT[],
      FALSE
    ),
    (
      'customer',
      'help-v1-public-dang-ky-lam-tho',
      'bat-dau-tai-khoan',
      'dang-ky-lam-tho-tu-tai-khoan-khach',
      'Đăng ký làm thợ từ tài khoản khách hàng',
      'Gửi hồ sơ thợ từ trang hồ sơ khách hàng và chờ admin duyệt.',
      $html$
<h2>Giới thiệu</h2>
<p>Bài này có thể công khai sau khi xuất bản. Tính năng hiện có cho phép khách hàng gửi hồ sơ đăng ký làm thợ từ trang hồ sơ; admin sẽ duyệt trước khi tài khoản nhận việc.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Đăng nhập tài khoản khách hàng.</li><li>Vào <strong>Hồ sơ</strong> và tìm thẻ <strong>Đăng ký làm thợ</strong>.</li><li>Chọn chuyên môn phù hợp trong danh sách hiển thị.</li><li>Gửi hồ sơ đăng ký.</li><li>Chờ trạng thái được admin duyệt. Khi đã hoạt động, nút <strong>Chế độ Thợ</strong> sẽ đưa bạn sang khu vực thợ.</li></ol>
<h2>Lưu ý</h2>
<p>Hồ sơ có thể ở trạng thái chờ duyệt, hoạt động hoặc bị khóa/từ chối. Chỉ tài khoản đã được duyệt mới nhận việc trong khu vực thợ.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp thẻ Đăng ký làm thợ, lựa chọn chuyên môn và trạng thái sau khi gửi.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video hướng dẫn đăng ký làm thợ vào trường YouTube URL.</p>
$html$,
      1080,
      ARRAY['PUBLIC','CUSTOMER']::TEXT[],
      TRUE
    )
)
INSERT INTO public.help_articles (
  category_id,
  slug,
  title,
  description,
  content_html,
  cover_image_url,
  image_urls,
  video_url,
  sort_order,
  status,
  is_featured,
  audiences,
  help_context,
  published_at
)
SELECT
  category.id,
  article.slug,
  article.title,
  article.description,
  article.content_html,
  NULL,
  ARRAY[]::TEXT[],
  NULL,
  article.sort_order,
  'draft',
  article.is_featured,
  article.audiences,
  article.help_context,
  NULL
FROM seed_articles article
LEFT JOIN public.help_categories category ON category.slug = article.category_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.help_articles existing
  WHERE existing.help_context = article.help_context
     OR existing.slug = article.slug
);

COMMIT;

SELECT 'customer' AS help_v1_group, COUNT(*) AS seeded_or_existing
FROM public.help_articles
WHERE help_context LIKE 'help-v1-customer-%'
   OR help_context = 'help-v1-public-dang-ky-lam-tho';
