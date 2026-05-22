"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarIcon,
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

export default function WorkerHistory() {
  const [loading, setLoading] = useState(true);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
          const iconMap: Record<string, any> = { ZapIcon, DropletIcon, CameraIcon, CogIcon };
          const mapped = jobs.map(j => {
            const custName = Array.isArray(j.customer) ? j.customer[0]?.full_name : j.customer?.full_name;
            return {
              ...j,
              customerName: custName || 'Khách vãng lai',
              serviceName: j.service?.name || 'Dịch vụ khác',
              icon: iconMap[j.service?.icon] || BriefcaseIcon,
              dateStr: new Date(j.updated_at || j.scheduled_at).toLocaleDateString('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              }),
              timeStr: new Date(j.updated_at || j.scheduled_at).toLocaleTimeString('vi-VN', {
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
  }, []);

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-8rem)] bg-surface p-4 animate-fade-in">
      <h1 className="text-headline-md text-on-surface font-bold">Lịch sử việc làm</h1>
      <p className="text-body-sm text-on-surface-variant mt-1 mb-6">
        Theo dõi lại các công việc bạn đã hoàn thành
      </p>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
        </div>
      ) : historyJobs.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant">
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
                <div className="card-elevated !p-4 flex gap-4 opacity-90 transition-all hover:opacity-100 hover:shadow-lg relative overflow-hidden cursor-pointer active:scale-[0.98]">
                  <div className={`w-1 shrink-0 absolute top-0 bottom-0 left-0 ${isCompleted ? 'bg-success' : 'bg-error'}`} />
                  
                  <div className="flex flex-col items-center min-w-[50px] border-r border-outline-variant pr-3">
                    <span className="text-label-sm font-bold text-on-surface-variant uppercase">{job.timeStr}</span>
                    <span className="text-[10px] text-on-surface-variant mt-1 whitespace-nowrap">{job.dateStr}</span>
                    <div className={`mt-2 w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'}`}>
                      {isCompleted ? <CheckCircleIcon size={18} /> : <XIcon size={18} />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-body-md font-bold text-on-surface truncate pr-2">{job.serviceName}</h3>
                      <span className="text-body-md font-bold text-primary-container whitespace-nowrap">
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
                    
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${
                        isCompleted 
                          ? 'bg-success/10 text-success' 
                          : 'bg-error/10 text-error'
                      }`}>
                        {isCompleted ? 'Hoàn thành' : 'Đã hủy'}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary-container uppercase tracking-wider">
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
