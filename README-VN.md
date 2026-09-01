# Hướng dẫn Vibe Coding dự án "Alo Thợ" với Antigravity

Tài liệu này cung cấp các nguyên tắc, chuẩn mực và hướng dẫn chi tiết để bạn (hoặc bất kỳ ai) có thể sử dụng Antigravity AI (Agentic Coding Assistant) để tiếp tục phát triển, bảo trì và mở rộng dự án **Alo Thợ** một cách nhất quán và hiệu quả nhất.

---

## 1. Tổng quan dự án (Project Overview)
**Alo Thợ** là nền tảng gọi thợ sửa chữa, bảo trì tại nhà (On-demand Home Services).
Hệ thống được thiết kế theo kiến trúc "All-in-one", bao gồm 3 phân hệ (roles) chính hoạt động chung trên một single-app codebase:
- **Khách hàng (Customer):** Đặt lịch, tìm kiếm dịch vụ, theo dõi tiến độ (`/customer/*`)
- **Thợ (Worker):** Nhận việc, chỉ đường, gọi khách, xem thu nhập (`/worker/*`)
- **Quản trị viên (Admin):** Phân công công việc, quản lý danh mục, xét duyệt thợ (`/admin/*`)

---

## 2. Tech Stack Core (Công nghệ cốt lõi)
Khi yêu cầu Antigravity phát triển tính năng mới, hãy luôn bám sát các công nghệ sau:
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS (phiên bản v4) + Vanilla CSS (trong `globals.css`)
- **Backend & Database:** Supabase (Sử dụng `@supabase/supabase-js` và `@supabase/ssr`)
- **Icons:** `lucide-react` (được map qua file `app/components/icons.tsx` để quản lý tập trung)
- **State Management:** `useState`, `useEffect` (React Hooks cơ bản)
- **Deployment:** Vercel (Dự kiến)

---

## 3. Design System & UI/UX Guidelines (Bắt buộc)
Để duy trì tính nhất quán (Vibe) của Alo Thợ, hãy yêu cầu Antigravity tuân thủ nghiêm ngặt các quy tắc thiết kế sau:

### 3.1. Màu sắc & Hệ thống thẻ (Design Tokens)
Dự án sử dụng bộ token thiết kế (Design Tokens) được cấu hình sẵn trong `app/globals.css`. Tuyệt đối không dùng mã màu Hex cứng trong các component (ngoại trừ Header đặc thù).
- **Backgrounds:** Sử dụng `bg-surface`, `bg-surface-container-lowest`, `bg-surface-container-low` để phân lớp chiều sâu.
- **Text:** Dùng `text-on-surface` (Văn bản chính), `text-on-surface-variant` (Văn bản phụ/mờ).
- **Thương hiệu:** `text-primary-container`, `bg-primary-container` (Màu xanh dương chủ đạo).
- **Trạng thái:** Dùng `bg-success-container text-on-success-container` (Thành công/Hoàn thành), `bg-error-container text-on-error-container` (Lỗi/Hủy).

### 3.2. Form Factor (Kích thước hiển thị)
- Phân hệ **Customer** và **Worker** được thiết kế ưu tiên giao diện Mobile (Mobile-first). Mọi thẻ bọc ngoài cùng của Layout cần có class: `max-w-md mx-auto` để mô phỏng màn hình điện thoại khi xem trên máy tính.
- Phân hệ **Admin** được thiết kế cho màn hình Desktop, có Sidebar cố định bên trái và Content bên phải.

### 3.3. Các Component & Tiện ích tiêu chuẩn
- **Nút bấm (Buttons):** Sử dụng các class `btn-primary`, `btn-secondary`, `btn-outline` thay vì viết lại các class Tailwind thủ công.
- **Thẻ (Cards):** Sử dụng `card`, `card-elevated` để bọc các phần tử danh sách (Jobs, Services, Workers).
- **Biểu tượng (Icons):** **BẮT BUỘC** import từ `app/components/icons.tsx` (VD: `ZapIcon`, `BriefcaseIcon`), không import trực tiếp từ `lucide-react` trong các page để dễ đồng bộ stroke và kích thước.
- **Hiệu ứng (Animations):** Thường xuyên sử dụng `animate-fade-in`, `animate-fade-in-up`, `transition-colors`, `hover:scale-[1.02]` để tạo cảm giác "Premium", mượt mà (Dynamic UI).
- **Toast Notifications:** Sử dụng Custom Toast (Ví dụ trong `app/customer/booking/page.tsx`) thay vì dùng hàm `alert()` của trình duyệt.

---

## 4. Hướng dẫn Prompt Antigravity hiệu quả (Vibe Coding Guide)

Khi trò chuyện và giao việc cho Antigravity, hãy sử dụng các cấu trúc prompt sau để AI nắm bắt đúng "Vibe" của codebase:

### Mẫu Prompt thêm tính năng mới
> *"Hãy implement trang [Tên trang] tại đường dẫn `/[role]/[path]`. Yêu cầu: Tuân thủ Design System hiện tại (sử dụng card-elevated, các token text-on-surface). Lấy data từ Supabase bảng `[table_name]`. Nhớ thêm hiệu ứng animate-fade-in cho các danh sách."*

### Mẫu Prompt sửa lỗi UI/UX
> *"Trên trang `/[path]`, khi hiển thị danh sách [Item], nút bấm đang bị lệch và chưa có bo góc chuẩn. Hãy sửa lại theo Vibe của dự án: dùng class `btn-primary`, bo góc `rounded-xl`, và thay thế alert() bằng Custom Toast thông báo."*

### Mẫu Prompt tích hợp Supabase Database
> *"Hãy sửa hàm fetch data trong file `app/admin/jobs/page.tsx`. Khi select bảng `jobs`, cần join với bảng `profiles` để lấy tên khách hàng. **Lưu ý:** Phải sử dụng cú pháp `customer:profiles!customer_id(*)` để tránh lỗi Multiple Relationship của PostgREST."*

---

## 5. Những lưu ý Quan Trọng (Watch-outs)

1. **Lỗi Khóa Ngoại (Foreign Key Ambiguity):** Bảng `jobs` nối với bảng `profiles` qua 2 cột (`customer_id` và `created_by`). Khi query bằng Supabase, phải LUÔN khai báo rõ tên khóa ngoại: `.select('*, customer:profiles!customer_id(*)')`.
2. **Optimistic UI:** Khi thực hiện các tác vụ như "Gán thợ", "Hoàn thành Job", hãy yêu cầu Antigravity xử lý state ở Local (React State) ngay lập tức để cập nhật UI, không cần đợi `fetchData` chạy lại để đảm bảo tốc độ phản hồi < 100ms.
3. **Cấu trúc Thư mục:**
   - `/app/admin`: Code của Quản trị viên (Desktop View).
   - `/app/worker`: Code của Thợ (Mobile View - `max-w-md`).
   - `/app/customer`: Code của Khách hàng (Mobile View - `max-w-md`).
   - `/app/components`: Chứa UI Components dùng chung và `icons.tsx`.
   - `/lib`: Chứa configs (`supabase/client.ts`) và định nghĩa kiểu dữ liệu (`types.ts`).

Chúc bạn có những trải nghiệm "Vibe Coding" thật thăng hoa cùng Antigravity để sớm hoàn thiện Alo Thợ v1.0! 🚀
