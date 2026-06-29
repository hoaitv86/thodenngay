-- Safe Alotho phase-1 category layer.
-- This migration does not rename, delete, or rewrite existing services/jobs/workers/reviews.
-- Existing service_id values in jobs remain unchanged.

create table if not exists public.service_category_groups (
  id text primary key,
  name text not null,
  emoji text not null,
  icon text,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_category_mappings (
  service_id uuid not null references public.services(id) on delete cascade,
  group_id text not null references public.service_category_groups(id) on delete restrict,
  is_hidden_from_customer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (service_id, group_id)
);

create index if not exists idx_service_category_mappings_group_id
  on public.service_category_mappings(group_id);

alter table public.service_category_groups enable row level security;
alter table public.service_category_mappings enable row level security;

drop policy if exists "Anyone can view service category groups" on public.service_category_groups;
create policy "Anyone can view service category groups"
  on public.service_category_groups for select
  using (true);

drop policy if exists "Anyone can view service category mappings" on public.service_category_mappings;
create policy "Anyone can view service category mappings"
  on public.service_category_mappings for select
  using (true);

drop policy if exists "Admins can manage service category groups" on public.service_category_groups;
create policy "Admins can manage service category groups"
  on public.service_category_groups for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can manage service category mappings" on public.service_category_mappings;
create policy "Admins can manage service category mappings"
  on public.service_category_mappings for all
  using (public.is_admin())
  with check (public.is_admin());

-- Phase 1 active parent groups.
insert into public.service_category_groups (id, name, emoji, icon, sort_order, is_active)
values
  ('internet', 'Mạng Internet', '🌐', 'Network', 1, true),
  ('camera', 'Camera', '📹', 'Camera', 2, true),
  ('computer', 'Máy tính', '💻', 'Laptop', 3, true),
  ('printer', 'Máy in', '🖨️', 'Printer', 4, true)
on conflict (id) do update
set
  name = excluded.name,
  emoji = excluded.emoji,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- Previously broader parent groups are kept for historical mapping but hidden from phase-1 customer UI.
insert into public.service_category_groups (id, name, emoji, icon, sort_order, is_active)
values
  ('network_telecom', 'Mạng & Viễn thông', '🌐', 'Network', 101, false),
  ('technology', 'Công nghệ', '💻', 'Laptop', 102, false),
  ('electric', 'Điện', '⚡', 'Zap', 103, false),
  ('water', 'Nước', '🚰', 'Droplets', 104, false),
  ('hvac', 'Điện lạnh', '❄️', 'Snowflake', 105, false),
  ('construction_interior', 'Xây dựng & Nội thất', '🏠', 'Home', 106, false),
  ('cleaning', 'Vệ sinh', '🧹', 'Sparkles', 107, false),
  ('garden', 'Sân vườn', '🌳', 'Trees', 108, false),
  ('vehicle', 'Xe cộ', '🚗', 'Car', 109, false),
  ('family', 'Gia đình', '👨‍👩‍👧', 'Users', 110, false),
  ('moving_transport', 'Chuyển nhà & Vận chuyển', '📦', 'Package', 111, false),
  ('other', 'Khác', '🔧', 'Wrench', 112, false)
on conflict (id) do update
set
  name = excluded.name,
  emoji = excluded.emoji,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = false,
  updated_at = now();

-- Optional phase-1 catalog seed. Existing services are not renamed or deleted.
insert into public.services (name, description, icon, base_price, is_active)
values
  ('Lắp đặt Internet', 'Lắp mới đường truyền Internet tại nhà/văn phòng.', 'Network', 195000, true),
  ('Sửa mạng Internet', 'Kiểm tra và xử lý lỗi mất mạng, chập chờn, tốc độ yếu.', 'Network', 150000, true),
  ('Cấu hình Wi-Fi', 'Cấu hình tên/mật khẩu Wi-Fi và tối ưu vùng phủ.', 'Network', 150000, true),
  ('Mở rộng Wi-Fi Mesh', 'Lắp đặt và cấu hình hệ thống Wi-Fi Mesh.', 'Network', 350000, true),
  ('Kéo dây mạng LAN', 'Đi dây mạng LAN âm/nổi theo hiện trạng.', 'Network', 350000, true),
  ('Cấu hình Router/Modem', 'Cấu hình router, modem, bridge, PPPoE, NAT cơ bản.', 'Network', 180000, true),
  ('Bảo trì hệ thống mạng', 'Kiểm tra, dọn cấu hình và bảo trì hệ thống mạng.', 'Network', 250000, true),
  ('Lắp đặt Camera', 'Lắp mới camera quan sát.', 'Camera', 500000, true),
  ('Sửa Camera', 'Kiểm tra và sửa lỗi camera không lên hình/mất kết nối.', 'Camera', 250000, true),
  ('Bảo trì Camera', 'Vệ sinh, kiểm tra, cập nhật hệ thống camera.', 'Camera', 250000, true),
  ('Cấu hình xem từ xa', 'Cấu hình xem camera từ xa trên điện thoại/máy tính.', 'Camera', 180000, true),
  ('Di dời Camera', 'Tháo, di dời và lắp lại camera.', 'Camera', 250000, true),
  ('Nâng cấp hệ thống Camera', 'Nâng cấp đầu ghi, ổ cứng, camera hoặc cấu hình.', 'Camera', 500000, true),
  ('Cài Windows', 'Cài đặt Windows và driver cơ bản.', 'Laptop', 150000, true),
  ('Cài phần mềm', 'Cài phần mềm văn phòng, học tập, làm việc.', 'Laptop', 120000, true),
  ('Sửa PC', 'Kiểm tra và sửa lỗi máy tính bàn.', 'Laptop', 180000, true),
  ('Sửa Laptop', 'Kiểm tra và sửa lỗi laptop.', 'Laptop', 180000, true),
  ('Nâng cấp RAM/SSD', 'Tư vấn và nâng cấp RAM, SSD.', 'Laptop', 180000, true),
  ('Vệ sinh máy tính', 'Vệ sinh máy tính/laptop và thay keo tản nhiệt cơ bản.', 'Laptop', 150000, true),
  ('Cứu dữ liệu', 'Hỗ trợ cứu dữ liệu theo tình trạng thiết bị.', 'Laptop', 300000, true),
  ('Diệt virus', 'Quét và xử lý virus/malware cơ bản.', 'Laptop', 150000, true),
  ('Cài đặt máy in', 'Cài driver và kết nối máy in.', 'Printer', 120000, true),
  ('Sửa máy in', 'Kiểm tra và sửa lỗi máy in cơ bản.', 'Printer', 180000, true),
  ('Đổ mực', 'Đổ mực máy in.', 'Printer', 120000, true),
  ('Thay linh kiện', 'Thay linh kiện máy in theo tình trạng thực tế.', 'Printer', 250000, true),
  ('Chia sẻ máy in qua mạng', 'Cấu hình chia sẻ máy in qua LAN/Wi-Fi.', 'Printer', 150000, true),
  ('Bảo trì máy in', 'Bảo trì, vệ sinh, kiểm tra máy in.', 'Printer', 180000, true)
on conflict do nothing;
