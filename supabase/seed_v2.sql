-- ===== ALO THỢ COMPREHENSIVE SEED (PHASE 1) =====
-- Note: This script seeds Services and provides templates for Users.
-- If running on Supabase Cloud, you should create users via the Auth UI 
-- or use the Admin API to get valid Auth IDs.

-- 1. CLEANUP (Optional - Be careful)
-- TRUNCATE public.services, public.profiles, public.workers CASCADE;

-- 2. INSERT SERVICES
INSERT INTO public.services (id, name, description, icon, base_price) VALUES
('11111111-0000-0000-0000-000000000001', 'Sửa điện', 'Sửa chữa, lắp đặt hệ thống điện dân dụng, ổ cắm, bóng đèn.', 'ZapIcon', 250000),
('11111111-0000-0000-0000-000000000002', 'Sửa nước', 'Khắc phục sự cố đường ống, vòi nước, bồn cầu rò rỉ.', 'DropletIcon', 180000),
('11111111-0000-0000-0000-000000000003', 'Lắp camera', 'Tư vấn và lắp đặt hệ thống camera an ninh, cấu hình từ xa.', 'CameraIcon', 1200000),
('11111111-0000-0000-0000-000000000004', 'Cơ khí', 'Hàn xì, sửa cửa sắt, mái tôn, hàng rào, cầu thang.', 'CogIcon', 450000)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, base_price = EXCLUDED.base_price;

-- 3. MOCK PROFILES & WORKERS
-- Replace these UUIDs with actual ones from your auth.users table
-- ADMIN
INSERT INTO public.profiles (id, email, full_name, role) 
VALUES ('9c32c41d-a59b-4373-a19d-8f34a5adf633', 'admin@alotho.vn', 'Admin Hệ Thống', 'admin')
ON CONFLICT (id) DO NOTHING;

-- WORKER (Nguyễn Văn Thợ)
INSERT INTO public.profiles (id, email, full_name, role) 
VALUES ('6b41871d-78b3-4961-b75d-d810fdb437e8', 'worker@alotho.vn', 'Nguyễn Văn Thợ', 'worker')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workers (id, user_id, specialties, status, avg_rating, total_jobs)
VALUES ('22222222-0000-0000-0000-000000000001', '6b41871d-78b3-4961-b75d-d810fdb437e8', ARRAY['Sửa điện', 'Sửa nước'], 'active', 4.9, 12)
ON CONFLICT (id) DO NOTHING;

-- CUSTOMER (Lê Thị Khách)
INSERT INTO public.profiles (id, email, full_name, role) 
VALUES ('cdb76834-b838-4a07-85ee-e32ec6584d46', 'customer@alotho.vn', 'Lê Thị Khách', 'customer')
ON CONFLICT (id) DO NOTHING;

-- 4. INSERT MOCK JOBS (For Testing Worker Dashboard)
-- VIỆC MỚI (Pending)
INSERT INTO public.jobs (job_code, customer_id, service_id, address, scheduled_at, quoted_price, status, source, created_by)
VALUES 
('JOB-9402', 'cdb76834-b838-4a07-85ee-e32ec6584d46', '11111111-0000-0000-0000-000000000001', '15 Lê Lợi, Q.1', now() + interval '2 hours', 250000, 'pending', 'app', 'cdb76834-b838-4a07-85ee-e32ec6584d46'),
('JOB-9405', 'cdb76834-b838-4a07-85ee-e32ec6584d46', '11111111-0000-0000-0000-000000000002', '202 Nguyễn Huệ, Q.1', now() + interval '4 hours', 180000, 'pending', 'app', 'cdb76834-b838-4a07-85ee-e32ec6584d46')
ON CONFLICT (job_code) DO NOTHING;

-- VIỆC ĐANG LÀM (Assigned/In Progress)
INSERT INTO public.jobs (job_code, customer_id, worker_id, service_id, address, scheduled_at, quoted_price, status, source, created_by)
VALUES 
('JOB-9401', 'cdb76834-b838-4a07-85ee-e32ec6584d46', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', '456 CMT8, Q.3', now() - interval '1 hour', 180000, 'in_progress', 'app', 'cdb76834-b838-4a07-85ee-e32ec6584d46')
ON CONFLICT (job_code) DO NOTHING;

