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

// Real data will be fetched from database
const statsPlaceholder = [
  { label: "Tổng Jobs", value: "...", change: "", icon: BriefcaseIcon, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Doanh thu", value: "...", change: "", icon: DollarSignIcon, color: "text-green-600", bg: "bg-green-50" },
  { label: "Thợ hoạt động", value: "...", change: "", icon: UsersIcon, color: "text-purple-600", bg: "bg-purple-50" },
  { label: "Đánh giá TB", value: "4.8", change: "", icon: BarChartIcon, color: "text-amber-600", bg: "bg-amber-50" },
];

export default function AdminDashboard() {
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [pendingWorkers, setPendingWorkers] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>(statsPlaceholder);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });
  const supabase = createClient();

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3500);
  };

  const handleQuickApprove = async (worker: any) => {
    setApprovingId(worker.id);
    const { error } = await supabase
      .from('workers')
      .update({ status: 'active', approved_at: new Date().toISOString() })
      .eq('id', worker.id);

    setApprovingId(null);
    if (error) {
      showToast('Lỗi: ' + error.message, 'error');
    } else {
      showToast(`Đã duyệt "${worker.profiles?.full_name}"!`, 'success');
      setPendingWorkers(prev => prev.filter(w => w.id !== worker.id));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Recent Jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*, customer:profiles!customer_id(*), service:services(*), worker:workers(profiles(full_name))')
        .order('created_at', { ascending: false })
        .limit(5);

      if (jobs) setRecentJobs(jobs);

      // 2. Fetch Pending Workers
      const { data: workers } = await supabase
        .from('workers')
        .select('*, profiles(full_name, created_at)')
        .eq('status', 'pending')
        .limit(2);
      
      if (workers) setPendingWorkers(workers);

      // 3. Fetch Stats (Dynamic metrics from database)
      // 3a. Total Jobs
      const { count: jobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true });

      // 3b. Revenue (Sum of completed/done jobs)
      const { data: completedJobs } = await supabase
        .from('jobs')
        .select('quoted_price')
        .in('status', ['completed', 'done']);
      
      const totalRevenue = completedJobs
        ? completedJobs.reduce((sum, j) => sum + Number(j.quoted_price || 0), 0)
        : 0;
      
      const formattedRevenue = totalRevenue >= 1000000 
        ? `${(totalRevenue / 1000000).toFixed(1)}M` 
        : `${(totalRevenue / 1000).toFixed(0)}K`;

      // 3c. Active Workers
      const { count: activeWorkersCount } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // 3d. Average Rating
      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('score');
      
      const averageScore = ratingsData && ratingsData.length > 0
        ? (ratingsData.reduce((sum, r) => sum + Number(r.score || 0), 0) / ratingsData.length).toFixed(1)
        : "5.0";

      const updatedStats = [
        { label: "Tổng Jobs", value: jobsCount?.toString() || "0", change: "+12%", icon: BriefcaseIcon, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Doanh thu", value: `${formattedRevenue}đ`, change: "+8%", icon: DollarSignIcon, color: "text-green-600", bg: "bg-green-50" },
        { label: "Thợ hoạt động", value: activeWorkersCount?.toString() || "0", change: "+3", icon: UsersIcon, color: "text-purple-600", bg: "bg-purple-50" },
        { label: "Đánh giá TB", value: `${averageScore} ★`, change: "+0.2", icon: BarChartIcon, color: "text-amber-600", bg: "bg-amber-50" },
      ];
      
      setStats(updatedStats);

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
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast */}
      {toast.type && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm px-5 py-3.5 rounded-xl shadow-lg border animate-fade-in flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-[#e8f5e9] text-[#2e7d32] border-[#2e7d32]/20' : 'bg-[#ffebee] text-[#c62828] border-[#c62828]/20'
        }`}>
          <span className="text-body-sm font-bold">{toast.message}</span>
        </div>
      )}
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
                      {job.worker?.profiles?.full_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-[10px] font-bold">
                            {job.worker.profiles.full_name[0]}
                          </div>
                          {job.worker.profiles.full_name}
                        </div>
                      ) : (
                        <Link href="/admin/jobs" className="italic text-primary-container hover:underline text-xs font-bold">Chưa gán →</Link>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge badge-${job.status === 'done' ? 'completed' : job.status} uppercase text-[10px] font-bold`}>
                        {job.status === "pending" ? "Chờ xử lý" :
                          job.status === "assigned" ? "Đã gán" :
                            job.status === "in_progress" ? "Đang làm" :
                              (job.status === "completed" || job.status === "done") ? "Xong" : "Hủy"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href="/admin/jobs" className="p-2 inline-block hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant opacity-0 group-hover:opacity-100">
                        <ChevronRightIcon size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest text-center">
              <Link href="/admin/jobs" className="text-body-sm font-bold text-primary-container hover:underline">Xem tất cả Jobs</Link>
            </div>
          </div>
        </div>

        {/* Sidebar Stats / Pending Workers */}
        <div className="space-y-8">
          <div className="card-elevated p-6! bg-[#003178] text-white">
            <h3 className="text-headline-md text-lg text-white! font-bold mb-4">Dispatcher Tip</h3>
            <p className="text-body-sm text-white! mb-6 leading-relaxed">
              Hãy gán thợ ngay để đảm bảo KPI phục vụ khách hàng tốt nhất.
            </p>
            <button className="btn-secondary w-full rounded-xl! bg-amber-500! text-white! border-none!">Xem danh sách chờ</button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-label-md font-bold text-on-surface uppercase tracking-wider">Thợ mới đăng ký</h3>
              {pendingWorkers.length > 0 && <span className="badge badge-pending">{pendingWorkers.length} mới</span>}
            </div>

            <div className="space-y-3">
              {pendingWorkers.map((worker) => (
                <div key={worker.id} className="card !p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-sm">
                      {worker.profiles?.full_name?.[0] || "W"}
                    </div>
                    <div>
                      <div className="text-body-sm font-bold text-on-surface">{worker.profiles?.full_name}</div>
                      <div className="text-label-sm text-on-surface-variant">
                        {worker.specialties?.join(' • ') || "Thợ mới"}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleQuickApprove(worker)}
                    disabled={approvingId === worker.id}
                    className="p-2 hover:bg-primary-fixed rounded-lg text-primary-container transition-colors disabled:opacity-50"
                    title="Duyệt nhanh"
                  >
                    {approvingId === worker.id ? (
                      <span className="w-5 h-5 border-2 border-primary-container/30 border-t-primary-container rounded-full animate-spin inline-block" />
                    ) : (
                      <CheckCircleIcon size={20} />
                    )}
                  </button>
                </div>
              ))}
              {pendingWorkers.length === 0 && (
                <p className="text-xs text-center text-on-surface-variant py-4 italic">Không có thợ mới chờ duyệt</p>
              )}
              <Link href="/admin/workers" className="block w-full py-3 text-body-sm font-bold text-on-surface-variant hover:text-primary-container transition-colors text-center">Xem tất cả thợ →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
