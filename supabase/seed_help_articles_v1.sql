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
