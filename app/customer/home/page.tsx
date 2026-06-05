"use client";

import { useState, useEffect } from "react";
import {
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  WrenchIcon,
  ShieldCheckIcon,
  StarIcon,
  ClockIcon,
  MapPinIcon,
  BriefcaseIcon,
  BarChartIcon,
  CalendarIcon,
  PhoneIcon,
  UsersIcon,
  ArrowRightIcon
} from "@/app/components/icons";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Service {
  id: string;
  name: string;
  price: string;
  iconName: string;
  color: string;
}

const iconMap: Record<string, any> = {
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  WrenchIcon,
  ShieldCheckIcon,
  StarIcon,
  ClockIcon,
  MapPinIcon,
  BriefcaseIcon,
  BarChartIcon,
  CalendarIcon,
  PhoneIcon,
  UsersIcon,
};

const serviceStyles: Record<string, string> = {
  ZapIcon: "bg-amber-50 text-amber-600",
  DropletIcon: "bg-blue-50 text-blue-600",
  CameraIcon: "bg-violet-50 text-violet-600",
  CogIcon: "bg-emerald-50 text-emerald-600",
  WrenchIcon: "bg-rose-50 text-rose-600",
  ShieldCheckIcon: "bg-emerald-50 text-emerald-600",
  StarIcon: "bg-yellow-50 text-yellow-600",
  ClockIcon: "bg-indigo-50 text-indigo-600",
  MapPinIcon: "bg-red-50 text-red-600",
  BriefcaseIcon: "bg-slate-50 text-slate-600",
  BarChartIcon: "bg-cyan-50 text-cyan-600",
  CalendarIcon: "bg-rose-50 text-rose-600",
  PhoneIcon: "bg-teal-50 text-teal-600",
  UsersIcon: "bg-orange-50 text-orange-600",
};

const defaultServices: Service[] = [
  { id: "1", iconName: "ZapIcon", name: "Sửa điện", price: "200.000đ", color: "bg-amber-50 text-amber-600" },
  { id: "2", iconName: "DropletIcon", name: "Sửa nước", price: "150.000đ", color: "bg-blue-50 text-blue-600" },
  { id: "3", iconName: "CameraIcon", name: "Lắp camera", price: "500.000đ", color: "bg-violet-50 text-violet-600" },
  { id: "4", iconName: "CogIcon", name: "Cơ khí", price: "250.000đ", color: "bg-emerald-50 text-emerald-600" },
];

const bookingHighlights = [
  { label: "Có thợ trong", value: "30 phút", icon: ClockIcon, color: "bg-secondary-container text-white" },
  { label: "Bảo hành", value: "7 ngày", icon: ShieldCheckIcon, color: "bg-success text-white" },
];

export default function CustomerHome() {
  const [services, setServices] = useState<Service[]>(defaultServices);
  const [topWorkers, setTopWorkers] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function fetchServices() {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, base_price, icon")
        .eq("is_active", true);

      if (data && !error) {
        const formattedServices = data.map((svc) => {
          const iconName = svc.icon || "WrenchIcon";
          const color = serviceStyles[iconName] || "bg-primary-fixed/10 text-primary";
          const formattedPrice = svc.base_price
            ? `${Number(svc.base_price).toLocaleString("vi-VN")}đ`
            : "Miễn phí";
          return {
            id: svc.id,
            name: svc.name,
            price: formattedPrice,
            iconName,
            color,
          };
        });
        setServices(formattedServices);
      }
    }

    async function fetchWorkers() {
      const { data, error } = await supabase
        .from("workers")
        .select("*, profiles(*)")
        .eq("status", "active")
        .order("avg_rating", { ascending: false })
        .order("total_jobs", { ascending: false })
        .limit(3);

      if (data && !error && data.length > 0) {
        const formattedWorkers = data.map((w) => {
          const specialty = w.specialties?.[0] || "Sửa chữa";
          const rating = w.avg_rating && Number(w.avg_rating) > 0 ? Number(w.avg_rating) : 5.0;
          const name = w.profiles?.full_name || `Anh Thợ ${specialty}`;
          
          const specialtyLower = specialty.toLowerCase();
          let color = "bg-rose-100 text-rose-700";
          if (specialtyLower.includes("điện") || specialtyLower.includes("dien")) color = "bg-amber-100 text-amber-700";
          else if (specialtyLower.includes("nước") || specialtyLower.includes("nuoc")) color = "bg-sky-100 text-sky-700";
          else if (specialtyLower.includes("camera") || specialtyLower.includes("cam")) color = "bg-violet-100 text-violet-700";
          else if (specialtyLower.includes("cơ khí") || specialtyLower.includes("co khi")) color = "bg-emerald-100 text-emerald-700";

          return {
            name,
            specialty,
            rating: rating.toFixed(1),
            jobs: w.total_jobs || 0,
            color,
            status: "Hoạt động",
          };
        });
        setTopWorkers(formattedWorkers);
      } else {
        // Fallback to beautiful static data
        setTopWorkers([
          { name: "Anh Tuấn", specialty: "Điện", rating: "4.9", jobs: 230, color: "bg-amber-100 text-amber-700", status: "Sẵn sàng" },
          { name: "Anh Phát", specialty: "Nước", rating: "4.8", jobs: 185, color: "bg-sky-100 text-sky-700", status: "Gần bạn" },
          { name: "Anh Minh", specialty: "Camera", rating: "4.7", jobs: 142, color: "bg-violet-100 text-violet-700", status: "Phản hồi nhanh" },
        ]);
      }
    }

    fetchServices();
    fetchWorkers();
  }, [supabase]);

  return (
    <div className="space-y-5 px-4 pt-4 lg:px-8">
      {/* Greeting */}
      <div className="app-hero-panel">
        <div className="relative">
          <p className="text-sm font-semibold text-white/80">Xin chào</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight text-white">Bạn cần sửa gì hôm nay?</h1>
          <p className="mt-2 max-w-[18rem] text-sm leading-6 text-white/80">
            Chọn dịch vụ, gửi mô tả và nhận thợ phù hợp quanh khu vực của bạn.
          </p>
        </div>
        <Link
          href="/customer/booking"
          className="relative mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-primary shadow-lg shadow-black/15 transition-all hover:bg-secondary-container hover:text-white active:scale-[0.98] sm:w-auto"
        >
          Đặt dịch vụ ngay
          <ArrowRightIcon size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {bookingHighlights.map((item) => (
          <div key={item.label} className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-sm">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${item.color}`}>
              <item.icon size={18} />
            </div>
            <p className="text-[11px] font-bold uppercase text-on-surface-variant">{item.label}</p>
            <p className="text-base font-extrabold text-on-surface">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Services Grid */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-body-lg font-bold text-on-surface">Dịch vụ phổ biến</h2>
          <Link href="/customer/booking" className="text-xs font-bold text-secondary-container">
            Xem tất cả
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {services.map((svc) => {
            const IconComponent = iconMap[svc.iconName] || WrenchIcon;
            return (
              <Link
                key={svc.id}
                href={`/customer/booking?service=${svc.id}`}
                className="group min-h-[142px] rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:scale-[0.98]"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg shadow-sm transition-transform group-hover:scale-105 ${svc.color}`}>
                  <IconComponent size={22} />
                </div>
                <p className="text-body-sm font-extrabold text-on-surface">{svc.name}</p>
                <p className="mt-1 text-label-sm text-on-surface-variant">
                  Từ {svc.price}
                </p>
                <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary-container/10 px-2.5 py-1 text-[10px] font-bold text-secondary">
                  Chọn ngay
                  <ArrowRightIcon size={12} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Top Workers */}
      <section>
        <h2 className="mb-3 text-body-lg font-bold text-on-surface">Thợ nổi bật</h2>
        <div className="space-y-3">
          {topWorkers.map((w) => (
            <div
              key={w.name}
              className="flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3.5 shadow-sm"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-label-md font-extrabold ${w.color}`}>
                {w.name.split(" ").pop()?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-semibold text-on-surface truncate">
                  {w.name}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  Chuyên {w.specialty} · {w.jobs} việc
                </p>
                <p className="mt-1 text-[11px] font-bold text-success">{w.status}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-full bg-warning-container px-2 py-1 text-label-sm font-bold text-warning">
                <StarIcon size={16} className="text-warning fill-warning" />
                {w.rating}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
