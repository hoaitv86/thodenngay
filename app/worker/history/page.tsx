"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  AirVent,
  Blocks,
  Bolt,
  Cable,
  Cpu,
  Cctv,
  Droplets,
  Hammer,
  Laptop,
  Monitor,
  Network,
  PlusCircle,
  Printer,
  Router,
  Settings,
  ShieldCheck,
  Smartphone,
  Sofa,
  Star,
  Truck,
  Users,
  Wifi,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCachedDataset, logOfflineDebug, setCachedDataset } from "@/lib/offline/cache";
import { makeWorkerDatasetKey, makeWorkerUserDatasetKey, type WorkerOfflineScope } from "@/lib/offline/worker-data";
import {
  CheckCircleIcon,
  XIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  MapPinIcon,
  BriefcaseIcon,
  UserIcon,
  ChevronRightIcon
} from "../../components/icons";

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

type RawHistoryJob = {
  id: string;
  status?: string | null;
  address?: string | null;
  quoted_price?: number | null;
  updated_at?: string | null;
  scheduled_at?: string | null;
  service?: {
    name?: string | null;
    icon?: string | null;
  } | null;
  customer?: { full_name?: string | null } | { full_name?: string | null }[] | null;
};

type HistoryJob = RawHistoryJob & {
  customerName: string;
  serviceName: string;
  icon: IconComponent;
  dateStr: string;
  timeStr: string;
};

type WorkerProfileCache = {
  worker?: { id?: string | null } | null;
  storeId?: string | null;
};

const WORKER_HISTORY_PAGE_SIZE = 50;
const completedHistoryStatuses = ["completed", "done", "cancelled"];
const historyIconMap: Record<string, IconComponent> = { ZapIcon, DropletIcon, CameraIcon, CogIcon, Bolt, Droplets, Cctv, Network, Laptop, Printer, Cpu, Router, Wifi, Cable, PlusCircle, Settings, ShieldCheck, Smartphone, Users, AirVent, Truck, Sofa, Hammer, Monitor, Star, Blocks, Wrench };

function mapHistoryJobs(jobs: RawHistoryJob[]) {
  return jobs
    .filter(job => completedHistoryStatuses.includes(job.status || ""))
    .slice(0, WORKER_HISTORY_PAGE_SIZE)
    .map((j) => {
      const custName = Array.isArray(j.customer) ? j.customer[0]?.full_name : j.customer?.full_name;
      const fallbackDate = j.updated_at || j.scheduled_at || new Date().toISOString();
      return {
        ...j,
        customerName: custName || "Khách vãng lai",
        serviceName: j.service?.name || "Dịch vụ khác",
        icon: j.service?.icon ? historyIconMap[j.service.icon] || BriefcaseIcon : BriefcaseIcon,
        dateStr: new Date(fallbackDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
        timeStr: new Date(fallbackDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      };
    });
}

export default function WorkerHistory() {
  const [loading, setLoading] = useState(true);
  const [historyJobs, setHistoryJobs] = useState<HistoryJob[]>([]);
  const supabase = useMemo(() => createClient(), []);

  const fetchHistory = React.useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setHistoryJobs([]);
      setLoading(false);
      return;
    }

    const cachedProfile = await getCachedDataset<WorkerProfileCache>(makeWorkerUserDatasetKey("worker-profile", user.id));
    let cacheScope: WorkerOfflineScope | null = cachedProfile?.data.worker?.id
      ? { userId: user.id, workerId: cachedProfile.data.worker.id, storeId: cachedProfile.data.storeId || null }
      : null;
    const cachedJobs = cacheScope ? await getCachedDataset<RawHistoryJob[]>(makeWorkerDatasetKey("jobs", cacheScope)) : null;
    const cachedHistoryJobs = cacheScope ? await getCachedDataset<RawHistoryJob[]>(makeWorkerDatasetKey("jobs", cacheScope, "history")) : null;
    const cachedSourceJobs = cachedJobs?.data || cachedHistoryJobs?.data || null;

    if (cachedSourceJobs) {
      const mapped = mapHistoryJobs(cachedSourceJobs);
      setHistoryJobs(mapped);
      logOfflineDebug("hydrated from cache", { dataset: "jobs", cacheKey: cachedJobs?.key || cachedHistoryJobs?.key || null, recordCount: mapped.length });
      setLoading(false);
    }

    if (typeof window !== "undefined" && !window.navigator.onLine) {
      logOfflineDebug("server fetch skipped", { dataset: "jobs", userId: user.id, variant: "history", reason: "offline" });
      return;
    }

    const { data: workerData, error: workerError } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (workerError || !workerData) {
      if (cachedSourceJobs) {
        logOfflineDebug("server fetch error", { dataset: "worker-profile", userId: user.id, reason: workerError?.message || "missing-worker" });
        return;
      }
      setHistoryJobs([]);
      setLoading(false);
      return;
    }

    cacheScope = cacheScope || { userId: user.id, workerId: workerData.id, storeId: cachedProfile?.data.storeId || null };

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        address,
        quoted_price,
        updated_at,
        scheduled_at,
        service:services!jobs_service_id_fkey(name, icon),
        customer:profiles!customer_id(full_name)
      `)
      .eq("worker_id", workerData.id)
      .in("status", completedHistoryStatuses)
      .order("updated_at", { ascending: false })
      .range(0, WORKER_HISTORY_PAGE_SIZE - 1);

    if (jobsError) {
      if (cachedSourceJobs) {
        logOfflineDebug("skipped cache overwrite", { dataset: "jobs", cacheKey: makeWorkerDatasetKey("jobs", cacheScope, "history"), reason: jobsError.message });
        return;
      }
      setHistoryJobs([]);
      setLoading(false);
      return;
    }

    const sourceJobs = (jobs || []) as RawHistoryJob[];
    const mapped = mapHistoryJobs(sourceJobs);
    setHistoryJobs(mapped);
    await setCachedDataset(makeWorkerDatasetKey("jobs", cacheScope, "history"), sourceJobs, { dataset: "jobs", variant: "history", userId: user.id, workerId: workerData.id, storeId: cacheScope.storeId || null });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchHistory(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchHistory]);

  return (
    <div className="flex flex-col w-full min-h-[calc(100dvh-8rem)] bg-surface p-4 animate-fade-in">
      <div className="app-hero-panel mb-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Hồ sơ công việc</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-primary-fixed">Lịch sử việc làm</h1>
        <p className="mt-2 max-w-[19rem] text-sm leading-6 text-white/80">
          Theo dõi các việc đã hoàn thành, đã hủy và doanh thu từng đơn.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
        </div>
      ) : historyJobs.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-4 text-on-surface-variant">
            <BriefcaseIcon size={32} />
          </div>
          <p className="text-body-md font-bold text-on-surface">Chưa có lịch sử</p>
          <p className="text-body-sm text-on-surface-variant mt-1">Bạn chưa hoàn thành công việc nào.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {historyJobs.map(job => {
            const isCompleted = job.status === 'completed' || job.status === 'done';
            return (
              <Link href={`/worker/history/${job.id}`} key={job.id} className="block">
                <div className="flex cursor-pointer gap-3 overflow-hidden rounded-lg border border-outline-variant/20 bg-white p-4 opacity-95 shadow-sm transition-all hover:opacity-100 hover:shadow-md active:scale-[0.98] sm:gap-4">
                  
                  <div className="flex flex-col items-center min-w-[48px] border-r border-outline-variant pr-2 sm:pr-3">
                    <span className="text-label-sm font-bold text-on-surface-variant uppercase">{job.timeStr}</span>
                    <span className="text-[10px] text-on-surface-variant mt-1 whitespace-nowrap">{job.dateStr}</span>
                    <div className={`mt-2 flex h-8 w-8 items-center justify-center rounded-full ${isCompleted ? 'bg-success text-white' : 'bg-error text-white'}`}>
                      {isCompleted ? <CheckCircleIcon size={18} /> : <XIcon size={18} />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="grid gap-1 sm:flex sm:justify-between sm:items-start mb-1">
                      <h3 className="text-body-md font-bold text-on-surface truncate pr-2">{job.serviceName}</h3>
                      <span className="text-sm sm:text-body-md font-bold text-primary-container whitespace-nowrap">
                        {(job.quoted_price || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 mt-2">
                      <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                        <UserIcon size={14} className="shrink-0" />
                        <span className="truncate font-medium">{job.customerName}</span>
                      </div>
                      {job.address && (
                        <div className="flex items-start gap-2 text-label-sm text-on-surface-variant">
                          <MapPinIcon size={14} className="shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{job.address}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        isCompleted 
                          ? 'bg-success-container text-success' 
                          : 'bg-error-container text-error'
                      }`}>
                        {isCompleted ? 'Hoàn thành' : 'Đã hủy'}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-primary-container uppercase tracking-wide">
                        Xem chi tiết
                        <ChevronRightIcon size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
