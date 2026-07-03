"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getJobServices, isMissingWorkflowColumn, type JobWithWorkflow } from "@/lib/job-workflow";
import { 
  Briefcase, 
  Clock, 
  MapPin, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle,
  Timer,
  Wrench,
  Star,
  Camera,
  Search,
  RotateCcw,
  SlidersHorizontal
} from "lucide-react";

const statusFilters = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang xử lý" },
  { key: "completed", label: "Hoàn thành" },
  { key: "cancelled", label: "Đã hủy" },
];

const activeStatuses = ["pending", "confirmed", "assigned", "in_progress", "cancel_requested"];
const completedStatuses = ["completed", "done"];
const cancelledStatuses = ["cancelled"];

type CustomerJob = {
  id: string;
  job_code?: string | null;
  service_id?: string | null;
  address?: string | null;
  description?: string | null;
  scheduled_at: string;
  created_at?: string | null;
  quoted_price?: number | null;
  status: string;
  images?: string[] | null;
  service?: {
    id?: string | null;
    name?: string | null;
  } | null;
  job_services?: JobWithWorkflow["job_services"];
  ratings?: unknown[] | null;
};

export default function CustomerJobs() {
  const [jobs, setJobs] = useState<CustomerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchJobs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let result = await supabase
        .from('jobs')
        .select(`
          *,
          service:services!jobs_service_id_fkey(*),
          job_services(service:services(*)),
          ratings(*)
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (result.error && isMissingWorkflowColumn(result.error.message)) {
        result = await supabase
          .from('jobs')
          .select(`
            *,
            service:services!jobs_service_id_fkey(*),
            ratings(*)
          `)
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });
      }

      if (!result.error && result.data) {
        setJobs(result.data);
      }
      setLoading(false);
    };

    fetchJobs();
  }, [supabase]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Đang tìm thợ', color: 'bg-amber-100 text-amber-700', icon: Timer };
      case 'confirmed':
      case 'assigned':
        return { label: 'Đã nhận việc', color: 'bg-blue-100 text-blue-700', icon: CheckCircle };
      case 'in_progress':
        return { label: 'Đang thực hiện', color: 'bg-primary-container text-white', icon: Wrench };
      case 'completed':
      case 'done':
        return { label: 'Hoàn thành', color: 'bg-success-container text-success', icon: CheckCircle };
      case 'cancel_requested':
        return { label: 'Chờ admin duyệt huỷ', color: 'bg-warning-container text-warning', icon: AlertCircle };
      case 'cancelled':
        return { label: 'Đã hủy', color: 'bg-error-container text-error', icon: AlertCircle };
      default:
        return { label: status, color: 'bg-surface-container text-on-surface-variant', icon: Briefcase };
    }
  };

  const jobStats = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        acc.total += 1;
        if (activeStatuses.includes(job.status)) acc.active += 1;
        if (completedStatuses.includes(job.status)) acc.completed += 1;
        if (cancelledStatuses.includes(job.status)) acc.cancelled += 1;
        return acc;
      },
      { total: 0, active: 0, completed: 0, cancelled: 0 }
    );
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return jobs
      .filter((job) => {
        if (statusFilter === "active") return activeStatuses.includes(job.status);
        if (statusFilter === "completed") return completedStatuses.includes(job.status);
        if (statusFilter === "cancelled") return cancelledStatuses.includes(job.status);
        return true;
      })
      .filter((job) => {
        if (!normalizedQuery) return true;
        const haystack = [
          job.job_code,
          job.service?.name,
          ...getJobServices(job).map(service => service.name),
          job.address,
          job.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at || a.scheduled_at).getTime();
        const bTime = new Date(b.created_at || b.scheduled_at).getTime();
        return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [jobs, query, sortOrder, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 lg:px-8">
      <div className="app-hero-panel">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Theo dõi dịch vụ</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-white">Đơn của tôi</h1>
        <p className="mt-2 max-w-[19rem] text-sm leading-6 text-white/80">
          Xem trạng thái đặt lịch, ảnh hiện trạng và đánh giá sau khi hoàn thành.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Tổng đơn</p>
          <p className="mt-1 text-2xl font-extrabold text-on-surface">{jobStats.total}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Đang xử lý</p>
          <p className="mt-1 text-2xl font-extrabold text-primary">{jobStats.active}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Hoàn thành</p>
          <p className="mt-1 text-2xl font-extrabold text-success">{jobStats.completed}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Đã hủy</p>
          <p className="mt-1 text-2xl font-extrabold text-error">{jobStats.cancelled}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã đơn, dịch vụ, địa chỉ..."
              className="h-11 w-full rounded-lg border border-outline-variant/30 bg-white pl-10 pr-3 text-sm font-semibold text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="flex h-11 items-center gap-2 rounded-lg border border-outline-variant/30 bg-white px-3 text-sm font-bold text-on-surface-variant">
            <SlidersHorizontal className="h-4 w-4" />
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}
              className="bg-transparent text-sm font-bold text-on-surface outline-none"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((filter) => {
            const isActive = statusFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold transition-colors ${
                  isActive
                    ? "bg-primary-container text-white"
                    : "bg-surface-container text-on-surface-variant hover:bg-primary-fixed hover:text-primary-container"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => {
            const status = getStatusInfo(job.status);
            const StatusIcon = status.icon;
            return (
              <div 
                key={job.id} 
                className="overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-lowest shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
              >
                <div className="flex items-center justify-between bg-primary-fixed/50 px-4 py-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-primary-container">Mã đơn: {job.job_code}</span>
                  <div className={`w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${status.color}`}>
                    <StatusIcon size={12} />
                    {status.label}
                  </div>
                </div>
                <div className="p-4">
                <div className="grid gap-3 mb-3 sm:flex sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-primary-container flex items-center justify-center text-white shadow-sm">
                      <Briefcase size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-body-sm font-bold text-on-surface">
                        {job.service?.name || "Dịch vụ"}
                      </h3>
                      <p className="text-label-sm text-on-surface-variant">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.quoted_price || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Unrated badge for completed jobs */}
                {(job.status === 'completed' || job.status === 'done') && (!job.ratings || job.ratings.length === 0) && (
                  <Link 
                    href={`/customer/jobs/${job.id}`}
                    className="flex items-center gap-2 rounded-lg border border-amber-200/50 bg-amber-50 px-3 py-2 text-amber-700 transition-colors hover:bg-amber-100"
                  >
                    <Star size={14} className="animate-pulse" />
                    <span className="text-[11px] font-bold">Chưa đánh giá — nhấn để gửi nhận xét</span>
                  </Link>
                )}

                <div className="space-y-2 py-3 border-y border-outline-variant/10">
                  <div className="flex items-start gap-2 text-on-surface-variant">
                    <MapPin size={14} className="mt-0.5 shrink-0" />
                    <span className="text-body-xs line-clamp-2">{job.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Clock size={14} />
                    <span className="text-body-xs">
                      {new Date(job.scheduled_at).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                {job.images && job.images.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-label-sm text-on-surface-variant">
                    <Camera size={14} />
                    <span>{job.images.length} ảnh hiện trạng đã gửi</span>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <Link href={`/customer/booking?service=${job.service_id || ""}`} className="inline-flex items-center gap-1 rounded-lg border border-secondary-container/30 bg-white px-3 py-2 text-xs font-extrabold text-secondary-container shadow-sm">
                    <RotateCcw size={14} />
                    Đặt lại
                  </Link>
                  <Link href={`/customer/jobs/${job.id}`} className="inline-flex items-center gap-1 rounded-lg bg-secondary-container px-3 py-2 text-xs font-extrabold text-white shadow-sm">
                    Chi tiết
                    <ChevronRight size={14} />
                  </Link>
                </div>
                </div>
              </div>
            );
          })
        ) : jobs.length > 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-lowest py-16 text-center lg:col-span-2">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant/40">
              <Search size={26} />
            </div>
            <p className="text-body-sm font-bold text-on-surface">Không tìm thấy đơn phù hợp.</p>
            <p className="mt-1 text-label-sm text-on-surface-variant">Thử đổi từ khóa hoặc bộ lọc trạng thái.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
              className="mt-4 inline-flex rounded-xl bg-secondary-container px-4 py-2.5 text-sm font-extrabold text-white shadow-md shadow-secondary-container/20"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-lowest py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-4 text-on-surface-variant/30">
              <Briefcase size={32} />
            </div>
            <p className="text-body-sm text-on-surface-variant font-medium">Bạn chưa có đơn đặt dịch vụ nào.</p>
            <Link href="/customer/booking" className="mt-4 inline-flex rounded-xl bg-secondary-container px-4 py-2.5 text-sm font-extrabold text-white shadow-md shadow-secondary-container/20">
              Đặt dịch vụ ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
