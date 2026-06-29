"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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

export default function WorkerHistory() {
  const [loading, setLoading] = useState(true);
  const [historyJobs, setHistoryJobs] = useState<HistoryJob[]>([]);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHistoryJobs([]);
        setLoading(false);
        return;
      }

      const { data: workerData } = await supabase
        .from('workers')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (workerData) {
        const { data: jobs } = await supabase
          .from('jobs')
          .select('*, service:services(*), customer:profiles!customer_id(*)')
          .eq('worker_id', workerData.id)
          .in('status', ['completed', 'done', 'cancelled'])
          .order('updated_at', { ascending: false });
          
        if (jobs) {
          const iconMap: Record<string, IconComponent> = { ZapIcon, DropletIcon, CameraIcon, CogIcon };
          const mapped = ((jobs || []) as RawHistoryJob[]).map((j) => {
            const custName = Array.isArray(j.customer) ? j.customer[0]?.full_name : j.customer?.full_name;
            const fallbackDate = j.updated_at || j.scheduled_at || new Date().toISOString();
            return {
              ...j,
              customerName: custName || 'Khách vãng lai',
              serviceName: j.service?.name || 'Dịch vụ khác',
              icon: j.service?.icon ? iconMap[j.service.icon] || BriefcaseIcon : BriefcaseIcon,
              dateStr: new Date(fallbackDate).toLocaleDateString('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              }),
              timeStr: new Date(fallbackDate).toLocaleTimeString('vi-VN', {
                hour: '2-digit', minute: '2-digit'
              })
            };
          });
          setHistoryJobs(mapped);
        }
      }
      setLoading(false);
    };

    fetchHistory();
  }, [supabase]);

  return (
    <div className="flex flex-col w-full min-h-[calc(100dvh-8rem)] bg-surface p-4 animate-fade-in">
      <div className="app-hero-panel mb-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Hồ sơ công việc</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight" style={{ color: "#fcd34d" }}>Lịch sử việc làm</h1>
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
