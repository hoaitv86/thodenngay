# PERFORMANCE REPORT - Tho Den Ngay

Ngay kiem tra: 2026-07-16  
Pham vi: Next.js 16.2.4 + React 19.2.4 + Supabase, build production local.  
Cam ket: Khong sua chuc nang, khong doi giao dien, khong tao commit.

## 1. Tom tat ket qua do

### Build production

- Lenh: `npm run build`
- Ket qua: build thanh cong.
- Compile: 31.5s
- TypeScript: 32.7s
- Static pages: 44 pages, 9.8s
- Canh bao build: homepage khong fetch duoc `system_settings` va `services` trong luc prerender (`TypeError: fetch failed`). Trang dung fallback nen van build duoc, nhung day la rui ro ve cache/du lieu va TTFB khi Supabase cham hoac khong san sang.

### TTFB/HTTP local production

Do bang `curl` tren `next start -p 3000`.

| Route | HTTP | TTFB | Total | Ghi chu |
|---|---:|---:|---:|---|
| `/` | 200 | 172 ms | 172 ms | HTML 118 KB, `x-nextjs-cache: HIT` |
| `/customer/home` | 307 | 5 ms | 5 ms | Redirect `/login` do chua dang nhap |
| `/worker` | 307 | 17 ms | 17 ms | Redirect `/login` do chua dang nhap |
| `/admin/dashboard` | 307 | 3 ms | 3 ms | Redirect `/login` do chua dang nhap |
| `/customer/booking` | 307 | 3 ms | 3 ms | Redirect `/login` do chua dang nhap |

### Core Web Vitals

Khong the lay FCP/LCP/CLS/INP truc tiep trong in-app browser vi runtime chan `window.performance.getEntriesByType`. Du an cung chua co Lighthouse/Playwright/Puppeteer trong `node_modules`, va network bi gioi han nen khong cai them cong cu.

Danh gia kha dung hien tai:

| Metric | Ket qua lab hien co | Danh gia |
|---|---:|---|
| TTFB | 172 ms cho `/`; 3-17 ms cho redirect auth | Tot tren local |
| FCP | Chua do duoc | Can Lighthouse hoac RUM |
| LCP | Chua do duoc | Co nguy co do hero image 1.65 MB |
| CLS | Chua do duoc | Co nguy co thap-vua do nhieu `<img>` thuong neu khong co width/height |
| INP | Chua do duoc | Co nguy co o cac trang client component lon va polling/re-render nhieu |

## 2. Bundle JS/CSS

Tu `.next/static` sau production build:

- Tong JS raw: 1,991,755 bytes
- Tong JS gzip uoc tinh: 561,203 bytes
- Tong CSS raw: 173,567 bytes
- Tong CSS gzip uoc tinh: 24,874 bytes
- Tong JS + CSS raw: 2,165,322 bytes
- Tong JS + CSS gzip uoc tinh: 586,077 bytes

Chunk lon nhat:

| File | Raw | Gzip uoc tinh |
|---|---:|---:|
| `.next/static/chunks/13sbut6zak3~6.js` | 237,950 B | 62,095 B |
| `.next/static/chunks/10~x95jhs6ns3.js` | 227,314 B | 70,981 B |
| `.next/static/chunks/0f.p9dhf0x~j1.css` | 173,567 B | 24,874 B |
| `.next/static/chunks/0t7_.tsh-cri3.js` | 137,207 B | 37,328 B |
| `.next/static/chunks/03~yq9q893hmn.js` | 112,594 B | 39,627 B |

Van de:
- Gan nhu tat ca route lon la client component (`"use client"` o hon 40 file page/layout/component).
- JS can hydrate nhieu hon muc can thiet, dac biet cac trang dashboard, worker, admin, chat.

Nguyen nhan:
- Nhieu page dung Supabase browser client va `useEffect` fetch du lieu o client.
- Chua thay `next/dynamic`, `React.lazy`, hoac code splitting theo widget/modal lon.

Muc do anh huong:
- Cao tren mobile/ket noi yeu: tang thoi gian parse/execute JS, co the anh huong FCP/INP.

Cach khac phuc:
- Chuyen cac phan chi doc du lieu sang Server Component/Route Handler neu phu hop.
- Tach modal/form/chat/dashboard widget bang `next/dynamic`.
- Chi de `"use client"` o component can tuong tac, khong dat o toan bo page neu khong can.

Muc cai thien du kien:
- Giam 20-40% JS route dau tien cho cac trang nang.
- INP co the cai thien 10-30% tuy thiet bi.

## 3. React render nhieu lan khong can thiet

### `app/worker/page.tsx`

Van de:
- File rat lon, page client duy nhat quan ly nhieu state, fetch, realtime, interval.
- `fetchData()` duoc goi luc mount, moi 8 giay, va khi realtime `jobs` thay doi.
- Moi lan fetch co nhieu `setState`, tinh thong ke job/rating/income tren client.

Nguyen nhan:
- Dashboard worker gom nhieu domain trong mot component.
- Polling 8 giay song song voi Supabase realtime.

Muc do anh huong:
- Cao. De gay render lap lai, request trung lap, INP xau khi danh sach job lon.

Cach khac phuc:
- Tach page thanh cac component nho memoized.
- Dung realtime de invalidate/throttle thay vi polling co dinh 8 giay.
- Gom state cap nhat bang reducer hoac mot lan set state.
- Dua aggregation income/rating sang SQL/RPC.

Muc cai thien du kien:
- Giam 30-60% so lan render/request nen o dashboard worker.

### `app/components/ChatWorkspace.tsx`

Van de:
- Polling tin nhan moi 6 giay cho conversation dang mo.
- Fetch conversations sau khi gui tin.
- Nhieu state rieng le (`participants`, `conversations`, `messages`, `onlineProfileIds`, `loading...`) co the render lien tiep.

Nguyen nhan:
- Chat dang dung polling thay vi Supabase realtime cho `chat_messages`.

Muc do anh huong:
- Trung binh-Cao neu chat co nhieu nguoi/tin nhan.

Cach khac phuc:
- Dung realtime channel cho `chat_messages` theo `conversation_id`.
- Phan trang tin nhan, chi lay 50-100 tin moi nhat.
- Memoize `filteredParticipants`, `onlineParticipantCount`.

Muc cai thien du kien:
- Giam 50-80% request nen cua man chat.

### `app/admin/dashboard/page.tsx`

Van de:
- Tao `const supabase = createClient()` trong body component.
- `fetchDashboardData()` chay 5 query Supabase rieng le va nhieu `setState`.

Nguyen nhan:
- Chua memoize Supabase client va chua gom query.

Muc do anh huong:
- Trung binh.

Cach khac phuc:
- Memoize Supabase client.
- Gom count vao RPC/view hoac `Promise.all`.
- Set state mot lan sau khi du lieu san sang.

Muc cai thien du kien:
- Giam 20-40% thoi gian load dashboard admin.

## 4. Truy van Supabase

### Query lay qua nhieu du lieu

1. `app/admin/jobs/page.tsx`

Van de:
- Query `jobs.select('*, customer:profiles!customer_id(*), service:services!jobs_service_id_fkey(*), job_services(service:services(*)), worker:workers(profiles(full_name))')` khong co `.limit()`/pagination.

Nguyen nhan:
- Lay tat ca job va nested relation bang `*`.

Muc do anh huong:
- Cao khi bang `jobs` tang. Payload lon, sort cham, hydrate cham.

Cach khac phuc:
- Them pagination/range.
- Chi select cac cot can hien thi.
- Them index cho `(created_at DESC)`, `(status, created_at DESC)`, `customer_id`, `worker_id`.

Muc cai thien du kien:
- Giam 50-90% payload va thoi gian query o trang admin jobs.

2. `app/admin/customers/page.tsx`

Van de:
- Query `profiles.select("*, jobs!customer_id(...)")` va query jobs/receivables phu tro khong thay pagination.

Nguyen nhan:
- Lay danh sach khach hang va relation tong quat bang `*`.

Muc do anh huong:
- Cao khi co nhieu customer/job.

Cach khac phuc:
- Pagination theo customer.
- Dung aggregate view/RPC cho tong no/tong job.
- Select cot cu the.

Muc cai thien du kien:
- Giam 40-80% payload.

3. `app/worker/history/page.tsx`, `app/worker/customers/page.tsx`, `app/customer/jobs/page.tsx`

Van de:
- Lay danh sach job theo worker/customer va order theo `updated_at`/`created_at`, chua thay `.limit()`.

Nguyen nhan:
- Danh sach lich su tang vo han.

Muc do anh huong:
- Trung binh-Cao.

Cach khac phuc:
- Pagination theo cursor.
- Index theo `(worker_id, updated_at DESC)`, `(customer_id, created_at DESC)`.

Muc cai thien du kien:
- Giam 30-70% thoi gian load danh sach.

### Query co nguy co cham

1. Counts trong `app/admin/dashboard/page.tsx`

Van de:
- 4 query count rieng: total jobs, pending jobs, completed jobs, active workers.

Nguyen nhan:
- Count exact tren bang lon, lap lai moi lan vao dashboard.

Muc do anh huong:
- Trung binh, tang len Cao khi jobs lon.

Cach khac phuc:
- Dung materialized view/RPC thong ke.
- Cache server-side ngan han.
- Index `jobs(status)` va `workers(status)`.

Muc cai thien du kien:
- Giam 30-60% TTFB/dashboard data load.

2. `app/api/worker/billgo/route.ts`

Van de:
- Query `billgo_receivables` select nested rat sau: subscription, payments, cycle changes, status events; order theo `due_date`.

Nguyen nhan:
- Lay toan bo du lieu lifecycle trong mot response.

Muc do anh huong:
- Cao neu BillGo co nhieu ky/cuoc/lich su.

Cach khac phuc:
- Pagination theo thang/status.
- Tach detail/history khi mo row.
- Them index phu hop: `(worker_id, due_date)`, `(status, due_date)`, `(subscription_id, due_date)`.

Muc cai thien du kien:
- Giam 40-75% payload trang BillGo.

### Index nen them

Schema goc `supabase/schema.sql` hau nhu chua co index ngoai primary/unique key. Cac index nen xem xet:

- `jobs(customer_id, created_at DESC)`
- `jobs(worker_id, updated_at DESC)`
- `jobs(status, created_at DESC)`
- `jobs(scheduled_at)`
- `jobs(service_id)`
- `workers(user_id)`
- `workers(status, avg_rating DESC, total_jobs DESC)`
- `profiles(role, created_at DESC)`
- `profiles(phone)` neu dang lookup phone trong login/resolve-phone
- `services(is_active, name)`
- `services(parent_service_id)`
- `ratings(worker_id, created_at DESC)`
- `payments(job_id, status, paid_at DESC)`
- `billgo_receivables(worker_id, due_date)`
- `billgo_receivables(status, due_date)`
- `billgo_receivables(subscription_id, due_date)`
- `billgo_subscriptions(worker_id, status, deleted_at)`
- `worker_inventory_products(worker_id, updated_at DESC)`

Muc cai thien du kien:
- Query filter/sort lon co the nhanh hon 2-10 lan tuy so dong va selectivity.

## 5. Anh va tai nguyen tinh

### Anh lon

| File | Kich thuoc | Van de |
|---|---:|---|
| `public/hero-technician.png` | 1,648,717 B | Qua lon cho hero mobile/desktop |
| `public/logo.svg` | 290,426 B | SVG logo qua nang |
| `app/public android-chrome-512x512.png` duplicates | 190,151 B x 3 | Trung lap asset |

Van de:
- `hero-technician.png` duoc dung bang `<img src="/hero-technician.png">` trong `app/customer/home/page.tsx`, khong qua `next/image`.
- Header cho `/hero-technician.png`: `Cache-Control: public, max-age=0`, khong cache dai han.

Nguyen nhan:
- File dat trong `public` va Next mac dinh cache `max-age=0`.
- Dung `<img>` nen khong co automatic image optimization/sizes/placeholder.

Muc do anh huong:
- Cao cho LCP va bandwidth, dac biet trang customer home.

Cach khac phuc:
- Chuyen hero sang WebP/AVIF responsive.
- Dung `next/image` voi `sizes`, width/height, priority neu la LCP.
- Cache static image fingerprinted hoac CDN cache dai han.
- Rut gon `logo.svg`.

Muc cai thien du kien:
- Giam 60-85% bytes anh hero.
- LCP trang customer home co the nhanh hon 300-1200 ms tren mobile.

### CSS/JS nang

Van de:
- CSS raw 173 KB, JS raw gan 2 MB.

Nguyen nhan:
- Nhieu route la client component, dashboard/form/chat nam trong initial JS.

Muc do anh huong:
- Trung binh-Cao.

Cach khac phuc:
- Tach route-level widget/modal bang dynamic import.
- Giam client surface.

Muc cai thien du kien:
- Giam 100-300 KB gzip JS tren route nang neu tach dung cho.

## 6. Lazy Loading va Code Splitting

Ket qua kiem tra:
- Chi thay `loading="lazy"` o mot vi tri trong `app/worker/page.tsx`.
- Khong thay `next/dynamic`, `React.lazy`, dynamic component splitting.
- Co `Suspense` o `register` va `customer/booking`, chu yeu de boc `useSearchParams`.

Van de:
- Modal, chat, dashboard charts/list, forms lon co kha nang vao initial bundle.

Nguyen nhan:
- Chua ap dung code splitting cho UI it dung ngay.

Muc do anh huong:
- Trung binh-Cao.

Cach khac phuc:
- Dynamic import cho ChatWorkspace, BillGo forms, inventory forms, admin assignment modal, worker completion modal.
- Lazy load anh preview/upload.

Muc cai thien du kien:
- Giam 15-35% JS route dau tien cho cac khu vuc admin/worker.

## 7. Cache trinh duyet

Ket qua header:

- `/`: `Cache-Control: s-maxage=300, stale-while-revalidate=31535700`, `x-nextjs-cache: HIT`.
- `/_next/static/chunks/...js`: `Cache-Control: public, max-age=31536000, immutable`.
- `/hero-technician.png`: `Cache-Control: public, max-age=0`.

Van de:
- Next static chunks cache tot.
- Anh trong `public` khong cache dai han.
- Homepage co ISR 5 phut nhung build log cho thay fetch Supabase co the fail va dung fallback.

Nguyen nhan:
- Chua co custom headers trong `next.config.ts` cho static image.
- Homepage phu thuoc Supabase khi prerender/cache refresh.

Muc do anh huong:
- Trung binh.

Cach khac phuc:
- Them cache headers cho anh fingerprinted/static.
- Chuyen image sang duong dan co hash hoac dung CDN.
- Theo doi loi fetch Supabase khi ISR refresh.

Muc cai thien du kien:
- Repeat visit giam 1.6 MB download hero.

## 8. Package khong con su dung

Dependencies trong `package.json`:

- `@supabase/ssr`: co dung.
- `@supabase/supabase-js`: co dung.
- `lucide-react`: co dung.
- `next`: co dung.
- `react`: co dung.
- `react-dom`: can cho Next/React.
- `zustand`: khong tim thay import trong `app`, `lib`, `services`, `config`.

Van de:
- `zustand` co kha nang khong dung.

Nguyen nhan:
- Co the la package du phong/cu.

Muc do anh huong:
- Thap neu khong import vao bundle; anh huong chu yeu install time va dependency surface.

Cach khac phuc:
- Xac nhan bang `npm ls zustand`/depcheck truoc khi go.

Muc cai thien du kien:
- Nho, chu yeu giam dependency maintenance.

## 9. Uu tien toi uu

### Cao

1. Them pagination va bo `select("*")`/nested `*` o admin jobs/customers/worker history/customer jobs.
   - Tac dong: giam payload 40-90%, query nhanh hon ro.

2. Them index cho `jobs`, `workers`, `profiles`, `services`, `ratings`, `payments`, BillGo.
   - Tac dong: query filter/sort nhanh hon 2-10 lan khi du lieu lon.

3. Toi uu `hero-technician.png` va dung `next/image`.
   - Tac dong: LCP co the nhanh hon 300-1200 ms tren mobile.

4. Giam client JS bang cach tach Server/Client Component va dynamic import cho trang worker/admin/chat.
   - Tac dong: giam 20-40% JS route nang, cai thien INP.

### Trung binh

1. Thay polling chat 6 giay va worker dashboard 8 giay bang realtime co throttle/debounce.
   - Tac dong: giam request nen 50-80% o man chat/worker.

2. Gom dashboard counts vao RPC/view/cache.
   - Tac dong: dashboard admin nhanh hon 30-60% phan data load.

3. Cache dai han cho static images co version/hash.
   - Tac dong: repeat visit tiet kiem toi 1.6 MB.

4. Tach modal/form lon bang `next/dynamic`.
   - Tac dong: giam 100-300 KB gzip JS tren route nang.

### Thap

1. Xoa/kiem chung `zustand` neu thuc su khong dung.
   - Tac dong: nho.

2. Don trung lap favicon/android icon giua `app/`, `public/`, `public/favicon_io/`.
   - Tac dong: nho, giam nham lan asset.

3. Rut gon `logo.svg`.
   - Tac dong: nho-trung binh tuy tan suat tai logo.

## 10. Ghi chu gioi han kiem tra

- Khong co tai khoan dang nhap trong browser session nen cac route customer/worker/admin bi redirect `/login`; do do TTFB route noi bo sau auth chua do duoc bang browser.
- Khong cai them Lighthouse do network/sandbox gioi han.
- Khong co React Profiler instrumentation nen ket luan render dua tren static analysis, polling/realtime pattern, state update pattern va kich thuoc component.
- Khong truy cap duoc Supabase query plan/`EXPLAIN ANALYZE`; danh sach query cham/index la suy luan tu code va schema.
