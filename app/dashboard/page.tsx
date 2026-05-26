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
  StarIcon,
  CheckCircleIcon,
  UsersIcon,
  LayoutDashboardIcon,
  LogOutIcon
} from "../components/icons";

export default function CustomerDashboard() {
  const [userName, setUserName] = useState("Khách");
  const [loading, setLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
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
          <button className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant relative">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] shadow-sm border border-slate-100">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-[#003178] mb-2 tracking-tight break-words">Chào {userName.split(' ').pop()}! 👋</h1>
            <p className="text-base sm:text-lg text-[#434652] font-medium">Bạn cần thợ giúp gì hôm nay không?</p>
          </div>
          <Link href="/booking" className="btn-primary !py-3.5 !px-6 sm:!w-auto sm:!py-4 sm:!px-8 sm:text-lg">
            <PlusIcon size={24} />
            Đặt dịch vụ mới
          </Link>
        </div>

        {/* Quick Services */}
        <section className="space-y-6">
          <h2 className="text-sm font-bold text-[#003178] uppercase tracking-[0.2em] px-2">Dịch vụ phổ biến</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {[
              { name: "Sửa Điện", icon: ZapIcon, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
              { name: "Sửa Nước", icon: DropletIcon, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
              { name: "Camera", icon: CameraIcon, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
              { name: "Cơ khí", icon: CogIcon, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
            ].map(svc => (
              <Link 
                key={svc.name} 
                href="/booking" 
                className={`card !p-4 sm:!p-6 min-h-[132px] flex flex-col items-center justify-center gap-3 sm:gap-4 hover:shadow-lg hover:-translate-y-1 transition-all group bg-white border ${svc.border}`}
              >
                <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl ${svc.bg} ${svc.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <svc.icon size={28} />
                </div>
                <span className="text-sm sm:text-base font-bold text-[#1a1c1e] text-center">{svc.name}</span>
              </Link>
            ))}
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
                <div key={job.id} className="card-elevated !p-0 overflow-hidden hover:shadow-2xl transition-shadow group">
                  <div className="p-4 sm:p-6 grid gap-3 border-b border-slate-50 bg-slate-50/50 sm:flex sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#003178] shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                        <BriefcaseIcon size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base sm:text-lg font-bold text-[#1a1c1e] truncate">{job.service?.name}</div>
                        <div className="text-sm font-medium text-[#434652]">{job.job_code}</div>
                      </div>
                    </div>
                    <span className={`badge badge-${job.status === 'done' ? 'completed' : job.status} w-fit px-3 sm:px-4 py-1.5 uppercase text-[10px] font-bold`}>
                      {job.status === 'pending' ? 'Đang tìm thợ' : 
                       job.status === 'in_progress' ? 'Đang thực hiện' : 
                       (job.status === 'completed' || job.status === 'done') ? 'Hoàn thành' : job.status}
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
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-on-surface-variant">Bạn chưa có yêu cầu nào.</p>
              </div>
            )}
          </div>
        </section>

        {/* Promo Banner */}
        <div className="bg-primary-container rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-on-primary flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary-container/10 rounded-full -ml-24 -mb-24 blur-3xl" />
          
          <div className="w-full flex-1 space-y-4 text-center md:text-left z-10">
            <h3 className="text-2xl md:text-3xl font-bold text-white">Bạn muốn trở thành đối tác?</h3>
            <p className="text-sm md:text-base text-white/80">Đăng ký làm thợ để nhận hàng ngàn công việc sửa chữa mỗi ngày với thu nhập ổn định.</p>
            <Link href="/register?role=worker" className="btn-secondary !py-3 !px-8 !text-base sm:!w-auto">
              Tìm hiểu thêm
            </Link>
          </div>
          <div className="w-32 h-32 md:w-40 md:h-40 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-white/10 shrink-0 z-10">
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
        <button className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface">
          <UserIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Hồ sơ</span>
        </button>
      </footer>
    </div>
  );
}
