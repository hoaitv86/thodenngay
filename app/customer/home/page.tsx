"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { applyDefaultServiceParents } from "@/lib/service-hierarchy";
import { filterStandardServiceCatalog } from "@/lib/standard-service-catalog";
import {
  getCustomerServiceDisplayName,
  getCustomerServiceGroups,
} from "@/lib/customer-service-catalog";
import {
  BarChartIcon,
  BriefcaseIcon,
  CameraIcon,
  ChevronRightIcon,
  ClockIcon,
  CogIcon,
  DropletIcon,
  MapPinIcon,
  PhoneIcon,
  SearchIcon,
  ShieldCheckIcon,
  StarIcon,
  WrenchIcon,
  ZapIcon,
} from "@/app/components/icons";
import { createClient } from "@/lib/supabase/client";
import { getRouteEstimate, isGpsPoint } from "@/lib/location";
import { CmsPlacement } from "@/app/components/CmsPlacement";

interface Service {
  id: string;
  name: string;
  price: string;
  iconName: string;
  color: string;
  accent: string;
  parent_service_id?: string | null;
  base_price?: number | string | null;
}

interface WorkerSummary {
  id: string;
  name: string;
  specialty: string;
  rating: string;
  jobs: number;
  color: string;
  status: string;
  distance: string;
  eta: string;
  area: string;
  highlight: string;
  signal: string;
  hasGpsEstimate: boolean;
}

const serviceStyles: Record<string, Pick<Service, "color" | "accent">> = {
  ZapIcon: { color: "bg-primary-fixed text-primary-container", accent: "from-primary to-secondary-container" },
  DropletIcon: { color: "bg-primary-fixed text-primary", accent: "from-primary-container to-primary" },
  CameraIcon: { color: "bg-secondary-fixed text-primary", accent: "from-secondary-container to-primary" },
  CogIcon: { color: "bg-primary-fixed text-primary-container", accent: "from-primary to-secondary-container" },
  WrenchIcon: { color: "bg-secondary-fixed text-primary-container", accent: "from-primary-container to-secondary-container" },
  BriefcaseIcon: { color: "bg-surface-container text-on-surface-variant", accent: "from-primary to-secondary-container" },
};

const defaultServices: Service[] = [
  { id: "internet", iconName: "BriefcaseIcon", name: "Lắp đặt Internet", price: "195.000đ", color: "bg-primary-fixed text-primary-container", accent: "from-primary to-secondary-container", base_price: 195000 },
  { id: "camera", iconName: "CameraIcon", name: "Lắp đặt Camera", price: "500.000đ", color: "bg-secondary-fixed text-primary", accent: "from-secondary-container to-primary", base_price: 500000 },
  { id: "computer", iconName: "BriefcaseIcon", name: "Sửa Máy Tính", price: "150.000đ", color: "bg-surface-container text-on-surface-variant", accent: "from-primary-container to-primary", base_price: 150000 },
  { id: "printer", iconName: "BriefcaseIcon", name: "Sửa Máy In", price: "150.000đ", color: "bg-primary-fixed text-primary", accent: "from-primary to-secondary-container", base_price: 150000 },
];

const mockDispatchMeta = [
  { distance: "1.8 km", eta: "12 phút", area: "Quận 3", highlight: "Có sẵn bộ dụng cụ khẩn cấp", signal: "Đang rảnh" },
  { distance: "2.4 km", eta: "18 phút", area: "Bình Thạnh", highlight: "Nhận ca sau 18h", signal: "Vừa hoàn tất ca gần đây" },
  { distance: "3.1 km", eta: "22 phút", area: "Phú Nhuận", highlight: "Được khách đặt lại nhiều", signal: "Ưu tiên nội thành" },
];

export default function CustomerHome() {
  const [services, setServices] = useState<Service[]>(defaultServices);
  const [topWorkers, setTopWorkers] = useState<WorkerSummary[]>([]);
  const [activeJobs, setActiveJobs] = useState(0);
  const [featuredServiceGroupIndex, setFeaturedServiceGroupIndex] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const customerServiceGroups = useMemo(() => getCustomerServiceGroups(services), [services]);
  const featuredServiceGroup = customerServiceGroups.length > 0
    ? customerServiceGroups[featuredServiceGroupIndex % customerServiceGroups.length]
    : null;
  const featuredServices = featuredServiceGroup?.services.slice(0, 8) || [];
  const displayedServices = featuredServices.length > 0 ? featuredServices : services.slice(0, 8);

  useEffect(() => {
    if (customerServiceGroups.length <= 1) return;
    const timer = window.setInterval(() => {
      setFeaturedServiceGroupIndex((current) => (current + 1) % customerServiceGroups.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [customerServiceGroups.length]);

  useEffect(() => {
    async function fetchServices() {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true);

      if (data && !error) {
        const formattedServices = filterStandardServiceCatalog(applyDefaultServiceParents(data)).map((svc) => {
          const iconName = svc.icon || "WrenchIcon";
          const visual = serviceStyles[iconName] || serviceStyles.WrenchIcon;
          const formattedPrice = svc.base_price
            ? `${Number(svc.base_price).toLocaleString("vi-VN")}đ`
            : "Miễn phí";

          return {
            id: svc.id,
            name: svc.name,
            price: formattedPrice,
            iconName,
            color: visual.color,
            accent: visual.accent,
            parent_service_id: svc.parent_service_id || null,
            base_price: svc.base_price,
          };
        });
        setServices(formattedServices);
      }
    }

    async function fetchWorkers() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: customerProfile } = user
        ? await supabase
          .from("profiles")
          .select("gps_location")
          .eq("id", user.id)
          .single()
        : { data: null };
      const customerGps = isGpsPoint(customerProfile?.gps_location) ? customerProfile.gps_location : null;

      const { data, error } = await supabase
        .from("workers")
        .select("id, specialties, avg_rating, total_jobs, profiles(full_name, gps_location)")
        .eq("status", "active")
        .order("avg_rating", { ascending: false })
        .order("total_jobs", { ascending: false })
        .limit(3);

      if (data && !error && data.length > 0) {
        setTopWorkers(data.map((worker, index) => {
          const workerProfile = Array.isArray(worker.profiles) ? worker.profiles[0] : worker.profiles;
          const specialty = worker.specialties?.[0] || "Sửa chữa";
          const rating = worker.avg_rating && Number(worker.avg_rating) > 0 ? Number(worker.avg_rating) : 5;
          const route = getRouteEstimate(customerGps, workerProfile?.gps_location);
          return {
            id: worker.id,
            name: workerProfile?.full_name || `Anh thợ ${specialty}`,
            specialty,
            rating: rating.toFixed(1),
            jobs: worker.total_jobs || 0,
            color: "bg-primary-fixed text-primary",
            status: "Sẵn sàng",
            ...mockDispatchMeta[index % mockDispatchMeta.length],
            distance: route.hasGps ? route.distance : "Chưa có GPS",
            eta: route.hasGps ? route.eta : "Chưa rõ",
            area: route.hasGps ? "Theo GPS đã lưu" : "Chưa cập nhật tọa độ",
            highlight: route.hasGps ? "Tính theo vị trí khách và thợ" : "Cập nhật GPS để tính khoảng cách",
            signal: route.hasGps ? "Dữ liệu GPS thật" : "Cần lưu vị trí",
            hasGpsEstimate: route.hasGps,
          };
        }));
      } else {
        setTopWorkers([
          { id: "fallback-electric", name: "Nguyễn Văn A", specialty: "Mạng Internet", rating: "4.9", jobs: 12, color: "bg-primary-fixed text-primary", status: "Đã phục vụ", ...mockDispatchMeta[0], distance: "Chưa có GPS", eta: "Chưa rõ", area: "Chưa cập nhật tọa độ", highlight: "Cập nhật GPS để tính khoảng cách", signal: "Cần lưu vị trí", hasGpsEstimate: false },
        ]);
      }
    }

    async function fetchActiveJobs() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", user.id)
        .in("status", ["pending", "confirmed", "assigned", "in_progress", "cancel_requested"]);
      setActiveJobs(count || 0);
    }

    fetchServices();
    fetchWorkers();
    fetchActiveJobs();
  }, [supabase]);

  const getServiceVisual = (service: Service) => {
    const name = `${service.name} ${service.iconName}`.toLowerCase();
    if (name.includes("camera")) return { Icon: CameraIcon, className: "text-slate-700", bg: "bg-slate-50" };
    if (name.includes("internet") || name.includes("wifi") || name.includes("mạng")) return { Icon: BarChartIcon, className: "text-primary", bg: "bg-primary-fixed/55" };
    if (name.includes("điện") || name.includes("dien")) return { Icon: ZapIcon, className: "text-warning", bg: "bg-warning-container/70" };
    if (name.includes("nước") || name.includes("nuoc")) return { Icon: DropletIcon, className: "text-sky-500", bg: "bg-sky-50" };
    if (name.includes("máy") || name.includes("computer") || name.includes("printer")) return { Icon: WrenchIcon, className: "text-slate-700", bg: "bg-slate-50" };
    if (name.includes("điều hòa") || name.includes("lạnh")) return { Icon: CogIcon, className: "text-sky-500", bg: "bg-sky-50" };
    return { Icon: BriefcaseIcon, className: "text-primary", bg: "bg-primary-fixed/55" };
  };

  const popularServices = displayedServices.slice(0, 7);
  const recentServices = displayedServices.slice(0, 4);
  const primaryWorker = topWorkers[0];

  return (
    <div className="customer-home-page min-h-full bg-white">
      <div className="relative z-10 pt-2"><CmsPlacement location="featured_notice" variant="banner" limit={1} /></div>
      <CmsPlacement location="popup" variant="popup" limit={1} />
      <div className="customer-home-content relative mx-auto w-full max-w-md space-y-6 px-4 pb-6 lg:max-w-6xl lg:px-8 lg:py-8">
        <section className="customer-request-card rounded-[1.45rem] border border-white/80 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.14)] lg:rounded-xl">
          <h1 className="text-2xl font-extrabold leading-tight text-on-surface">Hôm nay bạn cần hỗ trợ gì?</h1>
          <p className="mt-2 text-sm font-semibold leading-5 text-on-surface-variant">Mô tả sự cố để chúng tôi tìm thợ phù hợp cho bạn</p>
          <Link href="/customer/booking" className="mt-5 flex min-h-[4.25rem] items-center gap-3 rounded-[1.15rem] border border-outline-variant bg-white px-4 text-on-surface-variant shadow-sm">
            <SearchIcon size={28} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-base font-semibold">Bạn muốn sửa gì ngày hôm nay?</span>
            <span className="flex items-center gap-3 text-on-surface-variant"><PhoneIcon size={23} /><CameraIcon size={23} /></span>
          </Link>
          <div className="customer-chip-row mt-4 flex gap-2 overflow-x-auto pb-1">
            {[{ label: "Mất mạng Internet", icon: BarChartIcon }, { label: "Camera lỗi", icon: CameraIcon }, { label: "Máy tính", icon: WrenchIcon }, { label: "Xem thêm", icon: CogIcon }].map((chip) => (
              <Link key={chip.label} href="/customer/booking" className="flex shrink-0 items-center gap-2 rounded-full bg-surface-container px-3.5 py-2 text-sm font-bold text-on-surface"><chip.icon size={17} />{chip.label}</Link>
            ))}
          </div>
          <Link href="/customer/booking" className="mt-4 flex min-h-[4.75rem] items-center justify-center gap-3 rounded-[1.15rem] bg-primary px-4 text-center text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)]">
            <ZapIcon size={24} className="fill-current" />
            <span><span className="block text-xl font-extrabold leading-tight">ĐẶT THỢ NGAY</span><span className="mt-1 block text-sm font-semibold text-white/85">Mô tả sự cố, chọn dịch vụ và tìm thợ phù hợp</span></span>
          </Link>
        </section>

        <section className="customer-section">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-extrabold uppercase text-on-surface">Dịch vụ phổ biến</h2><Link href="/customer/booking" className="flex items-center gap-1 text-sm font-extrabold text-primary">Xem tất cả <ChevronRightIcon size={17} /></Link></div>
          <div className="customer-service-grid grid grid-cols-4 gap-3">
            {[...popularServices, { id: "all", name: "Xem tất cả", price: "", iconName: "all", color: "", accent: "" } as Service].slice(0, 8).map((service) => {
              const visual = service.id === "all" ? { Icon: CogIcon, className: "text-primary", bg: "bg-primary-fixed/55" } : getServiceVisual(service);
              const href = service.id === "all" ? "/customer/booking" : `/customer/booking?service=${service.id}`;
              return <Link key={service.id} href={href} className="customer-service-card flex min-h-[7.1rem] flex-col items-center justify-center rounded-[1.05rem] border border-outline-variant/80 bg-white p-2 text-center shadow-sm"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${visual.bg} ${visual.className}`}><visual.Icon size={30} /></span><span className="mt-2 line-clamp-2 text-xs font-extrabold leading-4 text-on-surface">{service.id === "all" ? "Xem tất cả" : getCustomerServiceDisplayName(service)}</span></Link>;
            })}
          </div>
        </section>

        <section className="customer-section">
          <h2 className="mb-3 text-base font-extrabold uppercase text-on-surface">Công việc của tôi</h2>
          <Link href="/customer/jobs" className="customer-active-job flex items-center gap-3 rounded-[1.2rem] border border-success/30 bg-success-container/35 p-3 shadow-sm"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-sky-50 text-success"><MapPinIcon size={38} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-base font-extrabold text-success">{activeJobs > 0 ? "Thợ đang đến" : "Chưa có việc đang xử lý"}</p><span className="shrink-0 rounded-full border border-success/30 bg-white/80 px-3 py-1 text-xs font-extrabold text-success">{activeJobs > 0 ? "Đang đến" : "Mới"}</span></div><p className="mt-1 truncate text-lg font-extrabold text-on-surface">{activeJobs > 0 ? `${activeJobs} công việc đang theo dõi` : "Đặt thợ khi bạn cần hỗ trợ"}</p><div className="mt-2 flex items-center gap-3 text-sm font-semibold text-on-surface-variant"><span className="inline-flex items-center gap-1"><ClockIcon size={16} /> Dự kiến: cập nhật trong đơn</span></div></div><ChevronRightIcon size={24} className="shrink-0 text-primary" /></Link>
        </section>

        <section className="customer-section">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-extrabold uppercase text-on-surface">Dịch vụ gần đây</h2><Link href="/customer/booking" className="flex items-center gap-1 text-sm font-extrabold text-primary">Xem tất cả <ChevronRightIcon size={17} /></Link></div>
          <div className="grid grid-cols-4 gap-3">{recentServices.map((service) => { const visual = getServiceVisual(service); return <Link key={`recent-${service.id}`} href={`/customer/booking?service=${service.id}`} className="rounded-[1.05rem] border border-outline-variant/80 bg-white p-3 text-center shadow-sm"><span className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl ${visual.bg} ${visual.className}`}><visual.Icon size={26} /></span><span className="mt-2 block line-clamp-2 min-h-8 text-xs font-extrabold leading-4 text-on-surface">{getCustomerServiceDisplayName(service)}</span><span className="mt-1 block text-xs font-extrabold text-primary">Đặt lại</span></Link>; })}</div>
        </section>

        <section className="customer-section">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-extrabold uppercase text-on-surface">Thợ đã từng phục vụ</h2><Link href="/customer/booking" className="flex items-center gap-1 text-sm font-extrabold text-primary">Xem tất cả <ChevronRightIcon size={17} /></Link></div>
          <div className="space-y-3">{topWorkers.slice(0, 2).map((worker) => (<article key={worker.id} className="flex items-center gap-3 rounded-[1.15rem] border border-outline-variant bg-white p-3 shadow-sm"><div className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-extrabold ${worker.color}`}>{worker.name.split(" ").pop()?.charAt(0)}<span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-success text-white"><ShieldCheckIcon size={14} /></span></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-lg font-extrabold text-on-surface">{worker.name}</h3><span className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-extrabold text-white"><StarIcon size={13} />{worker.rating}</span></div><p className="mt-1 truncate text-sm text-on-surface-variant">Chuyên: {worker.specialty}</p><p className="mt-1 text-xs font-semibold text-on-surface-variant">Đã phục vụ {worker.jobs} lần</p></div><Link href="/customer/booking" className="hidden shrink-0 items-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-extrabold text-primary sm:inline-flex"><PhoneIcon size={17} /> Gọi lại thợ này</Link></article>))}{primaryWorker && <Link href="/customer/booking" className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-extrabold text-primary sm:hidden"><PhoneIcon size={17} /> Gọi lại thợ này</Link>}</div>
        </section>
      </div>
    </div>
  );
}