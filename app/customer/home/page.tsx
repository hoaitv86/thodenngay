"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { applyDefaultServiceParents } from "@/lib/service-hierarchy";
import { filterStandardServiceCatalog } from "@/lib/standard-service-catalog";
import {
  getCustomerServiceBasePrice,
  getCustomerServiceDisplayName,
  getCustomerServiceGroups,
} from "@/lib/customer-service-catalog";
import {
  ArrowRightIcon,
  BarChartIcon,
  BriefcaseIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
} from "@/app/components/icons";
import { createClient } from "@/lib/supabase/client";
import { getRouteEstimate, isGpsPoint } from "@/lib/location";

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
  ShieldCheckIcon: { color: "bg-primary-fixed text-primary", accent: "from-primary to-secondary-container" },
  StarIcon: { color: "bg-secondary-fixed text-primary", accent: "from-secondary-container to-primary" },
  ClockIcon: { color: "bg-primary-fixed text-primary-container", accent: "from-primary-container to-primary" },
  MapPinIcon: { color: "bg-secondary-fixed text-primary-container", accent: "from-primary to-secondary-container" },
  BriefcaseIcon: { color: "bg-surface-container text-on-surface-variant", accent: "from-primary to-secondary-container" },
  BarChartIcon: { color: "bg-primary-fixed text-primary", accent: "from-secondary-container to-primary" },
  CalendarIcon: { color: "bg-secondary-fixed text-primary-container", accent: "from-primary-container to-secondary-container" },
  PhoneIcon: { color: "bg-primary-fixed text-primary", accent: "from-primary to-secondary-container" },
  UsersIcon: { color: "bg-secondary-fixed text-primary", accent: "from-secondary-container to-primary" },
};

const defaultServices: Service[] = [
  { id: "internet", iconName: "BriefcaseIcon", name: "Lắp đặt Internet", price: "195.000đ", color: "bg-primary-fixed text-primary-container", accent: "from-primary to-secondary-container", base_price: 195000 },
  { id: "camera", iconName: "CameraIcon", name: "Lắp đặt Camera", price: "500.000đ", color: "bg-secondary-fixed text-primary", accent: "from-secondary-container to-primary", base_price: 500000 },
  { id: "computer", iconName: "BriefcaseIcon", name: "Sửa Máy Tính", price: "150.000đ", color: "bg-surface-container text-on-surface-variant", accent: "from-primary-container to-primary", base_price: 150000 },
  { id: "printer", iconName: "BriefcaseIcon", name: "Sửa Máy In", price: "150.000đ", color: "bg-primary-fixed text-primary", accent: "from-primary to-secondary-container", base_price: 150000 },
];

const customerPromise = [
  { label: "Có thợ trong", value: "30 phút", icon: ClockIcon, tone: "bg-primary text-white" },
  { label: "Bảo hành", value: "7 ngày", icon: ShieldCheckIcon, tone: "bg-success text-white" },
  { label: "Báo giá rõ", value: "Trước khi làm", icon: BriefcaseIcon, tone: "bg-secondary-container text-white" },
];

const quickActions = [
  { href: "/customer/booking", label: "Đặt lịch mới", note: "Gửi yêu cầu trong 1 phút", icon: CalendarIcon, color: "bg-primary-fixed text-primary-container" },
  { href: "/customer/jobs", label: "Theo dõi đơn", note: "Xem tiến độ thợ nhận việc", icon: BarChartIcon, color: "bg-secondary-fixed text-on-secondary-container" },
  { href: "/customer/profile", label: "Địa chỉ của tôi", note: "Cập nhật thông tin liên hệ", icon: MapPinIcon, color: "bg-success-container text-success" },
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
    if (featuredServiceGroupIndex >= customerServiceGroups.length) {
      setFeaturedServiceGroupIndex(0);
    }
  }, [customerServiceGroups.length, featuredServiceGroupIndex]);

  useEffect(() => {
    async function fetchServices() {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true);

      if (data && !error) {
        const formattedServices = filterStandardServiceCatalog(applyDefaultServiceParents(data)).map((svc) => {
          const iconName = svc.icon || "WrenchIcon";
          const visual = serviceStyles[iconName] || {
            color: "bg-primary-fixed text-primary-container",
            accent: "from-primary to-tertiary-container",
          };
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
        const formattedWorkers = data.map((worker, index) => {
          const workerProfile = Array.isArray(worker.profiles) ? worker.profiles[0] : worker.profiles;
          const specialty = worker.specialties?.[0] || "Sửa chữa";
          const rating = worker.avg_rating && Number(worker.avg_rating) > 0 ? Number(worker.avg_rating) : 5;
          const name = workerProfile?.full_name || `Anh thợ ${specialty}`;
          const specialtyLower = specialty.toLowerCase();
          const dispatchMeta = mockDispatchMeta[index % mockDispatchMeta.length];
          const route = getRouteEstimate(customerGps, workerProfile?.gps_location);
          let color = "bg-secondary-fixed text-primary";

          if (specialtyLower.includes("điện") || specialtyLower.includes("dien")) color = "bg-primary-fixed text-primary-container";
          else if (specialtyLower.includes("nước") || specialtyLower.includes("nuoc")) color = "bg-primary-fixed text-primary";
          else if (specialtyLower.includes("camera") || specialtyLower.includes("cam")) color = "bg-secondary-fixed text-primary";
          else if (specialtyLower.includes("cơ khí") || specialtyLower.includes("co khi")) color = "bg-secondary-fixed text-primary-container";

          return {
            id: worker.id,
            name,
            specialty,
            rating: rating.toFixed(1),
            jobs: worker.total_jobs || 0,
            color,
            status: "Sẵn sàng",
            ...dispatchMeta,
            distance: route.hasGps ? route.distance : "Chưa có GPS",
            eta: route.hasGps ? route.eta : "Chưa rõ",
            area: route.hasGps ? "Theo GPS đã lưu" : "Chưa cập nhật tọa độ",
            highlight: route.hasGps ? "Tính theo vị trí khách và thợ" : "Cập nhật GPS để tính khoảng cách",
            signal: route.hasGps ? "Dữ liệu GPS thật" : "Cần lưu vị trí",
            hasGpsEstimate: route.hasGps,
          };
        });
        setTopWorkers(formattedWorkers);
      } else {
        setTopWorkers([
          {
            id: "fallback-electric",
            name: "Anh Tuấn",
            specialty: "Điện",
            rating: "4.9",
            jobs: 230,
            color: "bg-primary-fixed text-primary-container",
            status: "Phản hồi nhanh",
            ...mockDispatchMeta[0],
            distance: "Chưa có GPS",
            eta: "Chưa rõ",
            area: "Chưa cập nhật tọa độ",
            highlight: "Cập nhật GPS để tính khoảng cách",
            signal: "Cần lưu vị trí",
            hasGpsEstimate: false,
          },
          {
            id: "fallback-water",
            name: "Anh Phát",
            specialty: "Nước",
            rating: "4.8",
            jobs: 185,
            color: "bg-primary-fixed text-primary",
            status: "Gần bạn",
            ...mockDispatchMeta[1],
            distance: "Chưa có GPS",
            eta: "Chưa rõ",
            area: "Chưa cập nhật tọa độ",
            highlight: "Cập nhật GPS để tính khoảng cách",
            signal: "Cần lưu vị trí",
            hasGpsEstimate: false,
          },
          {
            id: "fallback-camera",
            name: "Anh Minh",
            specialty: "Camera",
            rating: "4.7",
            jobs: 142,
            color: "bg-violet-100 text-violet-700",
            status: "Được yêu thích",
            ...mockDispatchMeta[2],
            distance: "Chưa có GPS",
            eta: "Chưa rõ",
            area: "Chưa cập nhật tọa độ",
            highlight: "Cập nhật GPS để tính khoảng cách",
            signal: "Cần lưu vị trí",
            hasGpsEstimate: false,
          },
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

  return (
    <div className="relative min-h-full overflow-hidden bg-linear-to-b from-primary-fixed via-surface to-secondary-fixed/35">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-br from-primary/12 via-tertiary-container/10 to-secondary-container/14" />
      <div className="relative mx-auto w-full max-w-md space-y-5 px-4 pb-5 pt-4 lg:max-w-6xl lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-xl border border-white/25 bg-linear-to-br from-primary via-primary-container to-tertiary-container text-white shadow-[0_18px_46px_rgba(10,74,146,0.2)] lg:min-h-[330px]">
          <Image
            src="/hero-technician.webp"
            alt=""
            width={1774}
            height={887}
            sizes="(min-width: 1024px) 47vw, 12rem"
            className="absolute bottom-0 right-0 h-40 w-40 object-contain object-bottom opacity-18 sm:h-48 sm:w-48 lg:h-full lg:w-[47%] lg:object-cover lg:object-center lg:opacity-85"
          />
          <div className="absolute inset-y-0 right-0 hidden w-3/5 bg-linear-to-r from-primary via-primary/80 to-transparent lg:block" />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-secondary-container" />

          <div className="relative p-5 sm:p-6 lg:max-w-[58%] lg:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/20">
              <ShieldCheckIcon size={14} />
              Thợ xác thực, báo giá trước khi làm
            </div>
            <h1 className="mt-4 max-w-sm text-3xl font-bold leading-tight text-white lg:text-4xl">
              Sửa nhà gọn hơn, đặt thợ nhanh hơn
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/82 lg:text-base">
              Chọn dịch vụ, gửi mô tả hiện trạng và theo dõi tiến độ ngay trên điện thoại.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/customer/booking"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-secondary-container px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(232,102,36,0.28)] transition-all hover:brightness-105 active:scale-[0.98]"
              >
                Đặt dịch vụ ngay
                <ArrowRightIcon size={17} />
              </Link>
              <Link
                href="/customer/jobs"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/12 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/18 active:scale-[0.98]"
              >
                Xem đơn của tôi
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {customerPromise.map((item) => (
                <div key={item.label} className="rounded-lg bg-white/10 p-3 ring-1 ring-white/12">
                  <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-md ${item.tone}`}>
                    <item.icon size={16} />
                  </div>
                  <p className="text-[10px] font-bold uppercase text-white/65">{item.label}</p>
                  <p className="mt-0.5 text-sm font-bold leading-tight text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-3 rounded-xl border border-white/70 bg-white/78 p-4 shadow-[0_12px_28px_rgba(15,35,66,0.07)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md active:scale-[0.99]"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${action.color}`}>
                <action.icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-on-surface">{action.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{action.note}</p>
              </div>
              <ArrowRightIcon size={17} className="text-on-surface-variant transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.45fr_0.85fr]">
          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-secondary-container">Dịch vụ phổ biến</p>
                <h2 className="mt-1 text-xl font-bold text-on-surface">
                  Đa dạng dịch vụ {featuredServiceGroup?.category.name || "sửa chữa"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                  Nhóm dịch vụ nổi bật tự đổi để bạn thấy thêm lựa chọn phù hợp.
                </p>
              </div>
              <Link href="/customer/booking" className="shrink-0 text-xs font-bold text-primary-container">
                Xem tất cả
              </Link>
            </div>

            {customerServiceGroups.length > 1 && (
              <div className="mb-3 flex gap-1.5">
                {customerServiceGroups.map((group, index) => (
                  <button
                    key={group.category.id}
                    type="button"
                    onClick={() => setFeaturedServiceGroupIndex(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === featuredServiceGroupIndex % customerServiceGroups.length
                        ? "w-8 bg-secondary-container"
                        : "w-3 bg-outline-variant/50"
                    }`}
                    aria-label={`Xem nhóm ${group.category.name}`}
                  />
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              {displayedServices.map((service) => {
                const servicePrice = getCustomerServiceBasePrice(service, services);
                const displayPrice = servicePrice > 0
                  ? `${servicePrice.toLocaleString("vi-VN")}đ`
                  : service.price;
                const categoryId = featuredServiceGroup?.category.id;
                const href = categoryId
                  ? `/customer/booking?category=${categoryId}&service=${service.id}`
                  : `/customer/booking?service=${service.id}`;

                return (
                  <Link
                    key={service.id}
                    href={href}
                    className="group relative min-h-[142px] overflow-hidden rounded-xl border border-white/70 bg-white/82 p-3.5 shadow-[0_12px_28px_rgba(15,35,66,0.07)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] sm:min-h-[150px] sm:p-4"
                  >
                    <div className={`absolute inset-x-0 top-0 h-1.5 bg-linear-to-r ${service.accent}`} />
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${service.color} sm:h-12 sm:w-12`}>
                      <BriefcaseIcon size={20} />
                    </div>
                    <p className="mt-3 min-h-10 text-sm font-bold leading-5 text-on-surface">
                      {getCustomerServiceDisplayName(service)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-on-surface-variant">Từ {displayPrice}</p>
                    <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-1 text-[11px] font-bold text-primary-container">
                      Chọn
                      <ArrowRightIcon size={12} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border border-white/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,35,66,0.07)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-on-surface-variant">Đang theo dõi</p>
                  <p className="mt-1 text-3xl font-bold text-primary-container">{activeJobs}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
                  <BarChartIcon size={23} />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                Các đơn đang chờ thợ nhận, đang đến nơi hoặc đang thực hiện.
              </p>
              <Link href="/customer/jobs" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white transition-all hover:bg-primary-container active:scale-[0.98]">
                Kiểm tra tiến độ
                <ArrowRightIcon size={16} />
              </Link>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/70 bg-white/82 shadow-[0_12px_28px_rgba(15,35,66,0.07)] backdrop-blur">
              <div className="border-b border-primary/10 bg-linear-to-r from-primary-fixed/70 via-white/70 to-secondary-fixed/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-secondary-container">Thợ điều phối gần bạn</p>
                    <h2 className="mt-1 text-lg font-bold leading-tight text-on-surface">Đội sẵn sàng quanh khu vực</h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-primary-container ring-1 ring-primary/10">
                    {topWorkers.some(worker => worker.hasGpsEstimate) ? "GPS thật" : "Thiếu GPS"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                  Khoảng cách được tính khi hồ sơ khách và thợ đã lưu vị trí GPS.
                </p>
              </div>

              <div className="space-y-3 p-3">
                {topWorkers.map((worker) => (
                  <div key={worker.id} className="rounded-lg border border-white/70 bg-surface-container-low/80 p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-base font-extrabold ${worker.color}`}>
                        {worker.name.split(" ").pop()?.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-on-surface">{worker.name}</p>
                            <p className="mt-0.5 text-xs text-on-surface-variant">{worker.specialty} · {worker.jobs} việc</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 rounded-full bg-warning-container px-2 py-1 text-xs font-bold text-warning">
                            <StarIcon size={13} />
                            {worker.rating}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-white/76 px-2.5 py-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary-container">
                              <MapPinIcon size={13} />
                              {worker.distance}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">{worker.area}</p>
                          </div>
                          <div className="rounded-md bg-white/76 px-2.5 py-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-secondary-container">
                              <ClockIcon size={13} />
                              {worker.eta}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">{worker.signal}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-on-surface-variant ring-1 ring-white/80">
                            {worker.highlight}
                          </span>
                          <span className="shrink-0 rounded-full bg-success-container px-2.5 py-1 text-[11px] font-bold text-success">
                            {worker.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/customer/booking" className="flex items-center justify-center gap-2 border-t border-primary/10 bg-white/72 px-4 py-3 text-sm font-bold text-primary-container transition-colors hover:bg-primary-fixed">
                Đặt thợ gần nhất
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
