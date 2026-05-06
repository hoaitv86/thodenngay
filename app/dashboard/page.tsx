"use client";

import React from "react";
import Link from "next/link";
import {
  LogoIcon,
  BriefcaseIcon,
  ClockIcon,
  MapPinIcon,
  ChevronRightIcon,
  BellIcon,
  PlusIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  StarIcon,
  UserIcon,
  CheckCircleIcon,
  UsersIcon,
  LayoutDashboardIcon
} from "../components/icons";

// Mock Data
const myJobs = [
  { id: "JOB-9401", service: "Sửa nước", status: "in_progress", time: "Hôm nay, 09:15 AM", worker: "Lê Văn C", price: "180,000đ" },
  { id: "JOB-9390", service: "Sửa điện", status: "done", time: "02/05/2026", worker: "Nguyễn Văn E", price: "250,000đ", rated: true },
  { id: "JOB-9350", service: "Lắp camera", status: "done", time: "25/04/2026", worker: "Hoàng Văn D", price: "1,200,000đ", rated: false },
];

export default function CustomerDashboard() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="h-16 glass sticky top-0 z-50 flex items-center justify-between px-6 lg:px-12">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon size={32} />
          <span className="font-bold text-lg text-primary-container hidden sm:inline">Alo Thợ</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant relative">
            <BellIcon size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
          </button>
          <div className="flex items-center gap-2 pl-4 border-l border-outline-variant">
            <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary-container font-bold text-xs">
              NT
            </div>
            <span className="text-body-sm font-bold text-on-surface hidden sm:inline">Nguyễn Thảo</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 py-10 space-y-10">
        {/* Welcome & CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-headline-lg mb-1">Chào Thảo!</h1>
            <p className="text-body-md text-on-surface-variant">Bạn cần thợ giúp gì hôm nay không?</p>
          </div>
          <Link href="/booking" className="btn-primary !py-3.5 !px-6 shadow-lg shadow-primary-container/20">
            <PlusIcon size={20} />
            Đặt dịch vụ mới
          </Link>
        </div>

        {/* Quick Services */}
        <section className="space-y-4">
          <h2 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Dịch vụ phổ biến</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: "Điện", icon: ZapIcon, color: "text-amber-500", bg: "bg-amber-50" },
              { name: "Nước", icon: DropletIcon, color: "text-blue-500", bg: "bg-blue-50" },
              { name: "Camera", icon: CameraIcon, color: "text-purple-500", bg: "bg-purple-50" },
              { name: "Cơ khí", icon: CogIcon, color: "text-green-500", bg: "bg-green-50" },
            ].map(svc => (
              <Link 
                key={svc.name} 
                href="/booking" 
                className="card !p-4 flex flex-col items-center gap-3 hover:scale-105 transition-transform"
              >
                <div className={`w-12 h-12 rounded-xl ${svc.bg} ${svc.color} flex items-center justify-center`}>
                  <svc.icon size={24} />
                </div>
                <span className="text-body-sm font-bold text-on-surface">{svc.name}</span>
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

          <div className="space-y-4">
            {myJobs.map(job => (
              <div key={job.id} className="card-elevated !p-0 overflow-hidden">
                <div className="p-5 flex items-center justify-between border-b border-outline-variant/30 bg-surface-container-low/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary-container shadow-sm border border-outline-variant">
                      <BriefcaseIcon size={18} />
                    </div>
                    <div>
                      <div className="text-body-sm font-bold text-on-surface">{job.service}</div>
                      <div className="text-label-sm text-on-surface-variant">{job.id}</div>
                    </div>
                  </div>
                  <span className={`badge badge-${job.status}`}>
                    {job.status === "in_progress" ? "Đang thực hiện" : "Hoàn thành"}
                  </span>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-on-surface-variant">
                      <ClockIcon size={16} />
                      <span className="text-body-sm">{job.time}</span>
                    </div>
                    <div className="flex items-center gap-3 text-on-surface-variant">
                      <UserIcon size={16} />
                      <span className="text-body-sm">Thợ: {job.worker}</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end justify-between gap-4">
                    <div className="text-headline-md text-on-surface">{job.price}</div>
                    
                    {job.status === "done" && !job.rated && (
                      <button className="btn-outline !py-2 !px-4 !text-sm !rounded-xl flex items-center gap-2">
                        <StarIcon size={16} className="text-secondary-container" />
                        Đánh giá thợ
                      </button>
                    )}
                    
                    {job.status === "done" && job.rated && (
                      <div className="flex items-center gap-1 text-secondary-container text-body-sm font-bold">
                        <StarIcon size={14} className="fill-current" /> Đã đánh giá
                      </div>
                    )}

                    {job.status === "in_progress" && (
                      <button className="btn-primary !py-2 !px-4 !text-sm !rounded-xl">
                        Xem chi tiết
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Promo Banner */}
        <div className="bg-primary-container rounded-3xl p-8 text-on-primary flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary-container/10 rounded-full -ml-24 -mb-24 blur-3xl" />
          
          <div className="flex-1 space-y-4 text-center md:text-left z-10">
            <h3 className="text-headline-md">Bạn muốn trở thành đối tác?</h3>
            <p className="text-body-sm text-white/80 max-w-md">Đăng ký làm thợ để nhận hàng ngàn công việc sửa chữa mỗi ngày với thu nhập ổn định.</p>
            <Link href="/register?role=worker" className="btn-secondary !inline-flex !py-2.5 !px-6 !text-sm">
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
        <button className="flex flex-col items-center gap-1 text-primary-container">
          <LayoutDashboardIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Trang chủ</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface">
          <BriefcaseIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Jobs</span>
        </button>
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
