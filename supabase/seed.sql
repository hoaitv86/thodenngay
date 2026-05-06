-- Seed data for Alo Thợ

-- 1. Insert Services
INSERT INTO public.services (name, description, icon, base_price) VALUES
('Sửa điện', 'Sửa chữa, lắp đặt hệ thống điện dân dụng, ổ cắm, bóng đèn.', 'ZapIcon', 250000),
('Sửa nước', 'Khắc phục sự cố đường ống, vòi nước, bồn cầu rò rỉ.', 'DropletIcon', 180000),
('Lắp camera', 'Tư vấn và lắp đặt hệ thống camera an ninh, cấu hình từ xa.', 'CameraIcon', 1200000),
('Cơ khí', 'Hàn xì, sửa cửa sắt, mái tôn, hàng rào, cầu thang.', 'CogIcon', 450000);

-- Note: User profiles and workers need to be created via Supabase Auth first 
-- to get valid UUIDs before inserting into public tables.
