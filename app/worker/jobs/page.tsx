"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CalendarClock, Clock, MapPin, Phone, Search, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCachedDataset, logOfflineDebug, setCachedDataset } from "@/lib/offline/cache";
import { isBrowserOffline, makeWorkerDatasetKey, makeWorkerUserDatasetKey, type WorkerOfflineScope } from "@/lib/offline/worker-data";
import { filterWorkerDashboardJobs, parseWorkerDashboardJobFilter, WORKER_DASHBOARD_JOB_FILTER_PARAM, WORKER_DASHBOARD_JOBS_SESSION_KEY, type WorkerDashboardJobFilter } from "@/lib/worker-dashboard-job-filters";

type CustomerProfile = {
  id?: string | null;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
};

type WorkerProfileCache = {
  worker?: { id?: string | null } | null;
  storeId?: string | null;
};

type WorkerDashboardSummaryCache = {
  newJobs?: BacklogJob[] | null;
  pendingApprovalJobs?: BacklogJob[] | null;
  activeJobs?: BacklogJob[] | null;
};

type WorkerDashboardJobsNavigationSnapshot = {
  capturedAt?: string | null;
  jobs?: BacklogJob[] | null;
};

type BacklogJob = {
  id: string;
  job_code?: string | null;
  status?: string | null;
  customer_id?: string | null;
  address?: string | null;
  description?: string | null;
  quoted_price?: number | string | null;
  created_at?: string | null;
  scheduled_at?: string | null;
  updated_at?: string | null;
  service?: { name?: string | null } | null;
  customer?: CustomerProfile | CustomerProfile[] | null;
};

const pendingStatuses = ["pending", "assigned", "in_progress", "cancel_requested"];
const WORKER_BACKLOG_LIMIT = 100;

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Chờ duyệt",
    className: "bg-warning/15 text-warning",
  },
  assigned: {
    label: "Mới nhận",
    className: "bg-primary-fixed text-primary-container",
  },
  in_progress: {
    label: "Đang làm",
    className: "bg-success-container text-success",
  },
  cancel_requested: {
    label: "Chờ hủy",
    className: "bg-error-container text-error",
  },
};

const dashboardFilterLabels: Record<WorkerDashboardJobFilter, { title: string; description: string; emptyTitle: string; emptyDescription: string }> = {
  todo: {
    title: "Cần làm",
    description: "Các việc mới, chờ duyệt và đang làm.",
    emptyTitle: "Không có việc cần làm",
    emptyDescription: "Danh sách hiện chưa có việc mới, chờ duyệt hoặc đang làm.",
  },
  today: {
    title: "Tồn hôm nay",
    description: "Các việc cần xử lý trong hôm nay.",
    emptyTitle: "Không có việc tồn hôm nay",
    emptyDescription: "Hiện chưa có công việc phù hợp trong hôm nay.",
  },
  month: {
    title: "Tồn tháng",
    description: "Các việc cần xử lý trong tháng này.",
    emptyTitle: "Không có việc tồn tháng",
    emptyDescription: "Hiện chưa có công việc phù hợp trong tháng này.",
  },
};

function filterBacklogJobs(jobs: BacklogJob[], currentMonthStart: Date) {
  return jobs.filter(job => pendingStatuses.includes(job.status || "") && isBeforeCurrentMonth(job, currentMonthStart));
}

function isBeforeCurrentMonth(job: BacklogJob, currentMonthStart: Date) {
  const dateValue = getJobDate(job);
  if (!dateValue) return false;
  const jobDate = new Date(dateValue);
  return !Number.isNaN(jobDate.getTime()) && jobDate < currentMonthStart;
}

function getCustomer(customer: BacklogJob["customer"]) {
  if (Array.isArray(customer)) return customer[0] || null;
  return customer || null;
}

function getJobDate(job: BacklogJob) {
  return job.scheduled_at || job.created_at || job.updated_at || null;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa có lịch";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có lịch";

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAgeLabel(value?: string | null) {
  if (!value) return "Chưa rõ ngày";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ ngày";

  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (diffDays === 0) return "Tạo hôm nay";
  if (diffDays === 1) return "Tồn 1 ngày";
  return `Tồn ${diffDays} ngày`;
}

function readDashboardJobsNavigationSnapshot(): WorkerDashboardJobsNavigationSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(WORKER_DASHBOARD_JOBS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkerDashboardJobsNavigationSnapshot;
    return Array.isArray(parsed.jobs) ? parsed : null;
  } catch {
    return null;
  }
}

function collectDashboardSummaryJobs(summary?: WorkerDashboardSummaryCache | null) {
  if (!summary) return null;
  return [
    ...(summary.newJobs || []),
    ...(summary.pendingApprovalJobs || []),
    ...(summary.activeJobs || []),
  ];
}

function getSnapshotDate(value?: string | null) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function WorkerJobs() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const dashboardFilter = parseWorkerDashboardJobFilter(searchParams.get(WORKER_DASHBOARD_JOB_FILTER_PARAM));
  const dashboardFilterLabel = dashboardFilter ? dashboardFilterLabels[dashboardFilter] : null;
  const [jobs, setJobs] = useState<BacklogJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const currentMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const fetchBacklogJobs = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const offline = isBrowserOffline();
    const cachedProfile = await getCachedDataset<WorkerProfileCache>(makeWorkerUserDatasetKey("worker-profile", user.id));
    let cacheScope: WorkerOfflineScope | null = cachedProfile?.data.worker?.id
      ? { userId: user.id, workerId: cachedProfile.data.worker.id, storeId: cachedProfile.data.storeId || null }
      : null;
    let cachedSourceJobs: BacklogJob[] | null = null;

    if (dashboardFilter) {
      const sessionSnapshot = readDashboardJobsNavigationSnapshot();
      let dashboardSourceJobs = sessionSnapshot?.jobs || null;
      let filterNow = getSnapshotDate(sessionSnapshot?.capturedAt);
      let cacheKey: string | null = null;

      if (!dashboardSourceJobs && cacheScope) {
        const cachedDashboard = await getCachedDataset<WorkerDashboardSummaryCache>(makeWorkerDatasetKey("dashboard-summary", cacheScope));
        dashboardSourceJobs = collectDashboardSummaryJobs(cachedDashboard?.data);
        filterNow = getSnapshotDate(cachedDashboard?.updatedAt);
        cacheKey = cachedDashboard?.key || null;

        if (!dashboardSourceJobs) {
          const cachedJobs = await getCachedDataset<BacklogJob[]>(makeWorkerDatasetKey("jobs", cacheScope, "dashboard"));
          dashboardSourceJobs = cachedJobs?.data || null;
          filterNow = getSnapshotDate(cachedJobs?.updatedAt);
          cacheKey = cachedJobs?.key || null;
        }
      }

      if (dashboardSourceJobs) {
        const nextJobs = filterWorkerDashboardJobs(dashboardSourceJobs, dashboardFilter, filterNow);
        setJobs(nextJobs);
        setLoading(false);
        logOfflineDebug("hydrated dashboard jobs filter", { dataset: "jobs", variant: dashboardFilter, cacheKey, recordCount: nextJobs.length });
        return;
      }

      setJobs([]);
      setMessage(offline
        ? "Chưa có dữ liệu công việc offline. Hãy mở Dashboard khi có mạng ít nhất một lần."
        : "Chưa có dữ liệu việc từ Dashboard. Hãy quay lại Dashboard và thử lại.");
      setLoading(false);
      if (offline) logOfflineDebug("server fetch skipped", { dataset: "jobs", userId: user.id, reason: "offline-dashboard-filter" });
      return;
    }

    if (offline) {
      const cachedJobs = cacheScope
        ? await getCachedDataset<BacklogJob[]>(makeWorkerDatasetKey("jobs", cacheScope, "dashboard"))
        : null;
      const cachedBacklogJobs = cacheScope
        ? await getCachedDataset<BacklogJob[]>(makeWorkerDatasetKey("jobs", cacheScope, "backlog"))
        : null;
      cachedSourceJobs = cachedBacklogJobs?.data || cachedJobs?.data || null;

      if (cachedSourceJobs) {
        setJobs(filterBacklogJobs(cachedSourceJobs, currentMonthStart));
        logOfflineDebug("hydrated from cache", { dataset: "jobs", cacheKey: cachedBacklogJobs?.key || cachedJobs?.key || null, recordCount: cachedSourceJobs.length });
      } else {
        setMessage("Chưa có dữ liệu công việc offline. Hãy mở màn này khi có mạng ít nhất một lần.");
      }
      setLoading(false);
      logOfflineDebug("server fetch skipped", { dataset: "jobs", userId: user.id, reason: "offline" });
      return;
    }

    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (workerError || !worker) {
      if (cachedSourceJobs) {
        logOfflineDebug("server fetch error", { dataset: "worker-profile", userId: user.id, reason: workerError?.message || "missing-worker" });
        return;
      }
      setMessage("Không tìm thấy hồ sơ thợ.");
      setJobs([]);
      setLoading(false);
      return;
    }

    cacheScope = cacheScope || { userId: user.id, workerId: worker.id, storeId: null };

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        job_code,
        status,
        customer_id,
        address,
        description,
        quoted_price,
        created_at,
        scheduled_at,
        updated_at,
        service:services!jobs_service_id_fkey(name),
        customer:profiles!customer_id(id, full_name, phone, address)
      `)
      .eq("worker_id", worker.id)
      .in("status", pendingStatuses)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .range(0, WORKER_BACKLOG_LIMIT - 1);

    if (error) {
      if (cachedSourceJobs) {
        logOfflineDebug("skipped cache overwrite", { dataset: "jobs", cacheKey: makeWorkerDatasetKey("jobs", cacheScope, "backlog"), reason: error.message });
        return;
      }
      setMessage("Không thể tải danh sách tồn việc: " + error.message);
      setJobs([]);
      setLoading(false);
      return;
    }

    const sourceJobs = (data || []) as BacklogJob[];
    const nextJobs = filterBacklogJobs(sourceJobs, currentMonthStart);
    setJobs(nextJobs);
    await setCachedDataset(makeWorkerDatasetKey("jobs", cacheScope, "backlog"), sourceJobs, { dataset: "jobs", variant: "backlog", userId: user.id, workerId: worker.id, storeId: cacheScope.storeId || null });
    setLoading(false);
  }, [currentMonthStart, dashboardFilter, supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchBacklogJobs(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchBacklogJobs]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    const sortedJobs = [...jobs].sort((a, b) => {
      const aTime = new Date(getJobDate(a) || 0).getTime() || 0;
      const bTime = new Date(getJobDate(b) || 0).getTime() || 0;
      return aTime - bTime;
    });

    if (!normalizedQuery) return sortedJobs;

    return sortedJobs.filter((job) => {
      const customer = getCustomer(job.customer);
      const haystack = [
        job.job_code,
        job.description,
        job.address,
        job.service?.name,
        customer?.full_name,
        customer?.phone,
        customer?.address,
      ].filter(Boolean).join(" ").toLocaleLowerCase("vi");

      return haystack.includes(normalizedQuery);
    });
  }, [jobs, query]);

  const stats = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        acc.total += 1;
        if (job.status === "in_progress") acc.inProgress += 1;
        if (job.status === "pending") acc.pending += 1;
        return acc;
      },
      { total: 0, inProgress: 0, pending: 0 }
    );
  }, [jobs]);

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-surface p-4 animate-fade-in lg:p-6">
      <header className="mb-4 overflow-hidden rounded-xl border border-primary/10 bg-white shadow-sm">
        <div className="hero-gradient px-5 py-5 text-white">
          <p className="text-[11px] font-bold uppercase text-white/75">{dashboardFilterLabel ? "Việc của tôi" : "Tồn việc"}</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight text-primary-fixed">
            {dashboardFilterLabel?.title || "Việc cũ chưa làm"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
            {dashboardFilterLabel?.description || "Chỉ hiển thị các việc chưa hoàn thành từ những tháng trước. Việc trong tháng hiện tại không nằm ở danh sách này."}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-outline-variant/30 bg-white text-center">
          <div className="px-2 py-3">
            <p className="text-xl font-extrabold text-on-surface">{stats.total}</p>
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">{dashboardFilterLabel ? "Tổng" : "Tồn cũ"}</p>
          </div>
          <div className="px-2 py-3">
            <p className="text-xl font-extrabold text-success">{stats.inProgress}</p>
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Đang làm</p>
          </div>
          <div className="px-2 py-3">
            <p className="text-xl font-extrabold text-warning">{stats.pending}</p>
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Chờ duyệt</p>
          </div>
        </div>
      </header>

      <label className="relative mb-4 block">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          className="input-field !pl-10"
          placeholder="Tìm theo khách hàng, số điện thoại, mã việc, dịch vụ..."
        />
      </label>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
        </div>
      ) : message ? (
        <div className="rounded-lg border border-error/20 bg-error-container p-4 text-sm font-bold text-error">
          {message}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant bg-white p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-primary-container">
            <UserRound size={28} />
          </div>
          <p className="mt-4 font-extrabold text-on-surface">{dashboardFilterLabel?.emptyTitle || "Không có tồn việc tháng trước"}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{dashboardFilterLabel?.emptyDescription || "Các việc chưa hoàn thành trong tháng hiện tại sẽ không hiện ở mục này."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const customer = getCustomer(job.customer);
            const dateValue = getJobDate(job);
            const status = statusLabels[job.status || ""] || {
              label: job.status || "Chưa rõ",
              className: "bg-surface-container-low text-on-surface-variant",
            };

            return (
              <article key={job.id} className="overflow-hidden rounded-xl border border-error/25 bg-white shadow-sm">
                <div className="h-1 bg-error" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-bold text-primary-container">{job.job_code || job.id.slice(0, 8)}</p>
                      <h2 className="mt-1 truncate text-base font-extrabold text-on-surface">
                        {customer?.full_name || "Khách hàng"}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-on-surface-variant">
                        {job.service?.name || "Dịch vụ"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  {job.description && (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-on-surface-variant">{job.description}</p>
                  )}

                  <div className="mt-3 grid gap-2 text-sm text-on-surface-variant">
                    <div className="flex items-start gap-2">
                      <CalendarClock size={16} className="mt-0.5 shrink-0 text-primary-container" />
                      <span>{formatDateTime(dateValue)}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock size={16} className="mt-0.5 shrink-0 text-error" />
                      <span className="font-bold text-error">{getAgeLabel(dateValue)}</span>
                    </div>
                    {(customer?.phone) && (
                      <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 font-bold text-success">
                        <Phone size={16} className="shrink-0" />
                        {customer.phone}
                      </a>
                    )}
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-on-surface-variant" />
                      <span className="line-clamp-2">{job.address || customer?.address || "Chưa có địa chỉ"}</span>
                    </div>
                    <div className="flex items-center gap-2 font-bold text-on-surface">
                      <Banknote size={16} className="shrink-0 text-primary-container" />
                      {currencyFormatter.format(Number(job.quoted_price || 0))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}


function WorkerJobsLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center bg-surface p-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
    </div>
  );
}

export default function WorkerJobsPage() {
  return (
    <Suspense fallback={<WorkerJobsLoading />}>
      <WorkerJobs />
    </Suspense>
  );
}
