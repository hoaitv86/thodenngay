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
    label: "Chá» xá»­ lÃ½",
    className: "bg-warning/10 text-warning",
  },
  assigned: {
    label: "ÄÃ£ gÃ¡n thá»£",
    className: "bg-info/10 text-info",
  },
  in_progress: {
    label: "Äang lÃ m",
    className: "bg-primary-fixed text-primary",
  },
  done: {
    label: "HoÃ n thÃ nh",
    className: "bg-success/10 text-success",
  },
  completed: {
    label: "HoÃ n thÃ nh",
    className: "bg-success/10 text-success",
  },
  cancel_requested: {
    label: "Chá» duyá»‡t huá»·",
    className: "bg-warning/10 text-warning",
  },
  cancelled: {
    label: "ÄÃ£ há»§y",
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
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
          <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
            <h2 className="text-body-lg font-semibold text-on-surface">
              Job gáº§n Ä‘Ã¢y
            </h2>
            <Link
              href="/admin/jobs"
              className="text-body-sm text-primary font-medium hover:underline flex items-center gap-1"
            >
              Xem táº¥t cáº£
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {recentJobs.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-body-sm italic">
                ChÆ°a cÃ³ yÃªu cáº§u cÃ´ng viá»‡c nÃ o trÃªn há»‡ thá»‘ng
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

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20">
          <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
            <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Thá»£ chá» duyá»‡t
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-label-sm font-bold animate-pulse">
              {pendingWorkers.length}
            </span>
          </div>
          <div className="p-5 space-y-4">
            {pendingWorkers.length === 0 ? (
              <div className="text-center text-on-surface-variant text-body-sm italic py-4">
                KhÃ´ng cÃ³ thá»£ má»›i chá» duyá»‡t
              </div>
            ) : pendingWorkers.map((worker) => (
              <div
                key={worker.id}
                className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/20"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-label-md font-bold text-primary uppercase">
                    {worker.profiles?.full_name ? worker.profiles.full_name.charAt(0) : "W"}
                  </div>
                  <div>
                    <p className="text-body-sm font-medium text-on-surface">
                      {worker.profiles?.full_name}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {worker.specialties?.join(" â€¢ ") || "Thá»£ má»›i"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={processingId !== null}
                    onClick={() => onApproveWorker(worker)}
                    className="flex-1 py-2 bg-[#2e7d32] text-white hover:bg-[#1b5e20] text-label-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {processingId === worker.id ? "..." : "Duyá»‡t"}
                  </button>
                  <button
                    disabled={processingId !== null}
                    onClick={() => onRejectWorker(worker)}
                    className="flex-1 py-2 bg-surface text-on-surface-variant text-label-sm font-semibold rounded-lg border border-outline-variant hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    Tá»« chá»‘i
                  </button>
                </div>
              </div>
            ))}
            <Link
              href="/admin/workers?status=pending"
              className="block text-center text-body-sm text-primary font-medium hover:underline"
            >
              Xem táº¥t cáº£ thá»£ chá» duyá»‡t â†’
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
