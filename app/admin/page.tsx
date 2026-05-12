"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  LogoIcon,
  LayoutDashboardIcon,
  BriefcaseIcon,
  UsersIcon,
  CogIcon,
  BellIcon,
  SearchIcon,
  PlusIcon,
  FilterIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  MapPinIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  LogOutIcon,
  MenuIcon,
  BarChartIcon,
  DollarSignIcon
} from "../components/icons";

// Mock Data
const stats = [
  { label: "Tổng Jobs", value: "1,284", change: "+12%", icon: BriefcaseIcon, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Doanh thu", value: "42.5M", change: "+8%", icon: DollarSignIcon, color: "text-green-600", bg: "bg-green-50" },
  { label: "Thợ hoạt động", value: "86", change: "+4", icon: UsersIcon, color: "text-purple-600", bg: "bg-purple-50" },
  { label: "Đánh giá TB", value: "4.85", change: "+0.2", icon: BarChartIcon, color: "text-amber-600", bg: "bg-amber-50" },
];

const recentJobs = [
  { id: "JOB-9402", customer: "Nguyễn Văn A", service: "Sửa điện", price: "250,000đ", status: "pending", time: "10:30 AM", worker: null },
  { id: "JOB-9401", customer: "Trần Thị B", service: "Sửa nước", price: "180,000đ", status: "assigned", time: "09:15 AM", worker: "Lê Văn C" },
  { id: "JOB-9400", customer: "Phạm Minh C", service: "Lắp camera", price: "1,200,000đ", status: "in_progress", time: "08:45 AM", worker: "Hoàng Văn D" },
  { id: "JOB-9399", customer: "Lê Thu H", service: "Cơ khí", price: "450,000đ", status: "done", time: "Yesterday", worker: "Nguyễn Văn E" },
  { id: "JOB-9398", customer: "Đặng Văn F", service: "Sửa điện", price: "300,000đ", status: "cancelled", time: "Yesterday", worker: null },
];

export default function AdminDashboard() {
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*, customer:profiles(*), service:services(*), worker:workers(user:profiles(full_name))')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (jobs) setRecentJobs(jobs);
      setLoading(false);
    };
    fetchData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="card-elevated !p-6 flex items-center justify-between hover:scale-[1.02]">
            <div>
              <p className="text-label-md text-on-surface-variant mb-1">{stat.label}</p>
              <h3 className="text-headline-md font-bold text-on-surface">{stat.value}</h3>
              <p className="text-label-sm text-success font-medium mt-1">{stat.change} <span className="text-on-surface-variant font-normal">so với tháng trước</span></p>
            </div>
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions & Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Jobs Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-md text-lg font-bold text-on-surface">Jobs gần đây</h2>
            <div className="flex gap-2">
              <button className="btn-outline !py-2 !px-4 !text-sm !rounded-xl">
                <FilterIcon size={16} /> Lọc
              </button>
              <button className="btn-primary !py-2 !px-4 !text-sm !rounded-xl">
                <PlusIcon size={16} /> Tạo Job
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Mã Job</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Khách hàng</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Dịch vụ</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Thợ</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Trạng thái</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4 font-mono text-sm text-primary-container font-bold">{job.job_code}</td>
                    <td className="px-6 py-4">
                      <div className="text-body-sm font-semibold text-on-surface">{job.customer?.full_name}</div>
                      <div className="text-label-sm text-on-surface-variant">
                        {new Date(job.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {job.service?.icon === "ZapIcon" && <ZapIcon size={14} className="text-amber-500" />}
                        {job.service?.icon === "DropletIcon" && <DropletIcon size={14} className="text-blue-500" />}
                        {job.service?.icon === "CameraIcon" && <CameraIcon size={14} className="text-purple-500" />}
                        {job.service?.icon === "CogIcon" && <CogIcon size={14} className="text-green-500" />}
                        <span className="text-body-sm text-on-surface">{job.service?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-body-sm text-on-surface-variant">
                      {job.worker?.user?.full_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-[10px] font-bold">
                            {job.worker.user.full_name[0]}
                          </div>
                          {job.worker.user.full_name}
                        </div>
                      ) : (
                        <span className="italic text-outline">Chưa gán</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge badge-${job.status} uppercase text-[10px] font-bold`}>
                        {job.status === "pending" ? "Chờ xử lý" : 
                         job.status === "assigned" ? "Đã gán" :
                         job.status === "in_progress" ? "Đang làm" :
                         job.status === "completed" ? "Xong" : "Hủy"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant opacity-0 group-hover:opacity-100">
                        <ChevronRightIcon size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest text-center">
              <button className="text-body-sm font-bold text-primary-container hover:underline">Xem tất cả Jobs</button>
            </div>
          </div>
        </div>

        {/* Sidebar Stats / Pending Workers */}
        <div className="space-y-8">
          <div className="card-elevated !p-6 bg-[#003178] text-white">
            <h3 className="text-headline-md text-lg font-bold mb-4">Dispatcher Tip</h3>
            <p className="text-body-sm text-white/80 mb-6 leading-relaxed">
              Hãy gán thợ ngay để đảm bảo KPI phục vụ khách hàng tốt nhất.
            </p>
            <button className="btn-secondary w-full !rounded-xl !bg-amber-500 !text-white !border-none">Xem danh sách chờ</button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-label-md font-bold text-on-surface uppercase tracking-wider">Thợ mới đăng ký</h3>
              <span className="badge badge-pending">2 mới</span>
            </div>
            
            <div className="space-y-3">
              {[
                { name: "Phạm Văn Nam", exp: "Sửa điện • 3 năm", time: "2h trước" },
                { name: "Trần Thế Anh", exp: "Lắp camera • 5 năm", time: "5h trước" }
              ].map((worker) => (
                <div key={worker.name} className="card !p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-sm">
                      {worker.name[0]}
                    </div>
                    <div>
                      <div className="text-body-sm font-bold text-on-surface">{worker.name}</div>
                      <div className="text-label-sm text-on-surface-variant">{worker.exp}</div>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-primary-fixed rounded-lg text-primary-container transition-colors">
                    <CheckCircleIcon size={20} />
                  </button>
                </div>
              ))}
              <button className="w-full py-3 text-body-sm font-bold text-on-surface-variant hover:text-primary-container transition-colors text-center">Xem tất cả thợ</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
