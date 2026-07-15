"use client";

import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Users,
  UserCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface StatItem {
  label: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface RecentJob {
  id: string;
  customer: string;
  service: string;
  status: string;
  time: string;
}

type PendingWorker = {
  id: string;
  specialties?: string[] | null;
  profiles?: { full_name?: string | null } | null;
};

type DashboardJobRow = {
  job_code?: string | null;
  status?: string | null;
  created_at?: string | null;
  customer?: { full_name?: string | null } | null;
  service?: { name?: string | null } | null;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Chờ xử lý",
    className: "bg-warning/10 text-warning",
  },
  assigned: {
    label: "Đã gán thợ",
    className: "bg-info/10 text-info",
  },
  in_progress: {
    label: "Đang làm",
    className: "bg-primary-fixed text-primary",
  },
  done: {
    label: "Hoàn thành",
    className: "bg-success/10 text-success",
  },
  completed: {
    label: "Hoàn thành",
    className: "bg-success/10 text-success",
  },
  cancel_requested: {
    label: "Chờ duyệt huỷ",
    className: "bg-warning/10 text-warning",
  },
  cancelled: {
    label: "Đã hủy",
    className: "bg-error-container text-error",
  },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatItem[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [pendingWorkers, setPendingWorkers] = useState<PendingWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null });
  const [processingId, setProcessingId] = useState<string | null>(null);

  const supabase = createClient();

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: null }), 3500);
  };

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch Stats counts
      const [
        { count: totalJobs },
        { count: pendingJobs },
        { count: completedJobs },
        { count: activeWorkers },
        { data: jobsData },
        { data: workersData },
      ] = await Promise.all([
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["completed", "done"]),
        supabase
          .from("workers")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("jobs")
          .select(`
            id,
            job_code,
            status,
            created_at,
            customer:profiles!customer_id(full_name),
            service:services!jobs_service_id_fkey(name)
          `)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("workers")
          .select("id, specialties, profiles(full_name)")
          .eq("status", "pending")
          .limit(2),
      ]);

      setStats([
        {
          label: "Tổng Job",
          value: totalJobs?.toString() || "0",
          change: "+12%",
          icon: Briefcase,
          color: "bg-primary-fixed text-primary",
        },
        {
          label: "Đang chờ",
          value: pendingJobs?.toString() || "0",
          change: "",
          icon: Clock,
          color: "bg-warning/10 text-warning",
        },
        {
          label: "Hoàn thành",
          value: completedJobs?.toString() || "0",
          change: "+8%",
          icon: CheckCircle2,
          color: "bg-success/10 text-success",
        },
        {
          label: "Thợ hoạt động",
          value: activeWorkers?.toString() || "0",
          change: "+3",
          icon: UserCheck,
          color: "bg-info/10 text-info",
        },
      ]);

      if (jobsData) {
        const formattedJobs = (jobsData as DashboardJobRow[]).map((job) => {
          const createdAt = job.created_at ? new Date(job.created_at).getTime() : Date.now();
          const diffMin = Math.round((new Date().getTime() - createdAt) / 60000);
          let timeStr = "Vừa xong";
          if (diffMin > 0 && diffMin < 60) {
            timeStr = `${diffMin} phút trước`;
          } else if (diffMin >= 60 && diffMin < 1440) {
            timeStr = `${Math.round(diffMin / 60)} giờ trước`;
          } else if (diffMin >= 1440) {
            timeStr = `${Math.round(diffMin / 1440)} ngày trước`;
          }

          return {
            id: job.job_code || "JOB",
            customer: job.customer?.full_name || "Khách vãng lai",
            service: job.service?.name || "Dịch vụ",
            status: job.status || "pending",
            time: timeStr,
          };
        });
        setRecentJobs(formattedJobs);
      }

      if (workersData) {
        setPendingWorkers(workersData as unknown as PendingWorker[]);
      }
    } catch (err: unknown) {
      console.error(err);
      showToast("Lỗi nạp dữ liệu: " + (err instanceof Error ? err.message : "Không xác định"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchDashboardData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApproveWorker = async (worker: PendingWorker) => {
    setProcessingId(worker.id);
    const { error } = await supabase
      .from("workers")
      .update({ status: "active", approved_at: new Date().toISOString() })
      .eq("id", worker.id);

    setProcessingId(null);
    if (error) {
      showToast("Lỗi phê duyệt thợ: " + error.message, "error");
    } else {
      showToast(`Đã duyệt thợ "${worker.profiles?.full_name}" thành công!`, "success");
      setPendingWorkers(prev => prev.filter(w => w.id !== worker.id));
      // update active workers count
      setStats(prev => prev.map((s, idx) => 
        idx === 3 ? { ...s, value: (Number(s.value) + 1).toString() } : s
      ));
    }
  };

  const handleRejectWorker = async (worker: PendingWorker) => {
    setProcessingId(worker.id);
    const { error } = await supabase
      .from("workers")
      .update({ status: "blocked" })
      .eq("id", worker.id);

    setProcessingId(null);
    if (error) {
      showToast("Lỗi từ chối thợ: " + error.message, "error");
    } else {
      showToast(`Đã từ chối hồ sơ thợ "${worker.profiles?.full_name}"`, "success");
      setPendingWorkers(prev => prev.filter(w => w.id !== worker.id));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[calc(100vh-10rem)]">
      {/* Toast Alert */}
      {toast.type && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border transform transition-all duration-300 translate-y-0 ${
          toast.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          <span className="text-body-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Tổng quan</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Xin chào! Đây là tình hình hôm nay.
          </p>
        </div>
        <Link
          href="/admin/jobs?action=create"
          className="px-4 py-2.5 bg-secondary-container text-on-secondary font-semibold rounded-lg hover:opacity-90 transition-opacity text-body-sm flex items-center gap-2 shadow-sm"
        >
          <Briefcase className="w-4 h-4" />
          Tạo Job mới
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/20"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}
              >
                <stat.icon className="w-5 h-5" />
              </div>
              {stat.change && (
                <span className="flex items-center gap-0.5 text-label-sm text-success font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {stat.change}
                </span>
              )}
            </div>
            <p className="text-headline-md text-on-surface font-bold">
              {stat.value}
            </p>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Jobs */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
          <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
            <h2 className="text-body-lg font-semibold text-on-surface">
              Job gần đây
            </h2>
            <Link
              href="/admin/jobs"
              className="text-body-sm text-primary font-medium hover:underline flex items-center gap-1"
            >
              Xem tất cả
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {recentJobs.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-body-sm italic">
                Chưa có yêu cầu công việc nào trên hệ thống
              </div>
            ) : recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-container-low/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-label-sm text-on-surface-variant font-mono">
                    {job.id}
                  </span>
                  <div>
                    <p className="text-body-sm font-medium text-on-surface">
                      {job.customer}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {job.service}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-label-sm font-bold uppercase text-[9px] ${
                      statusConfig[job.status]?.className || "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {statusConfig[job.status]?.label || job.status}
                  </span>
                  <span className="text-label-sm text-on-surface-variant hidden sm:block">
                    {job.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Worker Approvals */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20">
          <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
            <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Thợ chờ duyệt
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-label-sm font-bold animate-pulse">
              {pendingWorkers.length}
            </span>
          </div>
          <div className="p-5 space-y-4">
            {pendingWorkers.length === 0 ? (
              <div className="text-center text-on-surface-variant text-body-sm italic py-4">
                Không có thợ mới chờ duyệt
              </div>
            ) : pendingWorkers.map((w) => (
              <div
                key={w.id}
                className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/20"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-label-md font-bold text-primary uppercase">
                    {w.profiles?.full_name ? w.profiles.full_name.charAt(0) : "W"}
                  </div>
                  <div>
                    <p className="text-body-sm font-medium text-on-surface">
                      {w.profiles?.full_name}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {w.specialties?.join(" • ") || "Thợ mới"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    disabled={processingId !== null}
                    onClick={() => handleApproveWorker(w)}
                    className="flex-1 py-2 bg-[#2e7d32] text-white hover:bg-[#1b5e20] text-label-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {processingId === w.id ? "..." : "Duyệt"}
                  </button>
                  <button 
                    disabled={processingId !== null}
                    onClick={() => handleRejectWorker(w)}
                    className="flex-1 py-2 bg-surface text-on-surface-variant text-label-sm font-semibold rounded-lg border border-outline-variant hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
            <Link
              href="/admin/workers?status=pending"
              className="block text-center text-body-sm text-primary font-medium hover:underline"
            >
              Xem tất cả thợ chờ duyệt →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
