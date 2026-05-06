"use client";

import React, { useState } from "react";
import Link from "next/link";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-outline-variant transition-all duration-300 flex flex-col z-50`}>
        <div className="p-6 flex items-center gap-3">
          <LogoIcon size={32} />
          {sidebarOpen && <span className="font-bold text-xl text-primary-container tracking-tight">Alo Thợ</span>}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavItem icon={LayoutDashboardIcon} label="Dashboard" active sidebarOpen={sidebarOpen} />
          <NavItem icon={BriefcaseIcon} label="Quản lý Jobs" sidebarOpen={sidebarOpen} badge={5} />
          <NavItem icon={UsersIcon} label="Quản lý Thợ" sidebarOpen={sidebarOpen} />
          <NavItem icon={UserIcon} label="Khách hàng" sidebarOpen={sidebarOpen} />
          <NavItem icon={CogIcon} label="Dịch vụ & Giá" sidebarOpen={sidebarOpen} />
          <NavItem icon={BarChartIcon} label="Báo cáo" sidebarOpen={sidebarOpen} />
        </nav>

        <div className="p-4 border-t border-outline-variant">
          <button className="flex items-center gap-3 w-full p-3 text-on-surface-variant hover:bg-error-container hover:text-error rounded-xl transition-colors">
            <LogOutIcon size={20} />
            {sidebarOpen && <span className="text-body-sm font-medium">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-outline-variant flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant"
            >
              <MenuIcon size={20} />
            </button>
            <h1 className="text-headline-md text-lg font-bold text-on-surface">Tổng quan</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden sm:block">
              <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input 
                type="text" 
                placeholder="Tìm kiếm job, thợ..." 
                className="input-field !py-2 !pl-10 !pr-4 !w-64 !text-sm"
              />
            </div>
            
            <button className="relative p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant">
              <BellIcon size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-white" />
            </button>

            <div className="flex items-center gap-3 border-l border-outline-variant pl-6">
              <div className="text-right hidden sm:block">
                <div className="text-body-sm font-bold text-on-surface">Admin Alo Thợ</div>
                <div className="text-label-sm text-on-surface-variant">Điều phối viên</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary-container font-bold shadow-sm">
                AD
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                        <td className="px-6 py-4 font-mono text-sm text-primary-container font-bold">{job.id}</td>
                        <td className="px-6 py-4">
                          <div className="text-body-sm font-semibold text-on-surface">{job.customer}</div>
                          <div className="text-label-sm text-on-surface-variant">{job.time}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {job.service === "Sửa điện" && <ZapIcon size={14} className="text-amber-500" />}
                            {job.service === "Sửa nước" && <DropletIcon size={14} className="text-blue-500" />}
                            {job.service === "Lắp camera" && <CameraIcon size={14} className="text-purple-500" />}
                            {job.service === "Cơ khí" && <CogIcon size={14} className="text-green-500" />}
                            <span className="text-body-sm text-on-surface">{job.service}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-body-sm text-on-surface-variant">
                          {job.worker ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-[10px] font-bold">
                                {job.worker[0]}
                              </div>
                              {job.worker}
                            </div>
                          ) : (
                            <span className="italic text-outline">Chưa gán</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`badge badge-${job.status}`}>
                            {job.status === "pending" && "Chờ xử lý"}
                            {job.status === "assigned" && "Đã gán"}
                            {job.status === "in_progress" && "Đang làm"}
                            {job.status === "done" && "Hoàn thành"}
                            {job.status === "cancelled" && "Đã hủy"}
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
              <div className="card-elevated !p-6 bg-primary-container text-on-primary">
                <h3 className="text-headline-md text-lg font-bold mb-4">Dispatcher Tip</h3>
                <p className="text-body-sm text-white/80 mb-6 leading-relaxed">
                  Hiện có <span className="font-bold text-white">4 jobs</span> chưa có người nhận trong hơn 15 phút. Hãy gán thợ ngay để đảm bảo KPI.
                </p>
                <button className="btn-secondary w-full !rounded-xl">Xem danh sách chờ</button>
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
                  <button className="w-full py-3 text-body-sm font-bold text-on-surface-variant hover:text-primary-container transition-colors">Xem tất cả thợ</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false, sidebarOpen, badge }: { 
  icon: any, label: string, active?: boolean, sidebarOpen: boolean, badge?: number 
}) {
  return (
    <button className={`
      flex items-center gap-3 w-full p-3 rounded-xl transition-all group
      ${active ? 'bg-primary-container text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}
    `}>
      <Icon size={20} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
      {sidebarOpen && (
        <span className="flex-1 text-left text-body-sm font-medium">{label}</span>
      )}
      {sidebarOpen && badge && (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-primary-fixed text-primary-container'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}
