"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Briefcase,
  UserCheck,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DashboardWidgets = dynamic(() => import("./DashboardWidgets"));

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
          color: "bg-primary-fixed text-primary-container",
        },
        {
          label: "Hoàn thành",
          value: completedJobs?.toString() || "0",
          change: "+8%",
          icon: CheckCircle2,
          color: "bg-secondary-fixed text-primary",
        },
        {
          label: "Thợ hoạt động",
          value: activeWorkers?.toString() || "0",
          change: "+3",
          icon: UserCheck,
          color: "bg-primary-fixed-dim text-primary-container",
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
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-lg shadow-elevated border transform transition-all duration-300 translate-y-0 ${
          toast.type === "success" 
            ? "bg-success-container border-success/25 text-on-success-container"
            : "bg-error-container border-error/25 text-on-error-container"
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
          className="btn-primary !min-h-0 !px-4 !py-2.5 text-body-sm"
        >
          <Briefcase className="w-4 h-4" />
          Tạo Job mới
        </Link>
      </div>

      <DashboardWidgets
        stats={stats}
        recentJobs={recentJobs}
        pendingWorkers={pendingWorkers}
        processingId={processingId}
        onApproveWorker={handleApproveWorker}
        onRejectWorker={handleRejectWorker}
      />
    </div>
  );
}
