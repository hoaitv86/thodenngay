"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  LogoIcon,
  BriefcaseIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  XIcon,
  ChevronRightIcon,
  PhoneIcon,
  UserIcon,
  StarIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  BellIcon,
  LayoutDashboardIcon,
  DollarSignIcon
} from "../components/icons";

// Mock Data
const newJobs = [
  { id: "JOB-9402", service: "Sửa điện", icon: ZapIcon, price: "250,000đ", time: "10:30 AM", distance: "1.2 km", address: "15 Lê Lợi, Q.1" },
  { id: "JOB-9405", service: "Sửa nước", icon: DropletIcon, price: "180,000đ", time: "11:15 AM", distance: "2.5 km", address: "202 Nguyễn Huệ, Q.1" },
];

const activeJobs = [
  { id: "JOB-9401", customer: "Trần Thị B", service: "Sửa nước", status: "in_progress", time: "09:15 AM", address: "456 CMT8, Q.3" },
];

export default function WorkerDashboard() {
  const [tab, setTab] = useState<"new" | "active">("new");

  return (
    <div className="min-h-screen bg-surface flex flex-col max-w-md mx-auto border-x border-outline-variant shadow-sm">
      {/* App Bar */}
      <header className="h-16 glass sticky top-0 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary font-bold shadow-sm">
            LV
          </div>
          <div>
            <div className="text-label-sm text-on-surface-variant">Chào buổi sáng,</div>
            <div className="text-body-sm font-bold text-on-surface">Lê Văn C</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant relative">
            <BellIcon size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="p-6">
        <div className="card-elevated !p-4 bg-gradient-to-br from-primary-container to-primary text-on-primary flex justify-around">
          <div className="text-center">
            <div className="text-headline-md font-bold">12</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Jobs tháng</div>
          </div>
          <div className="h-10 w-px bg-white/20" />
          <div className="text-center">
            <div className="text-headline-md font-bold">4.9</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80 flex items-center justify-center gap-1">
              Rating <StarIcon size={8} className="fill-current" />
            </div>
          </div>
          <div className="h-10 w-px bg-white/20" />
          <div className="text-center">
            <div className="text-headline-md font-bold">2.4M</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Thu nhập</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex gap-8 border-b border-outline-variant">
        <button 
          onClick={() => setTab("new")}
          className={`pb-4 text-label-md font-bold transition-all relative ${tab === "new" ? "text-primary-container" : "text-on-surface-variant"}`}
        >
          Việc mới
          {tab === "new" && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary-container rounded-t-full" />}
          {newJobs.length > 0 && <span className="ml-2 px-1.5 py-0.5 bg-error text-white text-[10px] rounded-full">{newJobs.length}</span>}
        </button>
        <button 
          onClick={() => setTab("active")}
          className={`pb-4 text-label-md font-bold transition-all relative ${tab === "active" ? "text-primary-container" : "text-on-surface-variant"}`}
        >
          Đang làm
          {tab === "active" && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary-container rounded-t-full" />}
        </button>
      </div>

      {/* Job Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {tab === "new" ? (
          newJobs.length > 0 ? (
            newJobs.map(job => (
              <div key={job.id} className="card animate-fade-in-up space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary-container">
                      <job.icon size={20} />
                    </div>
                    <div>
                      <div className="text-body-sm font-bold text-on-surface">{job.service}</div>
                      <div className="text-label-sm text-on-surface-variant">{job.id}</div>
                    </div>
                  </div>
                  <div className="text-headline-md text-primary-container">{job.price}</div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <MapPinIcon size={14} />
                    <span className="text-body-sm">{job.address}</span>
                    <span className="text-label-sm px-1.5 py-0.5 bg-surface-container rounded-md">~{job.distance}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <ClockIcon size={14} />
                    <span className="text-body-sm">Hẹn lúc: {job.time}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button className="flex-1 btn-outline !py-2.5 !rounded-xl text-error border-error/20 hover:bg-error-container">Từ chối</button>
                  <button className="flex-[2] btn-primary !py-2.5 !rounded-xl">Nhận việc</button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-4 text-on-surface-variant">
                <BriefcaseIcon size={32} />
              </div>
              <p className="text-body-sm text-on-surface-variant">Chưa có việc mới nào quanh đây.</p>
            </div>
          )
        ) : (
          activeJobs.map(job => (
            <div key={job.id} className="card-elevated border-l-4 border-primary-container !p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="badge badge-in-progress">Đang thực hiện</span>
                <button className="text-primary-container font-bold text-body-sm">Chi tiết</button>
              </div>

              <div>
                <h3 className="text-body-md font-bold text-on-surface">{job.customer}</h3>
                <p className="text-body-sm text-on-surface-variant">{job.service}</p>
              </div>

              <div className="flex items-center gap-4 py-3 border-y border-outline-variant/50">
                <button className="flex-1 flex flex-col items-center gap-1 p-2 hover:bg-surface-container rounded-xl transition-colors">
                  <PhoneIcon size={20} className="text-success" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Gọi khách</span>
                </button>
                <div className="w-px h-8 bg-outline-variant/50" />
                <button className="flex-1 flex flex-col items-center gap-1 p-2 hover:bg-surface-container rounded-xl transition-colors">
                  <MapPinIcon size={20} className="text-primary-container" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Chỉ đường</span>
                </button>
              </div>

              <button className="w-full btn-primary !bg-success !border-success !py-3.5 !rounded-xl">
                Hoàn thành Job
              </button>
            </div>
          ))
        )}
      </div>

      {/* Bottom Nav */}
      <footer className="h-20 bg-white border-t border-outline-variant flex items-center justify-around px-6">
        <NavAction icon={LayoutDashboardIcon} label="Việc làm" active />
        <NavAction icon={BriefcaseIcon} label="Lịch sử" />
        <NavAction icon={DollarSignIcon} label="Ví" />
        <NavAction icon={UserIcon} label="Hồ sơ" />
      </footer>
    </div>
  );
}

function NavAction({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-primary-container' : 'text-on-surface-variant hover:text-on-surface'}`}>
      <Icon size={22} className={active ? 'scale-110' : ''} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
