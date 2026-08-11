-- Standardize Camera -> Sua chua into: system type -> component -> issue.
-- This migration is idempotent and does not delete existing services referenced by jobs.

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS parent_service_id UUID REFERENCES public.services(id) ON DELETE CASCADE;

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS visible_to_customer BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS visible_to_admin BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS visible_to_worker BOOLEAN NOT NULL DEFAULT TRUE;

WITH camera_root AS (
  INSERT INTO public.services (id, parent_service_id, name, description, icon, base_price, is_active, visible_to_customer, visible_to_admin, visible_to_worker)
  VALUES ('11111111-0000-0000-0000-000000000003'::uuid, NULL, 'Camera', 'Dich vu camera quan sat, dau ghi va tai khoan xem tu xa.', 'Camera', 0, TRUE, TRUE, TRUE, TRUE)
  ON CONFLICT (id) DO UPDATE
  SET parent_service_id = NULL,
      name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      is_active = TRUE,
      visible_to_customer = TRUE,
      visible_to_admin = TRUE,
      visible_to_worker = TRUE,
      updated_at = NOW()
  RETURNING id
), camera_repair AS (
  INSERT INTO public.services (id, parent_service_id, name, description, icon, base_price, is_active, visible_to_customer, visible_to_admin, visible_to_worker)
  VALUES (uuid_generate_v5(uuid_ns_url(), 'alotho-service-group:camera_repair'), '11111111-0000-0000-0000-000000000003'::uuid, 'Sửa chữa', 'Xu ly loi camera, dau ghi, o cung, nguon va tin hieu.', 'Wrench', 0, TRUE, TRUE, TRUE, TRUE)
  ON CONFLICT (id) DO UPDATE
  SET parent_service_id = EXCLUDED.parent_service_id,
      name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      is_active = TRUE,
      visible_to_customer = TRUE,
      visible_to_admin = TRUE,
      visible_to_worker = TRUE,
      updated_at = NOW()
  RETURNING id
), category_nodes(key, parent_key, name, description, icon) AS (
  VALUES
    ('wifi', 'camera_repair', 'Camera WiFi', 'Sua chua camera WiFi va camera doc lap ket noi ung dung.', 'Wifi'),
    ('wifi_camera', 'wifi', 'Mắt camera', 'Cum mat camera WiFi, cam bien, hong ngoai, am thanh va quay quet.', 'Camera'),
    ('wifi_power', 'wifi', 'Nguồn/adapter', 'Nguon cap va adapter camera WiFi.', 'Plug'),
    ('wifi_network', 'wifi', 'WiFi/kết nối mạng', 'Ket noi WiFi, Internet va cau hinh mang cho camera WiFi.', 'Router'),
    ('wifi_memory', 'wifi', 'Thẻ nhớ', 'The nho va luu tru cuc bo tren camera WiFi.', 'Briefcase'),
    ('wifi_account', 'wifi', 'Ứng dụng/tài khoản', 'Ung dung, tai khoan, mat khau va xem tu xa.', 'Smartphone'),

    ('ip', 'camera_repair', 'Camera IP', 'Sua chua he thong camera IP va dau ghi NVR.', 'Network'),
    ('ip_camera', 'ip', 'Mắt camera IP', 'Cum mat camera IP, ONVIF va ket noi NVR.', 'Camera'),
    ('ip_nvr', 'ip', 'Đầu ghi NVR', 'Dau ghi hinh NVR va cac kenh camera IP.', 'Settings'),
    ('ip_poe', 'ip', 'Nguồn tổng/PoE', 'Nguon tong, switch PoE va cong PoE.', 'Plug'),
    ('ip_network', 'ip', 'Mạng', 'Day LAN, RJ45, switch, Internet va cau hinh IP.', 'Cable'),
    ('ip_storage', 'ip', 'Ổ cứng', 'O cung luu tru cho NVR.', 'Briefcase'),

    ('analog', 'camera_repair', 'Camera Analog', 'Sua chua he thong camera Analog, DVR va XVR.', 'Cctv'),
    ('analog_camera', 'analog', 'Mắt camera', 'Cum mat camera Analog va tin hieu hinh anh.', 'Camera'),
    ('analog_dvr', 'analog', 'Đầu ghi DVR/XVR', 'Dau ghi DVR/XVR va cac kenh camera analog.', 'Settings'),
    ('analog_power', 'analog', 'Nguồn tổng', 'Nguon tong va cap nguon cho camera analog.', 'Plug'),
    ('analog_signal', 'analog', 'Dây/tín hiệu', 'Day tin hieu, BNC, jack nguon va Balun.', 'Cable'),
    ('analog_storage', 'analog', 'Ổ cứng', 'O cung luu tru cho DVR/XVR.', 'Briefcase')
), inserted_categories AS (
  INSERT INTO public.services (id, parent_service_id, name, description, icon, base_price, is_active, visible_to_customer, visible_to_admin, visible_to_worker)
  SELECT uuid_generate_v5(uuid_ns_url(), 'alotho-camera-repair:' || node.key),
         CASE
           WHEN node.parent_key = 'camera_repair' THEN uuid_generate_v5(uuid_ns_url(), 'alotho-service-group:camera_repair')
           ELSE uuid_generate_v5(uuid_ns_url(), 'alotho-camera-repair:' || node.parent_key)
         END,
         node.name,
         node.description,
         node.icon,
         0,
         TRUE,
         FALSE,
         TRUE,
         TRUE
  FROM category_nodes node
  WHERE NOT EXISTS (
    SELECT 1 FROM public.services existing
    WHERE existing.parent_service_id = CASE
      WHEN node.parent_key = 'camera_repair' THEN uuid_generate_v5(uuid_ns_url(), 'alotho-service-group:camera_repair')
      ELSE uuid_generate_v5(uuid_ns_url(), 'alotho-camera-repair:' || node.parent_key)
    END
      AND existing.name = node.name
  )
  ON CONFLICT (id) DO UPDATE
  SET parent_service_id = EXCLUDED.parent_service_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      base_price = 0,
      is_active = TRUE,
      visible_to_customer = FALSE,
      visible_to_admin = TRUE,
      visible_to_worker = TRUE,
      updated_at = NOW()
  RETURNING id
), legacy_moves(old_name, target_key, new_name, icon) AS (
  VALUES
    ('Camera mất hình', 'analog_camera', 'Mất hình', 'Wrench'),
    ('Camera mờ', 'analog_camera', 'Mờ', 'Wrench'),
    ('Camera không lên nguồn', 'wifi_camera', 'Không lên nguồn', 'Wrench'),
    ('Camera ngoại tuyến', 'wifi_camera', 'Offline/mất kết nối WiFi', 'Wrench'),
    ('Đầu ghi lỗi', 'ip_nvr', 'Đầu ghi lỗi', 'Settings'),
    ('Không xem được từ xa', 'wifi_account', 'Không xem từ xa', 'Phone'),
    ('Ổ cứng lỗi', 'ip_storage', 'Lỗi', 'Briefcase'),
    ('Không ghi hình', 'ip_nvr', 'Không ghi hình', 'Settings'),
    ('Lỗi nguồn', 'wifi_power', 'Nguồn/adapter lỗi', 'Plug'),
    ('Lỗi dây tín hiệu', 'analog_signal', 'Lỗi dây tín hiệu', 'Cable')
), moved_legacy AS (
  UPDATE public.services service
  SET parent_service_id = uuid_generate_v5(uuid_ns_url(), 'alotho-camera-repair:' || legacy_moves.target_key),
      name = legacy_moves.new_name,
      icon = legacy_moves.icon,
      is_active = TRUE,
      visible_to_admin = TRUE,
      visible_to_worker = TRUE,
      updated_at = NOW()
  FROM legacy_moves
  WHERE service.parent_service_id = uuid_generate_v5(uuid_ns_url(), 'alotho-service-group:camera_repair')
    AND service.name = legacy_moves.old_name
    AND NOT EXISTS (
      SELECT 1 FROM public.services existing
      WHERE existing.parent_service_id = uuid_generate_v5(uuid_ns_url(), 'alotho-camera-repair:' || legacy_moves.target_key)
        AND existing.name = legacy_moves.new_name
        AND existing.id <> service.id
    )
  RETURNING service.id
), fault_nodes(parent_key, name, icon, base_price) AS (
  VALUES
    ('wifi_camera', 'Không lên nguồn', 'Wrench', 250000),
    ('wifi_camera', 'Offline/mất kết nối WiFi', 'Wifi', 180000),
    ('wifi_camera', 'Không xem được', 'Phone', 180000),
    ('wifi_camera', 'Hình mờ/giật', 'Camera', 180000),
    ('wifi_camera', 'Lỗi hồng ngoại', 'Camera', 180000),
    ('wifi_camera', 'Lỗi âm thanh/đàm thoại', 'Phone', 180000),
    ('wifi_camera', 'Lỗi quay quét', 'Settings', 180000),
    ('wifi_camera', 'Lỗi phát hiện chuyển động', 'Settings', 180000),
    ('wifi_power', 'Nguồn/adapter lỗi', 'Plug', 180000),
    ('wifi_network', 'Lỗi WiFi/kết nối mạng', 'Wifi', 180000),
    ('wifi_memory', 'Không nhận thẻ nhớ', 'Briefcase', 180000),
    ('wifi_memory', 'Không lưu thẻ nhớ', 'Briefcase', 180000),
    ('wifi_memory', 'Không xem lại thẻ nhớ', 'Briefcase', 180000),
    ('wifi_memory', 'Thẻ lỗi/đầy', 'Briefcase', 180000),
    ('wifi_account', 'Không kết nối app', 'Smartphone', 180000),
    ('wifi_account', 'Không xem từ xa', 'Phone', 180000),
    ('wifi_account', 'Quên mật khẩu/reset', 'Users', 180000),

    ('ip_camera', 'Mất nguồn', 'Plug', 250000),
    ('ip_camera', 'Offline/mất hình', 'Network', 180000),
    ('ip_camera', 'Hình mờ/giật', 'Camera', 180000),
    ('ip_camera', 'Lỗi hồng ngoại', 'Camera', 180000),
    ('ip_camera', 'Lỗi âm thanh', 'Phone', 180000),
    ('ip_camera', 'Lỗi IP/ONVIF', 'Network', 180000),
    ('ip_camera', 'Không kết nối NVR', 'Settings', 180000),
    ('ip_nvr', 'Không lên nguồn', 'Plug', 250000),
    ('ip_nvr', 'Không nhận camera', 'Camera', 250000),
    ('ip_nvr', 'Mất kênh', 'Settings', 250000),
    ('ip_nvr', 'Không nhận ổ cứng', 'Briefcase', 250000),
    ('ip_nvr', 'Không ghi hình', 'Settings', 250000),
    ('ip_nvr', 'Không xem lại', 'Settings', 180000),
    ('ip_nvr', 'Lỗi HDMI/VGA', 'Monitor', 180000),
    ('ip_nvr', 'Mất mạng', 'Network', 180000),
    ('ip_nvr', 'Không xem từ xa', 'Phone', 180000),
    ('ip_nvr', 'Quên mật khẩu', 'Users', 180000),
    ('ip_nvr', 'Sai ngày giờ', 'Clock', 180000),
    ('ip_nvr', 'Tự khởi động lại', 'Settings', 250000),
    ('ip_poe', 'Nguồn tổng hỏng/yếu/sụt áp', 'Plug', 250000),
    ('ip_poe', 'Mất nguồn camera', 'Plug', 180000),
    ('ip_poe', 'Switch PoE lỗi', 'Network', 250000),
    ('ip_poe', 'Cổng PoE lỗi', 'Network', 180000),
    ('ip_network', 'Dây LAN lỗi', 'Cable', 180000),
    ('ip_network', 'RJ45 lỗi', 'Cable', 180000),
    ('ip_network', 'Switch lỗi', 'Network', 180000),
    ('ip_network', 'Internet lỗi', 'Router', 180000),
    ('ip_network', 'Xung đột IP/cấu hình mạng', 'Network', 180000),
    ('ip_storage', 'Không nhận ổ cứng', 'Briefcase', 250000),
    ('ip_storage', 'Lỗi', 'Briefcase', 250000),
    ('ip_storage', 'Đầy', 'Briefcase', 180000),
    ('ip_storage', 'Không ghi hình', 'Briefcase', 250000),
    ('ip_storage', 'Không xem lại', 'Briefcase', 180000),
    ('ip_storage', 'Thay ổ cứng', 'Briefcase', 250000),

    ('analog_camera', 'Mất hình', 'Camera', 250000),
    ('analog_camera', 'Nhiễu/sọc', 'Camera', 180000),
    ('analog_camera', 'Mờ', 'Camera', 180000),
    ('analog_camera', 'Sai/mất màu', 'Camera', 180000),
    ('analog_camera', 'Lỗi hồng ngoại', 'Camera', 180000),
    ('analog_camera', 'Chập chờn', 'Camera', 180000),
    ('analog_dvr', 'Không lên nguồn', 'Plug', 250000),
    ('analog_dvr', 'Không nhận camera', 'Camera', 250000),
    ('analog_dvr', 'Mất kênh', 'Settings', 250000),
    ('analog_dvr', 'Không nhận ổ cứng', 'Briefcase', 250000),
    ('analog_dvr', 'Không ghi hình', 'Settings', 250000),
    ('analog_dvr', 'Không xem lại', 'Settings', 180000),
    ('analog_dvr', 'Lỗi HDMI/VGA', 'Monitor', 180000),
    ('analog_dvr', 'Mất mạng', 'Network', 180000),
    ('analog_dvr', 'Không xem từ xa', 'Phone', 180000),
    ('analog_dvr', 'Quên mật khẩu', 'Users', 180000),
    ('analog_dvr', 'Sai ngày giờ', 'Clock', 180000),
    ('analog_dvr', 'Tự khởi động lại', 'Settings', 250000),
    ('analog_power', 'Nguồn hỏng/yếu/sụt áp', 'Plug', 250000),
    ('analog_power', 'Cháy cầu chì', 'Plug', 180000),
    ('analog_power', 'Hỏng ngõ nguồn', 'Plug', 180000),
    ('analog_power', 'Mất nguồn camera', 'Plug', 180000),
    ('analog_power', 'Chập nguồn', 'Plug', 250000),
    ('analog_signal', 'Đứt dây', 'Cable', 180000),
    ('analog_signal', 'Suy hao tín hiệu', 'Cable', 180000),
    ('analog_signal', 'Lỗi BNC', 'Cable', 180000),
    ('analog_signal', 'Lỗi jack nguồn', 'Plug', 180000),
    ('analog_signal', 'Chập dây', 'Cable', 250000),
    ('analog_signal', 'Nhiễu tín hiệu', 'Cable', 180000),
    ('analog_signal', 'Lỗi Balun', 'Cable', 180000),
    ('analog_storage', 'Không nhận ổ cứng', 'Briefcase', 250000),
    ('analog_storage', 'Lỗi', 'Briefcase', 250000),
    ('analog_storage', 'Không ghi hình', 'Briefcase', 250000),
    ('analog_storage', 'Không xem lại', 'Briefcase', 180000),
    ('analog_storage', 'Thay ổ cứng', 'Briefcase', 250000)
)
INSERT INTO public.services (id, parent_service_id, name, description, icon, base_price, is_active, visible_to_customer, visible_to_admin, visible_to_worker)
SELECT uuid_generate_v5(uuid_ns_url(), 'alotho-camera-repair-issue:' || fault.parent_key || ':' || fault.name),
       uuid_generate_v5(uuid_ns_url(), 'alotho-camera-repair:' || fault.parent_key),
       fault.name,
       NULL,
       fault.icon,
       fault.base_price,
       TRUE,
       FALSE,
       TRUE,
       TRUE
FROM fault_nodes fault
WHERE NOT EXISTS (
  SELECT 1 FROM public.services existing
  WHERE existing.parent_service_id = uuid_generate_v5(uuid_ns_url(), 'alotho-camera-repair:' || fault.parent_key)
    AND existing.name = fault.name
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
