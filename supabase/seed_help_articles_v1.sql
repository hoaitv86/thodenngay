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

BEGIN;

WITH seed_articles(primary_group, help_context, category_slug, slug, title, description, content_html, sort_order, audiences, is_featured) AS (
  VALUES
    (
      'worker',
      'help-v1-worker-chuyen-che-do-online',
      'bat-dau-tai-khoan',
      'tho-chuyen-che-do-va-trang-thai-online',
      'Thợ: chuyển chế độ và trạng thái online',
      'Cách vào khu vực thợ, chuyển lại khách hàng và bật/tắt trạng thái online.',
      $html$
<h2>Giới thiệu</h2>
<p>Khi tài khoản thợ đã được duyệt, giao diện thợ có nút chuyển sang chế độ khách hàng và trạng thái online/offline ngay trên đầu trang.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Đăng nhập bằng tài khoản đã được duyệt làm thợ.</li><li>Vào khu vực <strong>Thợ</strong> hoặc dùng nút <strong>Chế độ Thợ</strong> nếu đang ở hồ sơ khách hàng.</li><li>Trên trang thợ, kiểm tra trạng thái <strong>Đang online</strong> hoặc <strong>Đang offline</strong>.</li><li>Bấm trạng thái để yêu cầu đổi online/offline.</li><li>Nếu cần quay lại đặt dịch vụ như khách hàng, chọn <strong>Chế độ Khách hàng</strong>.</li></ol>
<h2>Lưu ý</h2>
<p>Trạng thái online hỗ trợ điều phối công việc, nhưng tài khoản vẫn phải ở trạng thái active trong hồ sơ thợ.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp header trang thợ, trạng thái online/offline và nút Chế độ Khách hàng.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video chuyển chế độ thợ vào trường YouTube URL.</p>
$html$,
      2010,
      ARRAY['WORKER']::TEXT[],
      TRUE
    ),
    (
      'worker',
      'help-v1-worker-trang-chu-tao-viec-nhanh',
      'dat-lich-cong-viec',
      'tho-trang-chu-va-tao-viec-nhanh',
      'Thợ: trang chủ và tạo việc nhanh',
      'Dùng trang chủ thợ, nút tạo việc trên mobile và khu vực quick job nếu có quyền.',
      $html$
<h2>Giới thiệu</h2>
<p>Trang chủ thợ là điểm vào chính để xem thông tin nhanh và mở khu vực tạo việc nhanh. Trên mobile, nút tạo việc nằm ở thanh điều hướng dưới.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Trang chủ</strong> trong khu vực thợ.</li><li>Nếu dùng điện thoại, bấm nút dấu cộng <strong>Tạo việc</strong> ở thanh dưới.</li><li>Điền thông tin khách, dịch vụ và mô tả theo form đang hiển thị.</li><li>Kiểm tra dữ liệu trước khi lưu.</li><li>Sau khi tạo, theo dõi việc trong danh sách việc của thợ.</li></ol>
<h2>Lưu ý</h2>
<p>Menu tạo việc chỉ hiển thị cho các vai trò thợ kỹ thuật, quản lý hoặc chủ đơn vị theo registry hiện có.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp trang chủ thợ, nút Tạo việc trên mobile và form quick job.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video tạo việc nhanh vào trường YouTube URL.</p>
$html$,
      2020,
      ARRAY['WORKER']::TEXT[],
      TRUE
    ),
    (
      'worker',
      'help-v1-worker-danh-sach-viec',
      'dat-lich-cong-viec',
      'tho-xem-ton-viec-va-viec-cua-toi',
      'Thợ: xem tồn việc và việc của tôi',
      'Theo dõi danh sách việc trong menu thợ và mở chi tiết khi cần xử lý.',
      $html$
<h2>Giới thiệu</h2>
<p>Menu thợ có mục <strong>Tồn việc</strong> hoặc <strong>Việc của tôi</strong> trên mobile để theo dõi các công việc liên quan đến tài khoản.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Tồn việc</strong> hoặc <strong>Việc của tôi</strong>.</li><li>Lọc hoặc tìm công việc nếu giao diện đang có bộ lọc.</li><li>Mở công việc cần xử lý.</li><li>Kiểm tra khách hàng, dịch vụ, trạng thái và ghi chú.</li><li>Cập nhật theo đúng các nút hành động đang có trên màn hình.</li></ol>
<h2>Lưu ý</h2>
<p>Thợ chỉ thấy dữ liệu được phân quyền theo tài khoản hoặc đơn vị. Không tự ý thao tác ngoài quy trình hiển thị trong màn hình.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách việc và màn hình chi tiết công việc.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video theo dõi việc vào trường YouTube URL.</p>
$html$,
      2030,
      ARRAY['WORKER']::TEXT[],
      FALSE
    ),
    (
      'worker',
      'help-v1-worker-hoan-thanh-viec',
      'dat-lich-cong-viec',
      'tho-cap-nhat-va-hoan-thanh-cong-viec',
      'Thợ: cập nhật và hoàn thành công việc',
      'Các điểm cần kiểm tra trước khi cập nhật trạng thái hoặc hoàn tất job.',
      $html$
<h2>Giới thiệu</h2>
<p>Các màn hình công việc của thợ cho phép xử lý theo trạng thái và dữ liệu job. Một số luồng có phần nghiệm thu, vật tư hoặc đính kèm tùy cấu hình migration đã chạy.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Mở chi tiết công việc từ danh sách việc.</li><li>Đọc kỹ thông tin khách hàng, địa chỉ, dịch vụ và ghi chú.</li><li>Thực hiện các nút cập nhật trạng thái đang có trên màn hình.</li><li>Nếu có form hoàn thành, nhập thông tin thực tế và kiểm tra trước khi gửi.</li><li>Sau khi hoàn tất, xem lại trong lịch sử công việc.</li></ol>
<h2>Lưu ý</h2>
<p>Không bịa thêm vật tư, chi phí hoặc bước nghiệm thu nếu form hiện tại không yêu cầu. Luôn nhập theo dữ liệu thật tại hiện trường.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp chi tiết công việc, nút trạng thái và form hoàn thành nếu có.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video xử lý công việc vào trường YouTube URL.</p>
$html$,
      2040,
      ARRAY['WORKER']::TEXT[],
      FALSE
    ),
    (
      'worker',
      'help-v1-worker-lich-su',
      'dat-lich-cong-viec',
      'tho-xem-lich-su-cong-viec',
      'Thợ: xem lịch sử công việc',
      'Dùng mục Lịch sử để tra lại công việc đã xử lý.',
      $html$
<h2>Giới thiệu</h2>
<p>Mục <strong>Lịch sử</strong> trong menu thợ giúp tra lại các công việc đã có dữ liệu lịch sử theo quyền của tài khoản.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Lịch sử</strong> trong menu thợ.</li><li>Xem danh sách các công việc đã ghi nhận.</li><li>Mở một dòng để xem chi tiết nếu màn hình cho phép.</li><li>Đối chiếu thông tin khách, dịch vụ và trạng thái.</li><li>Quay lại danh sách để tiếp tục tra cứu.</li></ol>
<h2>Lưu ý</h2>
<p>Lịch sử dùng để tra cứu, không thay thế quy trình cập nhật job đang mở.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách lịch sử và một chi tiết lịch sử.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video tra cứu lịch sử vào trường YouTube URL.</p>
$html$,
      2050,
      ARRAY['WORKER']::TEXT[],
      FALSE
    ),
    (
      'worker',
      'help-v1-worker-khach-hang',
      'dat-lich-cong-viec',
      'tho-quan-ly-khach-hang',
      'Thợ: xem khách hàng liên quan',
      'Dùng mục Khách hàng trong khu vực thợ để tra cứu khách theo quyền.',
      $html$
<h2>Giới thiệu</h2>
<p>Menu thợ có mục <strong>Khách hàng</strong> cho các vai trò được hiển thị. Dữ liệu khách hàng phụ thuộc vào job hoặc đơn vị mà tài khoản được phép xem.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Khách hàng</strong> trong menu thợ.</li><li>Tìm khách theo thông tin đang có trên màn hình.</li><li>Mở khách cần kiểm tra nếu giao diện hỗ trợ chi tiết.</li><li>Đối chiếu lịch sử, địa chỉ hoặc thông tin liên hệ trước khi tạo/cập nhật việc.</li><li>Dùng chat hoặc gọi theo thông tin được phép khi cần trao đổi.</li></ol>
<h2>Lưu ý</h2>
<p>Không sao chép dữ liệu khách hàng ra ngoài hệ thống nếu không cần thiết cho công việc.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp mục Khách hàng trong menu và danh sách khách.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video tra cứu khách hàng vào trường YouTube URL.</p>
$html$,
      2060,
      ARRAY['WORKER']::TEXT[],
      FALSE
    ),
    (
      'worker',
      'help-v1-worker-chat',
      'chat-thong-bao',
      'tho-su-dung-chat',
      'Thợ: sử dụng chat',
      'Trao đổi với khách hàng hoặc admin từ khu vực thợ.',
      $html$
<h2>Giới thiệu</h2>
<p>Thợ có mục <strong>Chat</strong> trong menu khi vai trò được phép. Chat dùng để trao đổi về công việc và hỗ trợ vận hành.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Chat</strong> trong khu vực thợ.</li><li>Chọn cuộc trò chuyện hoặc đối tượng đang hiển thị.</li><li>Nhập nội dung ngắn gọn, gắn với mã việc nếu cần.</li><li>Gửi tin nhắn và theo dõi phản hồi.</li><li>Quay lại job để cập nhật trạng thái nếu trao đổi dẫn đến thay đổi công việc.</li></ol>
<h2>Lưu ý</h2>
<p>Super Admin chỉ được mô tả trong code là xem/kiểm tra chat, không tạo đối tượng chat riêng như người dùng thường.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp màn hình danh sách chat và khung nhập tin nhắn.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video sử dụng chat vào trường YouTube URL.</p>
$html$,
      2070,
      ARRAY['WORKER']::TEXT[],
      FALSE
    ),
    (
      'worker',
      'help-v1-worker-thong-bao',
      'chat-thong-bao',
      'tho-xem-thong-bao-va-cai-dat',
      'Thợ: xem thông báo và cài đặt',
      'Xem tin mới, việc cần làm và vào trang cài đặt thông báo của thợ.',
      $html$
<h2>Giới thiệu</h2>
<p>Header thợ có biểu tượng thông báo. Danh sách thông báo hiển thị tin mới và có liên kết tới trang cài đặt thông báo của thợ.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Bấm biểu tượng chuông trên header thợ.</li><li>Đọc các thông báo chưa xem trong danh sách.</li><li>Bấm thông báo có liên kết để đi tới màn hình liên quan.</li><li>Chọn <strong>Cài đặt</strong> nếu muốn mở trang thông báo của thợ.</li><li>Đóng hộp thông báo sau khi xem xong.</li></ol>
<h2>Lưu ý</h2>
<p>Thông báo có thể được đánh dấu đã đọc khi mở danh sách. Nếu offline hoặc tài khoản chưa active, danh sách có thể trống.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp biểu tượng chuông, popup thông báo và trang cài đặt.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video quản lý thông báo vào trường YouTube URL.</p>
$html$,
      2080,
      ARRAY['WORKER']::TEXT[],
      FALSE
    ),
    (
      'worker',
      'help-v1-worker-ho-so',
      'bat-dau-tai-khoan',
      'tho-cap-nhat-ho-so',
      'Thợ: cập nhật hồ sơ cá nhân',
      'Kiểm tra thông tin thợ, chuyên môn và trạng thái tài khoản.',
      $html$
<h2>Giới thiệu</h2>
<p>Mục <strong>Hồ sơ</strong> trong khu vực thợ dùng để xem và cập nhật thông tin cá nhân, trạng thái tài khoản và các thông tin liên quan đến thợ.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Hồ sơ</strong> trong menu thợ.</li><li>Kiểm tra họ tên, số điện thoại, địa chỉ và thông tin hiển thị.</li><li>Cập nhật những trường màn hình cho phép chỉnh sửa.</li><li>Kiểm tra trạng thái hồ sơ thợ nếu có.</li><li>Lưu thay đổi rồi quay lại trang chủ thợ.</li></ol>
<h2>Lưu ý</h2>
<p>Việc duyệt, khóa hoặc reset mật khẩu thợ thuộc quyền admin trong màn hình Quản lý Thợ.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp trang hồ sơ thợ và phần thông tin có thể chỉnh sửa.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video cập nhật hồ sơ thợ vào trường YouTube URL.</p>
$html$,
      2090,
      ARRAY['WORKER']::TEXT[],
      FALSE
    ),
    (
      'worker',
      'help-v1-worker-billgo-thu-cuoc',
      'billgo',
      'tho-su-dung-billgo-thu-cuoc',
      'Thợ: sử dụng BillGo thu cước',
      'Truy cập BillGo khi tài khoản có chuyên môn Internet/WiFi hoặc quyền liên quan.',
      $html$
<h2>Giới thiệu</h2>
<p>Menu <strong>Thu Cước</strong> xuất hiện khi tính năng BillGo được bật theo logic hiện có. BillGo phục vụ quản lý công nợ, gói cước và thanh toán.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Thu Cước</strong> trong khu vực thợ nếu menu đang hiển thị.</li><li>Xem danh sách khách hoặc khoản thu theo màn hình hiện tại.</li><li>Mở một khoản để kiểm tra kỳ hạn, số tiền và trạng thái.</li><li>Ghi nhận thanh toán hoặc cập nhật dữ liệu theo nút đang có trên màn hình.</li><li>Kiểm tra lại biên nhận hoặc trạng thái sau khi thao tác.</li></ol>
<h2>Lưu ý</h2>
<p>BillGo chỉ nên dùng cho dữ liệu thu cước thật. Nếu menu không hiển thị, kiểm tra chuyên môn hoặc quyền đơn vị với quản lý/admin.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp menu Thu Cước, danh sách khoản thu và màn hình chi tiết thanh toán.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video BillGo thợ vào trường YouTube URL.</p>
$html$,
      2100,
      ARRAY['WORKER']::TEXT[],
      TRUE
    ),
    (
      'worker',
      'help-v1-worker-kho-ban-hang',
      'kho-ban-hang',
      'tho-kho-hang-va-ban-hang',
      'Thợ: kho hàng và bán hàng',
      'Dùng mục Kho hàng, phần bán hàng và sản phẩm khi menu được bật.',
      $html$
<h2>Giới thiệu</h2>
<p>Menu <strong>Kho hàng</strong> xuất hiện trong khu vực thợ và có thể chứa các phần sản phẩm, nhập hàng hoặc bán hàng tùy màn hình hiện tại.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Kho hàng</strong> trong khu vực thợ.</li><li>Xem danh sách sản phẩm hoặc tồn kho.</li><li>Dùng nút thêm/sửa nếu vai trò có quyền và màn hình đang hiển thị.</li><li>Với bán hàng, mở phần bán hàng trong kho nếu có tham số hoặc tab tương ứng.</li><li>Kiểm tra dữ liệu trước khi lưu để tránh sai tồn kho hoặc đơn bán.</li></ol>
<h2>Lưu ý</h2>
<p>Theo code hiện tại, inventory và sales được bật trong trạng thái module thợ; quyền dữ liệu vẫn phụ thuộc vai trò đơn vị và RLS.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách sản phẩm, form sản phẩm và phần bán hàng nếu có.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video kho/bán hàng vào trường YouTube URL.</p>
$html$,
      2110,
      ARRAY['WORKER']::TEXT[],
      FALSE
    ),
    (
      'worker',
      'help-v1-worker-vi-tho',
      'bat-dau-tai-khoan',
      'tho-vi-tho-sap-mo',
      'Thợ: ví thợ đang sắp mở',
      'Hiểu đúng trạng thái hiện tại của màn hình Ví thợ.',
      $html$
<h2>Giới thiệu</h2>
<p>Mục <strong>Ví</strong> trong menu thợ hiện hiển thị nội dung <strong>Sắp mở quản lý thu nhập</strong>. Vì vậy bài này chỉ hướng dẫn cách nhận biết trạng thái, không mô tả thao tác rút tiền chưa triển khai.</p>
<h2>Hướng dẫn từng bước</h2>
<ol><li>Vào <strong>Ví</strong> nếu menu hiển thị cho tài khoản của bạn.</li><li>Đọc thông báo sắp mở trên màn hình.</li><li>Không nhập yêu cầu rút tiền vì giao diện hiện chưa có form rút tiền thật.</li><li>Theo dõi thông báo từ admin khi tính năng được mở.</li><li>Quay lại trang chủ hoặc lịch sử để xem dữ liệu công việc hiện có.</li></ol>
<h2>Lưu ý</h2>
<p>Không hứa hẹn quy trình doanh thu, sao kê hoặc rút tiền trước khi màn hình được triển khai đầy đủ.</p>
<h2>Vị trí bổ sung ảnh</h2>
<p><strong>[Ảnh cần bổ sung]</strong> Chụp màn hình Ví thợ với thông báo sắp mở.</p>
<h2>Link YouTube</h2>
<p><strong>[Video cần bổ sung]</strong> Dán video giới thiệu khi tính năng ví đã hoàn thiện.</p>
$html$,
      2120,
      ARRAY['WORKER']::TEXT[],
      FALSE
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

SELECT 'worker' AS help_v1_group, COUNT(*) AS seeded_or_existing
FROM public.help_articles
WHERE help_context LIKE 'help-v1-worker-%';

BEGIN;

WITH seed_articles(primary_group, help_context, category_slug, slug, title, description, content_html, sort_order, audiences, is_featured) AS (
  VALUES
    ('manager','help-v1-manager-vai-tro-quan-ly','cua-hang-doi-nhom','quan-ly-cua-hang-vai-tro-va-menu','Quản lý cửa hàng: vai trò và menu được mở','Hiểu quyền manager trong đơn vị thợ và các menu thường thấy.',
$html$<h2>Giới thiệu</h2><p>Vai trò quản lý cửa hàng được xác định từ membership active trong <strong>worker_unit_members</strong>. Giao diện thợ sẽ mở thêm các mục phù hợp với role manager.</p><h2>Hướng dẫn từng bước</h2><ol><li>Đăng nhập tài khoản đã được thêm vào đơn vị.</li><li>Vào khu vực thợ và kiểm tra các mục Trang chủ, Khách hàng, Tồn việc, BillGo, Kho hàng, Chat, Lịch sử, Ví, Hồ sơ.</li><li>Nếu thiếu menu, kiểm tra lại trạng thái membership với chủ đơn vị hoặc admin.</li><li>Dùng dữ liệu trong phạm vi đơn vị được cấp quyền.</li><li>Không dùng tài khoản cá nhân khác để xử lý dữ liệu cửa hàng.</li></ol><h2>Lưu ý</h2><p>Manager có audience MANAGER trong Help Center; chủ cửa hàng cũng xem được bài manager vì owner được cộng cả WORKER và MANAGER.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp menu thợ của tài khoản manager.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video tổng quan role manager vào trường YouTube URL.</p>$html$,3010,ARRAY['MANAGER']::TEXT[],TRUE),
    ('manager','help-v1-manager-dieu-phoi-viec','dat-lich-cong-viec','quan-ly-cua-hang-dieu-phoi-va-theo-doi-viec','Quản lý cửa hàng: điều phối và theo dõi việc','Theo dõi tồn việc, khách hàng và tiến độ trong phạm vi đơn vị.',
$html$<h2>Giới thiệu</h2><p>Quản lý dùng các mục công việc trong khu vực thợ để xem tình hình xử lý của đơn vị khi dữ liệu được phân quyền.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Tồn việc</strong> hoặc trang chủ thợ.</li><li>Kiểm tra các việc đang mở, khách hàng và trạng thái.</li><li>Mở chi tiết việc cần theo dõi.</li><li>Trao đổi với thợ hoặc khách qua kênh chat nếu cần.</li><li>Sau khi hoàn tất, đối chiếu lại trong lịch sử.</li></ol><h2>Lưu ý</h2><p>Chỉ dùng các nút hành động thật đang có trên màn hình. Không ghi nhận thay đổi ngoài hệ thống rồi coi như đã cập nhật.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách tồn việc và chi tiết việc.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video điều phối việc vào trường YouTube URL.</p>$html$,3020,ARRAY['MANAGER']::TEXT[],FALSE),
    ('manager','help-v1-manager-khach-hang-doi-nhom','dat-lich-cong-viec','quan-ly-cua-hang-tra-cuu-khach-hang','Quản lý cửa hàng: tra cứu khách hàng của đơn vị','Dùng mục Khách hàng để hỗ trợ vận hành và chăm sóc khách.',
$html$<h2>Giới thiệu</h2><p>Mục Khách hàng trong khu vực thợ giúp quản lý kiểm tra dữ liệu khách liên quan đến công việc và đơn vị.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Khách hàng</strong>.</li><li>Tìm khách bằng thông tin đang có trên giao diện.</li><li>Mở dữ liệu liên quan nếu màn hình hỗ trợ.</li><li>Đối chiếu lịch sử việc hoặc công nợ trước khi hỗ trợ.</li><li>Ghi chú lại trong job/chat khi có trao đổi quan trọng.</li></ol><h2>Lưu ý</h2><p>Dữ liệu khách hàng chịu RLS; manager không nên thấy dữ liệu ngoài đơn vị mình.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách khách hàng của thợ/đơn vị.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video tra cứu khách hàng vào trường YouTube URL.</p>$html$,3030,ARRAY['MANAGER']::TEXT[],FALSE),
    ('manager','help-v1-manager-billgo-cong-no','billgo','quan-ly-cua-hang-theo-doi-billgo','Quản lý cửa hàng: theo dõi BillGo và công nợ','Quản lý gói cước, khoản phải thu và thanh toán trong phạm vi được cấp quyền.',
$html$<h2>Giới thiệu</h2><p>Manager có thể dùng BillGo khi menu và quyền dữ liệu cho phép. Chức năng liên quan công nợ, kỳ cước, thanh toán và biên nhận.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Thu Cước</strong>.</li><li>Xem danh sách khách hoặc khoản phải thu.</li><li>Mở khoản cần kiểm tra để xem kỳ hạn và trạng thái.</li><li>Đối chiếu số tiền đã thu, còn nợ và lịch sử thanh toán.</li><li>Chỉ ghi nhận thanh toán khi có chứng từ hoặc thông tin xác thực.</li></ol><h2>Lưu ý</h2><p>Manager quản lý BillGo theo quyền đơn vị; nhân viên thu cước có thể chỉ được cập nhật phần được giao.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách BillGo và chi tiết thanh toán.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video BillGo cho quản lý vào trường YouTube URL.</p>$html$,3040,ARRAY['MANAGER']::TEXT[],TRUE),
    ('manager','help-v1-manager-kho-ban-hang','kho-ban-hang','quan-ly-cua-hang-kiem-tra-kho-ban-hang','Quản lý cửa hàng: kiểm tra kho và bán hàng','Theo dõi sản phẩm, tồn kho và đơn bán trong mục Kho hàng.',
$html$<h2>Giới thiệu</h2><p>Mục Kho hàng phục vụ quản lý sản phẩm, tồn kho, nhập hàng và bán hàng tùy màn hình hiện có.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Kho hàng</strong>.</li><li>Kiểm tra danh sách sản phẩm và số liệu tồn.</li><li>Mở phần nhập hàng hoặc bán hàng nếu giao diện đang có.</li><li>Đối chiếu dữ liệu trước khi lưu thay đổi.</li><li>Tra cứu lịch sử bán hàng hoặc sản phẩm khi cần hỗ trợ khách.</li></ol><h2>Lưu ý</h2><p>Không chỉnh kho khi chưa đối chiếu thực tế. Sai tồn kho sẽ ảnh hưởng bán hàng và bảo hành.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách kho, form nhập hàng và phần bán hàng.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video kho/bán hàng cho quản lý vào trường YouTube URL.</p>$html$,3050,ARRAY['MANAGER']::TEXT[],FALSE),
    ('manager','help-v1-manager-chat-thong-bao','chat-thong-bao','quan-ly-cua-hang-chat-va-thong-bao','Quản lý cửa hàng: chat và thông báo vận hành','Theo dõi thông báo, tin nhắn và việc cần xử lý.',
$html$<h2>Giới thiệu</h2><p>Quản lý dùng chat và thông báo trong khu vực thợ để phối hợp công việc. Popup chuông hiển thị tin mới và có thể dẫn tới màn hình liên quan.</p><h2>Hướng dẫn từng bước</h2><ol><li>Bấm biểu tượng chuông để xem thông báo mới.</li><li>Mở thông báo có target_url nếu cần xử lý.</li><li>Vào <strong>Chat</strong> để trao đổi với người liên quan.</li><li>Ghi rõ mã việc hoặc tên khách khi nhắn tin.</li><li>Sau khi xử lý, quay lại màn hình nghiệp vụ để cập nhật dữ liệu.</li></ol><h2>Lưu ý</h2><p>Thông báo không thay thế dữ liệu nghiệp vụ; trạng thái công việc/công nợ vẫn phải cập nhật ở đúng màn hình.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp popup thông báo và trang chat.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video chat/thông báo cho quản lý vào trường YouTube URL.</p>$html$,3060,ARRAY['MANAGER']::TEXT[],FALSE)
)
INSERT INTO public.help_articles (category_id, slug, title, description, content_html, cover_image_url, image_urls, video_url, sort_order, status, is_featured, audiences, help_context, published_at)
SELECT category.id, article.slug, article.title, article.description, article.content_html, NULL, ARRAY[]::TEXT[], NULL, article.sort_order, 'draft', article.is_featured, article.audiences, article.help_context, NULL
FROM seed_articles article
LEFT JOIN public.help_categories category ON category.slug = article.category_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.help_articles existing
  WHERE existing.help_context = article.help_context OR existing.slug = article.slug
);

COMMIT;

SELECT 'manager' AS help_v1_group, COUNT(*) AS seeded_or_existing
FROM public.help_articles
WHERE help_context LIKE 'help-v1-manager-%';

BEGIN;

WITH seed_articles(primary_group, help_context, category_slug, slug, title, description, content_html, sort_order, audiences, is_featured) AS (
  VALUES
    ('owner','help-v1-owner-vai-tro-chu-don-vi','cua-hang-doi-nhom','chu-cua-hang-vai-tro-chu-don-vi','Chủ cửa hàng: vai trò chủ đơn vị','Hiểu quyền owner trong đơn vị thợ và phạm vi dữ liệu cửa hàng.',
$html$<h2>Giới thiệu</h2><p>Chủ cửa hàng tương ứng membership <strong>owner</strong> trong đơn vị thợ. Audience OWNER trong Help Center dành cho nội dung quản trị cấp chủ đơn vị.</p><h2>Hướng dẫn từng bước</h2><ol><li>Đăng nhập tài khoản chủ đơn vị.</li><li>Vào khu vực thợ để xem menu được mở theo role owner.</li><li>Kiểm tra dữ liệu công việc, khách hàng, BillGo, kho và bán hàng.</li><li>Đối chiếu thông tin đơn vị nếu thấy thiếu dữ liệu.</li><li>Liên hệ admin khi cần thay đổi ngoài phạm vi màn hình hiện có.</li></ol><h2>Lưu ý</h2><p>Owner cũng được cộng audience WORKER và MANAGER, nên sẽ xem được bài dùng chung cho thợ/quản lý sau khi xuất bản.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp menu chủ cửa hàng trong khu vực thợ.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video tổng quan chủ cửa hàng vào trường YouTube URL.</p>$html$,4010,ARRAY['OWNER']::TEXT[],TRUE),
    ('owner','help-v1-owner-quan-ly-nhan-su','cua-hang-doi-nhom','chu-cua-hang-quan-ly-nhan-su-va-vai-tro','Chủ cửa hàng: quản lý nhân sự và vai trò','Nắm các vai trò owner, manager, technician, bill_collector, sales_inventory.',
$html$<h2>Giới thiệu</h2><p>Schema đơn vị thợ có các vai trò thành viên: owner, manager, technician, bill_collector và sales_inventory. Một số thao tác nhân sự phụ thuộc màn hình và policy hiện có.</p><h2>Hướng dẫn từng bước</h2><ol><li>Kiểm tra danh sách nhân sự ở màn hình quản trị đơn vị nếu được hiển thị.</li><li>Xác định vai trò phù hợp với công việc thực tế.</li><li>Chỉ cấp vai trò cần thiết cho từng người.</li><li>Sau khi thay đổi, yêu cầu nhân sự đăng nhập lại nếu menu chưa cập nhật.</li><li>Theo dõi dữ liệu phát sinh theo từng vai trò.</li></ol><h2>Lưu ý</h2><p>Không gán quyền cao hơn nhu cầu. Technician thiên về việc, bill_collector thiên về thu cước, sales_inventory thiên về kho/bán hàng.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách thành viên và lựa chọn vai trò nếu màn hình có.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video phân quyền nhân sự vào trường YouTube URL.</p>$html$,4020,ARRAY['OWNER']::TEXT[],FALSE),
    ('owner','help-v1-owner-kiem-soat-viec','dat-lich-cong-viec','chu-cua-hang-kiem-soat-cong-viec','Chủ cửa hàng: kiểm soát công việc của đơn vị','Theo dõi việc, lịch sử và khách hàng trong phạm vi cửa hàng.',
$html$<h2>Giới thiệu</h2><p>Chủ cửa hàng dùng các màn hình công việc, khách hàng và lịch sử để nắm tình hình vận hành của đơn vị.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào danh sách việc hoặc trang chủ thợ.</li><li>Kiểm tra các việc đang mở và trạng thái xử lý.</li><li>Mở chi tiết những việc cần kiểm soát.</li><li>Tra cứu khách hàng hoặc lịch sử khi cần đối chiếu.</li><li>Yêu cầu thợ/quản lý cập nhật lại nếu dữ liệu chưa đúng.</li></ol><h2>Lưu ý</h2><p>Không thay đổi trạng thái thay cho người xử lý nếu chưa xác minh tình hình thực tế.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách việc, khách hàng và lịch sử.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video kiểm soát công việc vào trường YouTube URL.</p>$html$,4030,ARRAY['OWNER']::TEXT[],FALSE),
    ('owner','help-v1-owner-billgo','billgo','chu-cua-hang-quan-tri-billgo','Chủ cửa hàng: quản trị BillGo','Theo dõi gói cước, công nợ, thu tiền và biên nhận trong BillGo.',
$html$<h2>Giới thiệu</h2><p>Owner và manager thuộc nhóm có thể quản lý BillGo theo helper quyền hiện có. Dữ liệu vẫn nằm trong phạm vi đơn vị.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Thu Cước</strong>.</li><li>Kiểm tra danh sách thuê bao/khoản phải thu.</li><li>Mở khoản cần xử lý để xem kỳ cước và thanh toán.</li><li>Đối chiếu biên nhận nếu đã ghi nhận thanh toán.</li><li>Theo dõi các khoản quá hạn hoặc còn nợ.</li></ol><h2>Lưu ý</h2><p>Chỉ ghi nhận thanh toán khi có căn cứ. Số liệu BillGo có thể hiển thị cho khách hàng trong hồ sơ của họ.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách BillGo, chi tiết khoản thu và biên nhận.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video quản trị BillGo vào trường YouTube URL.</p>$html$,4040,ARRAY['OWNER']::TEXT[],TRUE),
    ('owner','help-v1-owner-kho-ban-hang','kho-ban-hang','chu-cua-hang-quan-tri-kho-va-ban-hang','Chủ cửa hàng: quản trị kho và bán hàng','Kiểm soát sản phẩm, tồn kho, nhập hàng, đơn bán và bảo hành.',
$html$<h2>Giới thiệu</h2><p>Kho hàng và bán hàng là dữ liệu quan trọng của cửa hàng. Owner cần kiểm tra thường xuyên để hạn chế sai lệch tồn kho và doanh thu.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Kho hàng</strong>.</li><li>Kiểm tra danh sách sản phẩm, mã hàng và tồn kho.</li><li>Mở phần nhập hàng khi cần ghi nhận hàng vào.</li><li>Mở phần bán hàng để xem đơn bán nếu giao diện hiển thị.</li><li>Đối chiếu bảo hành/sản phẩm trong hồ sơ khách khi cần.</li></ol><h2>Lưu ý</h2><p>Không xóa hoặc sửa sản phẩm đang liên quan đến giao dịch nếu chưa kiểm tra ảnh hưởng.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp sản phẩm, nhập hàng, bán hàng và bảo hành.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video quản trị kho/bán hàng vào trường YouTube URL.</p>$html$,4050,ARRAY['OWNER']::TEXT[],FALSE),
    ('owner','help-v1-owner-dia-ban-thu-cuoc','billgo','chu-cua-hang-dia-ban-va-phan-cong-thu-cuoc','Chủ cửa hàng: địa bàn và phân công thu cước','Hiểu dữ liệu địa bàn, khu vực và phân công thu cước nếu đã bật migration liên quan.',
$html$<h2>Giới thiệu</h2><p>Schema có dữ liệu khu vực, sub area và phân công collector cho BillGo. Các màn hình liên quan phụ thuộc migration và quyền dữ liệu đã triển khai.</p><h2>Hướng dẫn từng bước</h2><ol><li>Kiểm tra menu hoặc màn hình địa bàn nếu tài khoản được hiển thị.</li><li>Xem danh sách khu vực/sub area.</li><li>Đối chiếu nhân sự thu cước được phân công.</li><li>Theo dõi khoản thu theo địa bàn trong BillGo.</li><li>Báo admin nếu thiếu màn hình hoặc thiếu dữ liệu sau khi migration đã chạy.</li></ol><h2>Lưu ý</h2><p>Không mô tả thao tác tạo/sửa địa bàn nếu màn hình hiện tại chưa hiển thị cho owner trong app của bạn.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp màn hình địa bàn/phân công nếu đã bật.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video địa bàn thu cước vào trường YouTube URL.</p>$html$,4060,ARRAY['OWNER']::TEXT[],FALSE),
    ('owner','help-v1-owner-kiem-tra-du-lieu','cua-hang-doi-nhom','chu-cua-hang-kiem-tra-du-lieu-truoc-khi-bao-admin','Chủ cửa hàng: kiểm tra dữ liệu trước khi báo admin','Checklist tự kiểm tra khi thiếu menu, thiếu việc hoặc sai số liệu.',
$html$<h2>Giới thiệu</h2><p>Bài này giúp chủ cửa hàng tự kiểm tra các nguyên nhân phổ biến trước khi báo admin: trạng thái tài khoản, membership, role, dữ liệu đơn vị và quyền module.</p><h2>Hướng dẫn từng bước</h2><ol><li>Đăng xuất và đăng nhập lại để làm mới quyền.</li><li>Kiểm tra đang ở <strong>Chế độ Thợ</strong>, không phải Chế độ Khách hàng.</li><li>Kiểm tra menu có đúng với vai trò owner không.</li><li>Đối chiếu dữ liệu với quản lý/thợ trong cùng đơn vị.</li><li>Gửi admin ảnh chụp màn hình, tài khoản và mô tả dữ liệu đang thiếu.</li></ol><h2>Lưu ý</h2><p>Không tự tạo dữ liệu trùng để “bù” khi nghi ngờ thiếu dữ liệu; hãy xác minh quyền và nguồn dữ liệu trước.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp menu, màn hình lỗi hoặc dữ liệu bị thiếu.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video checklist kiểm tra dữ liệu vào trường YouTube URL.</p>$html$,4070,ARRAY['OWNER']::TEXT[],FALSE)
)
INSERT INTO public.help_articles (category_id, slug, title, description, content_html, cover_image_url, image_urls, video_url, sort_order, status, is_featured, audiences, help_context, published_at)
SELECT category.id, article.slug, article.title, article.description, article.content_html, NULL, ARRAY[]::TEXT[], NULL, article.sort_order, 'draft', article.is_featured, article.audiences, article.help_context, NULL
FROM seed_articles article
LEFT JOIN public.help_categories category ON category.slug = article.category_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.help_articles existing
  WHERE existing.help_context = article.help_context OR existing.slug = article.slug
);

COMMIT;

SELECT 'owner' AS help_v1_group, COUNT(*) AS seeded_or_existing
FROM public.help_articles
WHERE help_context LIKE 'help-v1-owner-%';

BEGIN;

WITH seed_articles(primary_group, help_context, category_slug, slug, title, description, content_html, sort_order, audiences, is_featured) AS (
  VALUES
    ('admin','help-v1-admin-dang-nhap-phan-quyen','admin-cms','admin-dang-nhap-va-phan-quyen-module','Admin: đăng nhập và phân quyền module','Hiểu menu admin, quyền xem/sửa module và trang chỉ Super Admin.',
$html$<h2>Giới thiệu</h2><p>Admin panel lọc menu theo quyền module. Super Admin thấy thêm Super Admin, Sao lưu &amp; Khôi phục và Cài đặt.</p><h2>Hướng dẫn từng bước</h2><ol><li>Đăng nhập tài khoản admin.</li><li>Vào <strong>/admin</strong> hoặc menu admin được chuyển hướng.</li><li>Kiểm tra các mục đang hiển thị theo quyền.</li><li>Nếu bị yêu cầu đổi mật khẩu, vào trang Super Admin theo chuyển hướng.</li><li>Liên hệ Super Admin nếu thiếu quyền module cần dùng.</li></ol><h2>Lưu ý</h2><p>Quyền view mở menu/trang; quyền manage cho phép thao tác tạo, sửa, duyệt hoặc ghi nhận dữ liệu tùy module.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp sidebar admin và màn hình phân quyền module.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video đăng nhập admin vào trường YouTube URL.</p>$html$,5010,ARRAY['ADMIN']::TEXT[],TRUE),
    ('admin','help-v1-admin-quan-ly-tho','admin-cms','admin-quan-ly-tho-duyet-khoa-reset','Admin: quản lý thợ, duyệt, khóa và reset mật khẩu','Xử lý hồ sơ thợ pending, active, blocked trong trang Quản lý Thợ.',
$html$<h2>Giới thiệu</h2><p>Trang <strong>Quản lý Thợ</strong> cho admin xem hồ sơ, lọc trạng thái, duyệt, từ chối/khóa, mở khóa, sửa hồ sơ và reset mật khẩu thợ theo code hiện có.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Quản lý Thợ</strong>.</li><li>Lọc theo Tất cả, Chờ duyệt, Hoạt động hoặc Đã khóa.</li><li>Mở hồ sơ cần xử lý.</li><li>Dùng nút duyệt, từ chối/khóa, mở khóa hoặc chỉnh sửa theo đúng tình huống.</li><li>Nếu reset mật khẩu, thông báo lại cho thợ theo kênh nội bộ.</li></ol><h2>Lưu ý</h2><p>Khi duyệt hoặc từ chối, hệ thống có luồng gửi email tài khoản nếu endpoint thông báo hoạt động.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp bảng thợ, bộ lọc trạng thái và hộp thoại xử lý.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video quản lý thợ vào trường YouTube URL.</p>$html$,5020,ARRAY['ADMIN']::TEXT[],TRUE),
    ('admin','help-v1-admin-quan-ly-job','admin-cms','admin-quan-ly-job-dieu-phoi-cong-viec','Admin: quản lý job và điều phối công việc','Theo dõi, tạo, điều phối và xử lý công việc trong module Jobs.',
$html$<h2>Giới thiệu</h2><p>Module Công việc trong admin dùng để quản lý job toàn hệ thống theo quyền admin. Một số thao tác đi qua API admin/jobs và có hỗ trợ multipart khi cần tệp đính kèm.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Quản lý Job</strong>.</li><li>Tìm hoặc lọc công việc cần xử lý.</li><li>Mở chi tiết job để kiểm tra khách hàng, thợ, dịch vụ và trạng thái.</li><li>Thực hiện các nút tạo/cập nhật/điều phối đang có trên màn hình.</li><li>Kiểm tra thông báo phát sinh nếu job tạo hoặc đổi trạng thái.</li></ol><h2>Lưu ý</h2><p>Không tự đổi dữ liệu job ngoài màn hình nếu chưa hiểu tác động đến thông báo, chat, lịch sử và phân quyền.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp danh sách job và form xử lý job.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video quản lý job vào trường YouTube URL.</p>$html$,5030,ARRAY['ADMIN']::TEXT[],FALSE),
    ('admin','help-v1-admin-dich-vu-gia-dia-ban','admin-cms','admin-dich-vu-gia-va-dia-ban','Admin: dịch vụ, bảng giá và địa bàn','Quản lý cây dịch vụ nhiều cấp, trạng thái dịch vụ và địa bàn.',
$html$<h2>Giới thiệu</h2><p>Admin có trang <strong>Dịch vụ &amp; Giá</strong> để quản lý danh mục dịch vụ theo cây nhiều cấp, và trang <strong>Địa bàn</strong> trong module services.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Dịch vụ &amp; Giá</strong>.</li><li>Dùng nút thêm danh mục, thêm mục con hoặc thêm dịch vụ nếu cần.</li><li>Đặt trạng thái hoạt động/tạm ngưng theo nhu cầu.</li><li>Kiểm tra các mục chưa dùng đến nếu cần hiển thị.</li><li>Vào <strong>Địa bàn</strong> để kiểm tra dữ liệu khu vực nếu module đã có dữ liệu.</li></ol><h2>Lưu ý</h2><p>Dịch vụ active có thể hiển thị cho khách đặt lịch; hãy kiểm tra giá và mô tả trước khi bật.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp cây dịch vụ, form dịch vụ và trang địa bàn.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video dịch vụ/bảng giá vào trường YouTube URL.</p>$html$,5040,ARRAY['ADMIN']::TEXT[],FALSE),
    ('admin','help-v1-admin-khach-hang-chat-thong-bao','chat-thong-bao','admin-khach-hang-chat-va-thong-bao','Admin: khách hàng, chat và thông báo','Quản lý hồ sơ khách, cuộc trò chuyện và thông báo vận hành.',
$html$<h2>Giới thiệu</h2><p>Admin có menu <strong>Khách hàng</strong>, <strong>Chat</strong> và <strong>Thông báo</strong>. Các trang này hỗ trợ theo dõi hồ sơ, trao đổi và xử lý tin vận hành.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Khách hàng</strong> để tra cứu hồ sơ và trạng thái khách.</li><li>Vào <strong>Chat</strong> để kiểm tra cuộc trò chuyện khi cần hỗ trợ.</li><li>Vào <strong>Thông báo</strong> để xem thống kê và danh sách notification.</li><li>Mở mục liên quan để xử lý theo quyền module.</li><li>Ghi nhận lại thay đổi nghiệp vụ ở đúng màn hình gốc.</li></ol><h2>Lưu ý</h2><p>Chat không thay thế cập nhật job hoặc công nợ. Thông báo chỉ phản ánh sự kiện, không phải nguồn dữ liệu duy nhất.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp trang khách hàng, chat và thông báo admin.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video chăm sóc khách/admin chat vào trường YouTube URL.</p>$html$,5050,ARRAY['ADMIN']::TEXT[],FALSE),
    ('admin','help-v1-admin-cms-help-journey','admin-cms','admin-quan-ly-noi-dung-cms-help-journey','Admin: quản lý nội dung, hướng dẫn và hành trình','Dùng các trang CMS, Help Center và Hành trình trong module Content.',
$html$<h2>Giới thiệu</h2><p>Admin có các trang <strong>Trang nội dung</strong>, <strong>Hướng dẫn</strong> và <strong>Hành trình</strong>. Help Center dùng bảng help_categories/help_articles với audience theo vai trò.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Trang nội dung</strong> để quản lý bài viết/trang tĩnh CMS.</li><li>Vào <strong>Hướng dẫn</strong> để tạo danh mục và bài hướng dẫn theo audience.</li><li>Giữ bài ở trạng thái Nháp khi cần biên tập.</li><li>Thêm vị trí ảnh và URL YouTube trong form bài hướng dẫn.</li><li>Vào <strong>Hành trình</strong> để quản lý bài hành trình nếu cần.</li></ol><h2>Lưu ý</h2><p>Danh mục hướng dẫn ngoài public chỉ hiện khi có bài published phù hợp quyền người xem.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp tab Bài viết, Danh mục và Viết bài trong /admin/help.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video quản lý CMS/Help vào trường YouTube URL.</p>$html$,5060,ARRAY['ADMIN']::TEXT[],TRUE),
    ('admin','help-v1-admin-billgo-sales','billgo','admin-billgo-ban-hang-va-doanh-thu','Admin: BillGo, bán hàng và doanh thu','Theo dõi module BillGo, bán hàng và báo cáo liên quan theo quyền admin.',
$html$<h2>Giới thiệu</h2><p>Admin sidebar có <strong>BillGo</strong>; quyền module còn có <strong>Bán hàng</strong> và <strong>Thống kê</strong>. Các mục này giúp kiểm tra công nợ, thu tiền, đơn bán và báo cáo.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>BillGo</strong> để kiểm tra dữ liệu thu cước.</li><li>Đối chiếu khoản phải thu, thanh toán và gói cước.</li><li>Xem dữ liệu bán hàng ở màn hình/module được cấp quyền nếu có.</li><li>Vào <strong>Tổng quan</strong> để xem báo cáo tổng quan.</li><li>Ghi nhận sai lệch và kiểm tra nguồn dữ liệu trước khi sửa.</li></ol><h2>Lưu ý</h2><p>Không chỉnh trực tiếp dữ liệu tài chính khi chưa có chứng từ hoặc xác nhận từ cửa hàng.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp BillGo admin và dashboard tổng quan.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video BillGo admin vào trường YouTube URL.</p>$html$,5070,ARRAY['ADMIN']::TEXT[],FALSE),
    ('admin','help-v1-admin-super-backup-settings','admin-cms','super-admin-sao-luu-cai-dat-va-bao-mat','Super Admin: sao lưu, cài đặt và bảo mật','Các trang chỉ Super Admin: tài khoản admin, backup/restore và cài đặt hệ thống.',
$html$<h2>Giới thiệu</h2><p>Các mục <strong>Super Admin</strong>, <strong>Sao lưu &amp; Khôi phục</strong> và <strong>Cài đặt</strong> chỉ hiện với Super Admin. Restore có cảnh báo ghi đè dữ liệu hiện tại.</p><h2>Hướng dẫn từng bước</h2><ol><li>Vào <strong>Super Admin</strong> để quản lý tài khoản admin và phân quyền module.</li><li>Vào <strong>Sao lưu &amp; Khôi phục</strong> để tạo hoặc tải backup nếu cần.</li><li>Chỉ restore khi đã hiểu rủi ro ghi đè dữ liệu.</li><li>Vào <strong>Cài đặt</strong> để chỉnh cấu hình chung, hệ thống và pháp lý.</li><li>Kiểm tra nhật ký/audit nếu cần truy vết thao tác bảo mật.</li></ol><h2>Lưu ý</h2><p>Nếu thiếu quyền DB hoặc RPC backup chưa chạy migration, màn hình sẽ báo lỗi tương ứng. Không chạy restore trên production khi chưa có xác nhận.</p><h2>Vị trí bổ sung ảnh</h2><p><strong>[Ảnh cần bổ sung]</strong> Chụp trang phân quyền admin, backup và cài đặt.</p><h2>Link YouTube</h2><p><strong>[Video cần bổ sung]</strong> Dán video Super Admin vào trường YouTube URL.</p>$html$,5080,ARRAY['ADMIN']::TEXT[],TRUE)
)
INSERT INTO public.help_articles (category_id, slug, title, description, content_html, cover_image_url, image_urls, video_url, sort_order, status, is_featured, audiences, help_context, published_at)
SELECT category.id, article.slug, article.title, article.description, article.content_html, NULL, ARRAY[]::TEXT[], NULL, article.sort_order, 'draft', article.is_featured, article.audiences, article.help_context, NULL
FROM seed_articles article
LEFT JOIN public.help_categories category ON category.slug = article.category_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.help_articles existing
  WHERE existing.help_context = article.help_context OR existing.slug = article.slug
);

COMMIT;

SELECT 'admin' AS help_v1_group, COUNT(*) AS seeded_or_existing
FROM public.help_articles
WHERE help_context LIKE 'help-v1-admin-%';

SELECT 'all_help_v1' AS help_v1_group, COUNT(*) AS seeded_or_existing
FROM public.help_articles
WHERE help_context LIKE 'help-v1-%';
