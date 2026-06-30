-- Standard Alotho service catalog, 3 levels:
-- parent category -> service group -> concrete service.
--
-- This migration does not change the jobs table and does not delete existing
-- customer/job data. Existing jobs.service_id values remain valid.

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS parent_service_id UUID REFERENCES public.services(id) ON DELETE CASCADE;

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS visible_to_customer BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS visible_to_admin BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS visible_to_worker BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS service_detail_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

WITH roots(id, name, description, icon, sort_order) AS (
  VALUES
    ('77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid, 'Mạng Internet', 'Dịch vụ Internet, Wifi, LAN và hệ thống mạng.', 'Router', 1),
    ('11111111-0000-0000-0000-000000000003'::uuid, 'Camera', 'Dịch vụ camera quan sát, đầu ghi và tài khoản xem từ xa.', 'Camera', 2),
    ('c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid, 'Máy tính', 'Dịch vụ máy tính, laptop, phần mềm và dữ liệu.', 'Computer', 3),
    ('1267f766-5082-4287-a5e9-a2c475753275'::uuid, 'Máy in', 'Dịch vụ máy in, mực in và linh kiện.', 'Printer', 4)
)
INSERT INTO public.services (id, parent_service_id, name, description, icon, base_price, is_active)
SELECT id, NULL, name, description, icon, 0, TRUE
FROM roots
ON CONFLICT (id) DO UPDATE
SET parent_service_id = NULL,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    is_active = TRUE,
    updated_at = NOW();

WITH groups(key, root_id, name, description, icon, sort_order) AS (
  VALUES
    ('internet_install', '77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid, 'Lắp đặt', 'Lắp mới, mở rộng và thi công hệ thống mạng.', 'Router', 101),
    ('internet_repair', '77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid, 'Sửa chữa', 'Xử lý sự cố Internet, Wifi, Router, Switch và LAN.', 'Wrench', 102),
    ('internet_maintenance', '77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid, 'Bảo trì', 'Kiểm tra, vệ sinh và tối ưu hệ thống mạng.', 'Settings', 103),
    ('internet_upgrade', '77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid, 'Nâng cấp', 'Nâng cấp thiết bị và mở rộng vùng phủ mạng.', 'Wifi', 104),
    ('internet_relocation', '77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid, 'Di dời', 'Di chuyển thiết bị và đường mạng.', 'MapPin', 105),

    ('camera_install', '11111111-0000-0000-0000-000000000003'::uuid, 'Lắp đặt', 'Lắp mới camera, đầu ghi, ổ cứng và dây tín hiệu.', 'Camera', 201),
    ('camera_setup', '11111111-0000-0000-0000-000000000003'::uuid, 'Cài đặt', 'Cấu hình xem từ xa, người dùng và ghi hình.', 'Settings', 202),
    ('camera_repair', '11111111-0000-0000-0000-000000000003'::uuid, 'Sửa chữa', 'Xử lý lỗi camera, đầu ghi, ổ cứng, nguồn và tín hiệu.', 'Wrench', 203),
    ('camera_maintenance', '11111111-0000-0000-0000-000000000003'::uuid, 'Bảo trì', 'Vệ sinh và kiểm tra định kỳ hệ thống camera.', 'ShieldCheck', 204),
    ('camera_upgrade', '11111111-0000-0000-0000-000000000003'::uuid, 'Nâng cấp', 'Thay thế và mở rộng hệ thống camera.', 'Star', 205),
    ('camera_relocation', '11111111-0000-0000-0000-000000000003'::uuid, 'Di dời', 'Di chuyển, đi lại dây và lắp lại hệ thống camera.', 'MapPin', 206),
    ('camera_account', '11111111-0000-0000-0000-000000000003'::uuid, 'Tài khoản', 'Cấp lại, đổi và khôi phục tài khoản camera.', 'Users', 207),

    ('computer_setup', 'c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid, 'Cài đặt', 'Cài hệ điều hành, phần mềm, thiết bị và kết nối.', 'Computer', 301),
    ('computer_repair', 'c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid, 'Sửa chữa', 'Xử lý lỗi phần cứng, khởi động, mạng và âm thanh.', 'Wrench', 302),
    ('computer_upgrade', 'c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid, 'Nâng cấp', 'Nâng cấp linh kiện máy tính và laptop.', 'Star', 303),
    ('computer_maintenance', 'c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid, 'Bảo trì', 'Vệ sinh, tối ưu và kiểm tra sức khỏe máy.', 'ShieldCheck', 304),
    ('computer_data', 'c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid, 'Dữ liệu', 'Sao lưu, phục hồi, chuyển và đồng bộ dữ liệu.', 'Briefcase', 305),

    ('printer_install', '1267f766-5082-4287-a5e9-a2c475753275'::uuid, 'Lắp đặt', 'Lắp máy in, driver và cấu hình kết nối.', 'Printer', 401),
    ('printer_repair', '1267f766-5082-4287-a5e9-a2c475753275'::uuid, 'Sửa chữa', 'Xử lý lỗi in, scan, fax, giấy và cartridge.', 'Wrench', 402),
    ('printer_maintenance', '1267f766-5082-4287-a5e9-a2c475753275'::uuid, 'Bảo trì', 'Vệ sinh, bảo dưỡng và kiểm tra cụm máy in.', 'ShieldCheck', 403),
    ('printer_ink', '1267f766-5082-4287-a5e9-a2c475753275'::uuid, 'Đổ mực', 'Đổ mực, thay mực và vật tư hộp mực.', 'Droplets', 404),
    ('printer_parts', '1267f766-5082-4287-a5e9-a2c475753275'::uuid, 'Linh kiện', 'Thay linh kiện và cụm cơ khí máy in.', 'Settings', 405)
)
INSERT INTO public.services (id, parent_service_id, name, description, icon, base_price, is_active, visible_to_customer, visible_to_admin, visible_to_worker)
SELECT uuid_generate_v5(uuid_ns_url(), 'alotho-service-group:' || key),
       root_id,
       name,
       description,
       icon,
       0,
       TRUE,
       CASE
         WHEN name IN ('Lắp đặt', 'Sửa chữa', 'Bảo trì', 'Di dời', 'Cài đặt', 'Nâng cấp', 'Đổ mực') THEN TRUE
         ELSE FALSE
       END,
       TRUE,
       TRUE
FROM groups
ON CONFLICT (id) DO UPDATE
SET parent_service_id = EXCLUDED.parent_service_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    is_active = TRUE,
    visible_to_customer = EXCLUDED.visible_to_customer,
    visible_to_admin = TRUE,
    visible_to_worker = TRUE,
    updated_at = NOW();

WITH catalog(group_key, service_name, icon, base_price, sort_order) AS (
  VALUES
    ('internet_install', 'Lắp mới Internet', 'Router', 195000, 10101),
    ('internet_install', 'Lắp thêm Mesh Wifi', 'Wifi', 250000, 10102),
    ('internet_install', 'Lắp Router Wifi', 'Router', 180000, 10103),
    ('internet_install', 'Lắp Switch', 'Cable', 180000, 10104),
    ('internet_install', 'Lắp Bộ phát Wifi', 'Wifi', 180000, 10105),
    ('internet_install', 'Đi dây mạng LAN', 'Cable', 350000, 10106),
    ('internet_install', 'Thi công mạng văn phòng', 'Briefcase', 500000, 10107),
    ('internet_install', 'Thi công mạng nhà xưởng', 'Settings', 500000, 10108),
    ('internet_install', 'Thi công mạng quán cafe', 'Wifi', 500000, 10109),
    ('internet_install', 'Thi công mạng khách sạn', 'Router', 500000, 10110),
    ('internet_repair', 'Mất mạng', 'Wrench', 150000, 10201),
    ('internet_repair', 'Mạng chập chờn', 'Wrench', 150000, 10202),
    ('internet_repair', 'Wifi yếu', 'Wifi', 150000, 10203),
    ('internet_repair', 'Wifi không phủ sóng', 'Wifi', 150000, 10204),
    ('internet_repair', 'Đứt cáp mạng', 'Cable', 150000, 10205),
    ('internet_repair', 'Router lỗi', 'Router', 150000, 10206),
    ('internet_repair', 'Switch lỗi', 'Cable', 150000, 10207),
    ('internet_repair', 'Không cấp IP', 'Settings', 150000, 10208),
    ('internet_repair', 'Không truy cập Internet', 'Router', 150000, 10209),
    ('internet_repair', 'Khắc phục lỗi mạng nội bộ', 'Wrench', 180000, 10210),
    ('internet_maintenance', 'Kiểm tra hệ thống mạng', 'ShieldCheck', 180000, 10301),
    ('internet_maintenance', 'Tối ưu Wifi', 'Wifi', 180000, 10302),
    ('internet_maintenance', 'Vệ sinh thiết bị', 'ShieldCheck', 120000, 10303),
    ('internet_maintenance', 'Kiểm tra dây mạng', 'Cable', 120000, 10304),
    ('internet_maintenance', 'Kiểm tra Router', 'Router', 120000, 10305),
    ('internet_maintenance', 'Kiểm tra Switch', 'Cable', 120000, 10306),
    ('internet_maintenance', 'Kiểm tra Mesh Wifi', 'Wifi', 120000, 10307),
    ('internet_maintenance', 'Bảo trì định kỳ', 'Calendar', 250000, 10308),
    ('internet_upgrade', 'Nâng cấp Router', 'Router', 180000, 10401),
    ('internet_upgrade', 'Nâng cấp Wifi 6/7', 'Wifi', 250000, 10402),
    ('internet_upgrade', 'Nâng cấp Mesh', 'Wifi', 250000, 10403),
    ('internet_upgrade', 'Nâng cấp Switch', 'Cable', 180000, 10404),
    ('internet_upgrade', 'Mở rộng vùng phủ Wifi', 'Wifi', 250000, 10405),
    ('internet_upgrade', 'Tăng tốc độ mạng', 'Star', 180000, 10406),
    ('internet_relocation', 'Di chuyển Router', 'MapPin', 150000, 10501),
    ('internet_relocation', 'Di chuyển Modem', 'MapPin', 150000, 10502),
    ('internet_relocation', 'Di chuyển đường mạng', 'Cable', 250000, 10503),
    ('internet_relocation', 'Di chuyển hệ thống', 'MapPin', 350000, 10504),

    ('camera_install', 'Lắp Camera IP', 'Camera', 500000, 20101),
    ('camera_install', 'Lắp Camera Wifi', 'Camera', 450000, 20102),
    ('camera_install', 'Lắp Camera Analog', 'Cctv', 450000, 20103),
    ('camera_install', 'Lắp Camera AI', 'Camera', 650000, 20104),
    ('camera_install', 'Lắp Camera PTZ', 'Cctv', 800000, 20105),
    ('camera_install', 'Lắp Camera trong nhà', 'Camera', 450000, 20106),
    ('camera_install', 'Lắp Camera ngoài trời', 'Camera', 500000, 20107),
    ('camera_install', 'Lắp đầu ghi', 'Settings', 300000, 20108),
    ('camera_install', 'Lắp ổ cứng', 'Briefcase', 250000, 20109),
    ('camera_install', 'Đi dây camera', 'Cable', 350000, 20110),
    ('camera_setup', 'Cài đặt điện thoại', 'Phone', 120000, 20201),
    ('camera_setup', 'Cài đặt máy tính', 'Computer', 120000, 20202),
    ('camera_setup', 'Kết nối xem từ xa', 'Settings', 180000, 20203),
    ('camera_setup', 'Cấu hình đầu ghi', 'Settings', 180000, 20204),
    ('camera_setup', 'Thêm camera', 'PlusCircle', 150000, 20205),
    ('camera_setup', 'Thêm người dùng', 'Users', 120000, 20206),
    ('camera_setup', 'Phân quyền', 'ShieldCheck', 120000, 20207),
    ('camera_setup', 'Đồng bộ thời gian', 'Clock', 120000, 20208),
    ('camera_setup', 'Thiết lập ghi hình', 'Settings', 150000, 20209),
    ('camera_repair', 'Camera mất hình', 'Wrench', 250000, 20301),
    ('camera_repair', 'Camera mờ', 'Wrench', 180000, 20302),
    ('camera_repair', 'Camera không lên nguồn', 'Wrench', 250000, 20303),
    ('camera_repair', 'Camera ngoại tuyến', 'Wrench', 180000, 20304),
    ('camera_repair', 'Đầu ghi lỗi', 'Settings', 250000, 20305),
    ('camera_repair', 'Không xem được từ xa', 'Phone', 180000, 20306),
    ('camera_repair', 'Ổ cứng lỗi', 'Briefcase', 250000, 20307),
    ('camera_repair', 'Không ghi hình', 'Settings', 250000, 20308),
    ('camera_repair', 'Lỗi nguồn', 'Plug', 180000, 20309),
    ('camera_repair', 'Lỗi dây tín hiệu', 'Cable', 180000, 20310),
    ('camera_maintenance', 'Vệ sinh camera', 'ShieldCheck', 150000, 20401),
    ('camera_maintenance', 'Kiểm tra đầu ghi', 'Settings', 120000, 20402),
    ('camera_maintenance', 'Kiểm tra ổ cứng', 'Briefcase', 120000, 20403),
    ('camera_maintenance', 'Kiểm tra nguồn', 'Plug', 120000, 20404),
    ('camera_maintenance', 'Kiểm tra dây', 'Cable', 120000, 20405),
    ('camera_maintenance', 'Kiểm tra tín hiệu', 'ShieldCheck', 120000, 20406),
    ('camera_maintenance', 'Bảo trì định kỳ', 'Calendar', 250000, 20407),
    ('camera_upgrade', 'Thay camera', 'Camera', 250000, 20501),
    ('camera_upgrade', 'Thay đầu ghi', 'Settings', 300000, 20502),
    ('camera_upgrade', 'Thay ổ cứng', 'Briefcase', 250000, 20503),
    ('camera_upgrade', 'Mở rộng thêm camera', 'Camera', 500000, 20504),
    ('camera_upgrade', 'Nâng cấp dung lượng lưu trữ', 'Briefcase', 250000, 20505),
    ('camera_relocation', 'Di chuyển camera', 'MapPin', 250000, 20601),
    ('camera_relocation', 'Di chuyển đầu ghi', 'MapPin', 250000, 20602),
    ('camera_relocation', 'Đi lại dây', 'Cable', 350000, 20603),
    ('camera_relocation', 'Lắp lại hệ thống', 'Camera', 500000, 20604),
    ('camera_account', 'Cấp lại tài khoản', 'Users', 120000, 20701),
    ('camera_account', 'Đổi mật khẩu', 'Users', 120000, 20702),
    ('camera_account', 'Khôi phục mật khẩu', 'Users', 150000, 20703),
    ('camera_account', 'Cập nhật số điện thoại', 'Phone', 120000, 20704),
    ('camera_account', 'Cập nhật email', 'Phone', 120000, 20705),

    ('computer_setup', 'Cài Windows', 'Computer', 150000, 30101),
    ('computer_setup', 'Cài Office', 'Computer', 120000, 30102),
    ('computer_setup', 'Cài Driver', 'Settings', 120000, 30103),
    ('computer_setup', 'Cài phần mềm', 'Computer', 120000, 30104),
    ('computer_setup', 'Cài máy in', 'Printer', 120000, 30105),
    ('computer_setup', 'Cài mạng LAN', 'Cable', 120000, 30106),
    ('computer_setup', 'Cài Wifi', 'Wifi', 120000, 30107),
    ('computer_setup', 'Cài Email', 'Phone', 120000, 30108),
    ('computer_setup', 'Cài TeamViewer', 'Computer', 120000, 30109),
    ('computer_setup', 'Cài AnyDesk', 'Computer', 120000, 30110),
    ('computer_repair', 'Không khởi động', 'Wrench', 180000, 30201),
    ('computer_repair', 'Màn hình xanh', 'Monitor', 180000, 30202),
    ('computer_repair', 'Máy treo', 'Wrench', 180000, 30203),
    ('computer_repair', 'Máy chậm', 'Wrench', 180000, 30204),
    ('computer_repair', 'Không nhận ổ cứng', 'Briefcase', 180000, 30205),
    ('computer_repair', 'Không nhận RAM', 'Computer', 180000, 30206),
    ('computer_repair', 'Không có mạng', 'Cable', 180000, 30207),
    ('computer_repair', 'Không có âm thanh', 'Settings', 180000, 30208),
    ('computer_repair', 'Không lên màn hình', 'Monitor', 180000, 30209),
    ('computer_repair', 'Mainboard lỗi', 'Settings', 250000, 30210),
    ('computer_upgrade', 'Thay SSD', 'Briefcase', 180000, 30301),
    ('computer_upgrade', 'Thay HDD', 'Briefcase', 180000, 30302),
    ('computer_upgrade', 'Nâng RAM', 'Computer', 180000, 30303),
    ('computer_upgrade', 'Thay CPU', 'Settings', 250000, 30304),
    ('computer_upgrade', 'Thay Main', 'Settings', 250000, 30305),
    ('computer_upgrade', 'Thay nguồn', 'Plug', 180000, 30306),
    ('computer_upgrade', 'Thay VGA', 'Monitor', 250000, 30307),
    ('computer_upgrade', 'Lắp thêm ổ cứng', 'Briefcase', 180000, 30308),
    ('computer_maintenance', 'Vệ sinh máy', 'ShieldCheck', 150000, 30401),
    ('computer_maintenance', 'Tra keo tản nhiệt', 'ShieldCheck', 150000, 30402),
    ('computer_maintenance', 'Kiểm tra phần cứng', 'ShieldCheck', 150000, 30403),
    ('computer_maintenance', 'Tối ưu Windows', 'Computer', 150000, 30404),
    ('computer_maintenance', 'Diệt virus', 'ShieldCheck', 150000, 30405),
    ('computer_maintenance', 'Dọn rác hệ thống', 'ShieldCheck', 120000, 30406),
    ('computer_maintenance', 'Kiểm tra nhiệt độ', 'ShieldCheck', 120000, 30407),
    ('computer_maintenance', 'Kiểm tra ổ cứng', 'Briefcase', 120000, 30408),
    ('computer_data', 'Sao lưu dữ liệu', 'Briefcase', 250000, 30501),
    ('computer_data', 'Khôi phục dữ liệu', 'Briefcase', 300000, 30502),
    ('computer_data', 'Chuyển dữ liệu', 'Briefcase', 250000, 30503),
    ('computer_data', 'Clone ổ cứng', 'Briefcase', 250000, 30504),
    ('computer_data', 'Đồng bộ dữ liệu', 'Briefcase', 250000, 30505),

    ('printer_install', 'Lắp máy in', 'Printer', 120000, 40101),
    ('printer_install', 'Cài Driver', 'Settings', 120000, 40102),
    ('printer_install', 'Kết nối USB', 'Cable', 120000, 40103),
    ('printer_install', 'Kết nối Wifi', 'Wifi', 120000, 40104),
    ('printer_install', 'Chia sẻ máy in', 'Users', 150000, 40105),
    ('printer_install', 'Cấu hình in mạng', 'Cable', 150000, 40106),
    ('printer_repair', 'Không in được', 'Wrench', 180000, 40201),
    ('printer_repair', 'Kẹt giấy', 'Wrench', 180000, 40202),
    ('printer_repair', 'Lem mực', 'Droplets', 180000, 40203),
    ('printer_repair', 'In mờ', 'Printer', 180000, 40204),
    ('printer_repair', 'Không kéo giấy', 'Wrench', 180000, 40205),
    ('printer_repair', 'Báo lỗi Cartridge', 'Printer', 180000, 40206),
    ('printer_repair', 'Báo Offline', 'Printer', 180000, 40207),
    ('printer_repair', 'Không nhận máy in', 'Printer', 180000, 40208),
    ('printer_repair', 'Lỗi Scan', 'Printer', 180000, 40209),
    ('printer_repair', 'Lỗi Fax', 'Printer', 180000, 40210),
    ('printer_maintenance', 'Vệ sinh máy in', 'ShieldCheck', 150000, 40301),
    ('printer_maintenance', 'Bảo dưỡng định kỳ', 'Calendar', 180000, 40302),
    ('printer_maintenance', 'Kiểm tra cụm sấy', 'ShieldCheck', 150000, 40303),
    ('printer_maintenance', 'Kiểm tra trống', 'ShieldCheck', 150000, 40304),
    ('printer_maintenance', 'Kiểm tra gạt mực', 'ShieldCheck', 150000, 40305),
    ('printer_maintenance', 'Kiểm tra Roller', 'ShieldCheck', 150000, 40306),
    ('printer_ink', 'Đổ mực', 'Droplets', 120000, 40401),
    ('printer_ink', 'Thay mực', 'Droplets', 120000, 40402),
    ('printer_ink', 'Thay Drum', 'Settings', 150000, 40403),
    ('printer_ink', 'Thay Gạt', 'Settings', 150000, 40404),
    ('printer_ink', 'Thay Trục từ', 'Settings', 150000, 40405),
    ('printer_ink', 'Thay Bao lụa', 'Settings', 150000, 40406),
    ('printer_parts', 'Thay Main', 'Settings', 250000, 40501),
    ('printer_parts', 'Thay Nguồn', 'Plug', 250000, 40502),
    ('printer_parts', 'Thay Cụm sấy', 'Settings', 250000, 40503),
    ('printer_parts', 'Thay Roller', 'Settings', 180000, 40504),
    ('printer_parts', 'Thay Khay giấy', 'Printer', 180000, 40505),
    ('printer_parts', 'Thay Motor', 'Settings', 250000, 40506)
),
group_ids AS (
  SELECT key, uuid_generate_v5(uuid_ns_url(), 'alotho-service-group:' || key) AS id
  FROM (SELECT DISTINCT group_key AS key FROM catalog) AS keys
),
legacy_matches(service_name, group_key) AS (
  VALUES
    ('Lắp đặt Internet', 'internet_install'),
    ('Sửa mạng Internet', 'internet_repair'),
    ('Cấu hình Wi-Fi', 'internet_repair'),
    ('Mở rộng Wi-Fi Mesh', 'internet_upgrade'),
    ('Kéo dây mạng LAN', 'internet_install'),
    ('Cấu hình Router/Modem', 'internet_repair'),
    ('Bảo trì hệ thống mạng', 'internet_maintenance'),
    ('Lắp đặt Camera', 'camera_install'),
    ('Sửa Camera', 'camera_repair'),
    ('Bảo trì Camera', 'camera_maintenance'),
    ('Cấu hình xem từ xa', 'camera_setup'),
    ('Di dời Camera', 'camera_relocation'),
    ('Nâng cấp hệ thống Camera', 'camera_upgrade'),
    ('Cài phần mềm', 'computer_setup'),
    ('Sửa PC', 'computer_repair'),
    ('Sửa Laptop', 'computer_repair'),
    ('Nâng cấp RAM/SSD', 'computer_upgrade'),
    ('Vệ sinh máy tính', 'computer_maintenance'),
    ('Cứu dữ liệu', 'computer_data'),
    ('Diệt virus', 'computer_maintenance'),
    ('Cài đặt máy in', 'printer_install'),
    ('Sửa máy in', 'printer_repair'),
    ('Thay linh kiện', 'printer_parts'),
    ('Chia sẻ máy in qua mạng', 'printer_install'),
    ('Bảo trì máy in', 'printer_maintenance')
),
reattached AS (
  UPDATE public.services AS service
  SET parent_service_id = group_ids.id,
      updated_at = NOW()
  FROM legacy_matches
  JOIN group_ids ON group_ids.key = legacy_matches.group_key
  WHERE service.name = legacy_matches.service_name
    AND service.parent_service_id IS NULL
    AND service.id <> group_ids.id
  RETURNING service.id
)
INSERT INTO public.services (id, parent_service_id, name, description, icon, base_price, is_active, visible_to_customer, visible_to_admin, visible_to_worker)
SELECT uuid_generate_v5(uuid_ns_url(), 'alotho-service-leaf:' || catalog.group_key || ':' || catalog.service_name),
       group_ids.id,
       catalog.service_name,
       NULL,
       catalog.icon,
       catalog.base_price,
       TRUE,
       FALSE,
       TRUE,
       TRUE
FROM catalog
JOIN group_ids ON group_ids.key = catalog.group_key
WHERE NOT EXISTS (
  SELECT 1
  FROM public.services existing
  WHERE existing.name = catalog.service_name
    AND existing.parent_service_id = group_ids.id
)
ON CONFLICT (id) DO UPDATE
SET parent_service_id = EXCLUDED.parent_service_id,
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    base_price = EXCLUDED.base_price,
    is_active = TRUE,
    visible_to_customer = FALSE,
    visible_to_admin = TRUE,
    visible_to_worker = TRUE,
    updated_at = NOW();
