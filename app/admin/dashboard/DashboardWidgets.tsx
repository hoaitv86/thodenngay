"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, TrendingUp } from "lucide-react";

type StatItem = {
  label: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

type RecentJob = {
  id: string;
  customer: string;
  service: string;
  status: string;
  time: string;
};

type PendingWorker = {
  id: string;
  specialties?: string[] | null;
  profiles?: { full_name?: string | null } | null;
};

type DashboardWidgetsProps = {
  stats: StatItem[];
  recentJobs: RecentJob[];
  pendingWorkers: PendingWorker[];
  processingId: string | null;
  onApproveWorker: (worker: PendingWorker) => void;
  onRejectWorker: (worker: PendingWorker) => void;
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
    label: "Đã huỷ",
    className: "bg-error-container text-error",
  },
};

export default function DashboardWidgets({
  stats,
  recentJobs,
  pendingWorkers,
  processingId,
  onApproveWorker,
  onRejectWorker,
}: DashboardWidgetsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
              >
                <stat.icon className="h-5 w-5" />
              </div>
              {stat.change && (
                <span className="flex items-center gap-0.5 text-label-sm font-medium text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {stat.change}
                </span>
              )}
            </div>
            <p className="text-headline-md font-bold text-on-surface">
              {stat.value}
            </p>
            <p className="mt-0.5 text-label-sm text-on-surface-variant">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest lg:col-span-2">
          <div className="flex items-center justify-between border-b border-outline-variant/20 p-5">
            <h2 className="text-body-lg font-semibold text-on-surface">
              Job gần đây
            </h2>
            <Link
              href="/admin/jobs"
              className="flex items-center gap-1 text-body-sm font-medium text-primary hover:underline"
            >
              Xem tất cả
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {recentJobs.length === 0 ? (
              <div className="p-8 text-center text-body-sm italic text-on-surface-variant">
                Chưa có yêu cầu công việc nào trên hệ thống
              </div>
            ) : recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface-container-low/50"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-label-sm text-on-surface-variant">
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
                    className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase text-label-sm ${
                      statusConfig[job.status]?.className || "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {statusConfig[job.status]?.label || job.status}
                  </span>
                  <span className="hidden text-label-sm text-on-surface-variant sm:block">
                    {job.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
          <div className="flex items-center justify-between border-b border-outline-variant/20 p-5">
            <h2 className="flex items-center gap-2 text-body-lg font-semibold text-on-surface">
              <AlertCircle className="h-5 w-5 text-warning" />
              Thợ chờ duyệt
            </h2>
            <span className="animate-pulse rounded-full bg-warning/10 px-2 py-0.5 text-label-sm font-bold text-warning">
              {pendingWorkers.length}
            </span>
          </div>
          <div className="space-y-4 p-5">
            {pendingWorkers.length === 0 ? (
              <div className="py-4 text-center text-body-sm italic text-on-surface-variant">
                Không có thợ mới chờ duyệt
              </div>
            ) : pendingWorkers.map((worker) => (
              <div
                key={worker.id}
                className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-label-md font-bold uppercase text-primary">
                    {worker.profiles?.full_name ? worker.profiles.full_name.charAt(0) : "W"}
                  </div>
                  <div>
                    <p className="text-body-sm font-medium text-on-surface">
                      {worker.profiles?.full_name}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {worker.specialties?.join(" • ") || "Thợ mới"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={processingId !== null}
                    onClick={() => onApproveWorker(worker)}
                    className="flex-1 rounded-lg bg-[#2e7d32] py-2 text-label-sm font-semibold text-white transition-opacity hover:bg-[#1b5e20] hover:opacity-90 disabled:opacity-50"
                  >
                    {processingId === worker.id ? "..." : "Duyệt"}
                  </button>
                  <button
                    disabled={processingId !== null}
                    onClick={() => onRejectWorker(worker)}
                    className="flex-1 rounded-lg border border-outline-variant bg-surface py-2 text-label-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
            <Link
              href="/admin/workers?status=pending"
              className="block text-center text-body-sm font-medium text-primary hover:underline"
            >
              Xem tất cả thợ chờ duyệt →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
