"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LogoIcon,
  BriefcaseIcon,
  ClockIcon,
  UserIcon,
  ChevronRightIcon,
  BellIcon,
  PlusIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  WrenchIcon,
  ShieldCheckIcon,
  StarIcon,
  MapPinIcon,
  BarChartIcon,
  CalendarIcon,
  PhoneIcon,
  CheckCircleIcon,
  UsersIcon,
  LayoutDashboardIcon,
  LogOutIcon
} from "../components/icons";

export default function CustomerDashboard() {
  const [userName, setUserName] = useState("Khách");
  const [loading, setLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile) setUserName(profile.full_name);

        // Fetch recent jobs
        const { data: jobs } = await supabase
          .from('jobs')
          .select('*, service:services(*), worker:workers(user:profiles(full_name))')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (jobs) setRecentJobs(jobs);
      }

      // Fetch active services dynamically
      try {
        const { data: svcs } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (svcs && svcs.length > 0) {
          const iconMap: Record<string, any> = {
            ZapIcon, DropletIcon, CameraIcon, CogIcon, WrenchIcon,
            ShieldCheckIcon, StarIcon, ClockIcon, MapPinIcon, BriefcaseIcon,
            BarChartIcon, CalendarIcon, PhoneIcon, UsersIcon
          };
          const styleMap: Record<string, any> = {
            'ZapIcon': { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
            'DropletIcon': { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
            'CameraIcon': { color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
            'CogIcon': { color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
            'WrenchIcon': { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
            'ShieldCheckIcon': { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
            'StarIcon': { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-100" },
            'ClockIcon': { color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
            'MapPinIcon': { color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
            'BriefcaseIcon': { color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-100" },
            'BarChartIcon': { color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-100" },
            'CalendarIcon': { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
            'PhoneIcon': { color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-100" },
            'UsersIcon': { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" }
          };

          const mapped = svcs.map(s => ({
            ...s,
            iconComponent: iconMap[s.icon] || BriefcaseIcon,
            ...(styleMap[s.icon] || { color: "text-primary", bg: "bg-primary-fixed/10", border: "border-primary/10" })
          }));
          setServices(mapped);
        }
      } catch (err) {
        console.error("Error fetching services in dashboard:", err);
      }

      setLoading(false);
    };
    fetchData();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      {/* Header */}
      <header className="h-16 glass sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-12">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon size={32} />
          <span className="font-bold text-lg text-primary-container hidden sm:inline">Alo Thợ</span>
        </Link>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <button className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant relative" aria-label="Thông báo">
            <BellIcon size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-outline-variant sm:gap-4 sm:pl-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary-container font-bold text-xs shadow-sm">
                {userName.charAt(0)}
              </div>
              <span className="text-body-sm font-bold text-on-surface hidden sm:inline truncate max-w-[120px]">{userName}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 hover:bg-error-container hover:text-error rounded-lg text-on-surface-variant transition-colors border border-transparent hover:border-error/20"
              title="Đăng xuất"
            >
              <LogOutIcon size={18} />
              <span className="text-body-sm font-bold hidden md:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 md:py-12 space-y-8 sm:space-y-12">
        {/* Welcome & CTA */}
        <div className="card-elevated flex flex-col justify-between gap-5 !p-5 sm:flex-row sm:items-center sm:!p-8">
          <div className="min-w-0">
            <p className="section-eyebrow mb-2">Trang khách hàng</p>
            <h1 className="mb-2 break-words text-2xl font-bold text-primary sm:text-4xl">Chào {userName.split(' ').pop()}</h1>
            <p className="text-base font-medium text-on-surface-variant sm:text-lg">Bạn cần thợ giúp gì hôm nay không?</p>
          </div>
          <Link href="/booking" className="btn-primary !py-3.5 !px-6 sm:!w-auto sm:!py-4 sm:!px-8 sm:text-lg">
            <PlusIcon size={24} />
            Đặt dịch vụ mới
          </Link>
        </div>

        {/* Quick Services */}
        <section className="space-y-6">
          <h2 className="section-eyebrow px-2">Dịch vụ phổ biến</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {(services.length > 0 ? services : [
              { id: "1", name: "Sửa Điện", iconComponent: ZapIcon, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
              { id: "2", name: "Sửa Nước", iconComponent: DropletIcon, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
              { id: "3", name: "Camera", iconComponent: CameraIcon, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
              { id: "4", name: "Cơ khí", iconComponent: CogIcon, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
            ]).map(svc => {
              const IconComp = svc.iconComponent;
              return (
                <Link 
                  key={svc.id || svc.name} 
                  href={svc.id && svc.id !== "1" && svc.id !== "2" && svc.id !== "3" && svc.id !== "4" ? `/booking?service=${svc.id}` : "/booking"} 
                  className={`card flex flex-col items-center gap-4 border bg-white !p-6 transition-all hover:-translate-y-1 hover:border-primary/25 hover:shadow-md group ${svc.border}`}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-lg ${svc.bg} ${svc.color} transition-transform group-hover:scale-105`}>
                    <IconComp size={32} />
                  </div>
                  <span className="text-base font-semibold text-on-surface">{svc.name}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* My Jobs */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Lịch sử Jobs</h2>
            <button className="text-body-sm font-bold text-primary-container hover:underline">Tất cả</button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {recentJobs.length > 0 ? (
              recentJobs.map(job => (
                <div key={job.id} className="card-elevated group overflow-hidden !p-0 transition-shadow hover:shadow-md">
                  <div className="p-4 sm:p-6 grid gap-3 border-b border-slate-50 bg-slate-50/50 sm:flex sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant/20 bg-white text-primary shadow-sm transition-transform group-hover:scale-105">
                        <BriefcaseIcon size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold text-on-surface sm:text-lg">{job.service?.name}</div>
                        <div className="text-sm font-medium text-on-surface-variant">{job.job_code}</div>
                      </div>
                    </div>
                    <span className={`badge badge-${job.status === 'done' ? 'completed' : job.status} w-fit px-3 sm:px-4 py-1.5 uppercase text-[10px] font-bold`}>
                      {job.status === 'pending' ? 'Đang tìm thợ' : 
                       job.status === 'in_progress' ? 'Đang thực hiện' : 
                       (job.status === 'completed' || job.status === 'done') ? 'Hoàn thành' :
                       job.status === 'cancel_requested' ? 'Chờ duyệt huỷ' : job.status}
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-on-surface-variant">
                        <ClockIcon size={16} />
                        <span className="text-body-sm">
                          {new Date(job.scheduled_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-on-surface-variant">
                        <UserIcon size={16} />
                        <span className="text-body-sm">
                          Thợ: {job.worker?.user?.full_name || "Đang chờ..."}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end justify-between gap-4">
                      <div className="text-xl sm:text-headline-md font-bold text-on-surface">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.quoted_price)}
                      </div>
                      
                      <Link href={`/customer/jobs/${job.id}`} className="btn-primary !py-2 !px-4 !text-sm sm:!w-auto">
                        Xem chi tiết
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low py-10 text-center">
                <p className="text-on-surface-variant">Bạn chưa có yêu cầu nào.</p>
              </div>
            )}
          </div>
        </section>

        {/* Promo Banner */}
        <div className="hero-gradient relative flex flex-col items-center gap-6 overflow-hidden rounded-xl p-5 text-on-primary sm:gap-8 sm:p-8 md:flex-row">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-linear-to-l from-secondary-container/20 to-transparent" />
          <div className="w-full flex-1 space-y-4 text-center md:text-left z-10">
            <h3 className="text-2xl md:text-3xl font-bold text-white">Bạn muốn trở thành đối tác?</h3>
            <p className="text-sm md:text-base text-white/80">Đăng ký làm thợ để nhận hàng ngàn công việc sửa chữa mỗi ngày với thu nhập ổn định.</p>
            <Link href="/register?role=worker" className="btn-secondary !py-3 !px-8 !text-base sm:!w-auto">
              Tìm hiểu thêm
            </Link>
          </div>
          <div className="z-10 flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 backdrop-blur-sm md:h-40 md:w-40">
            <UsersIcon size={64} className="text-white/40" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 bg-white border-t border-outline-variant flex items-center justify-center gap-10">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-primary-container">
          <LayoutDashboardIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Trang chủ</span>
        </Link>
        <Link href="/customer/jobs" className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface">
          <BriefcaseIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Jobs</span>
        </Link>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface">
          <StarIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Yêu thích</span>
        </button>
        <Link href="/customer/profile" className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface">
          <UserIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Hồ sơ</span>
        </Link>
      </footer>
    </div>
  );
}
