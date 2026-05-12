"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  LogoIcon,
  BriefcaseIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  XIcon,
  ChevronRightIcon,
  PhoneIcon,
  UserIcon,
  StarIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  BellIcon,
  LayoutDashboardIcon,
  DollarSignIcon
} from "../components/icons";

import { createClient } from "@/lib/supabase/client";
import { User, Worker, Job } from "@/lib/types";

export default function WorkerDashboard() {
  const [tab, setTab] = useState<"new" | "active">("new");
  const [loading, setLoading] = useState(true);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [newJobs, setNewJobs] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Get worker profile
      const { data: workerData } = await supabase
        .from('workers')
        .select('*, user:profiles(*)')
        .eq('user_id', user.id)
        .single();
      
      if (workerData) {
        setWorker(workerData);

        // 3. Get New Jobs (Pending)
        const { data: pendingJobs } = await supabase
          .from('jobs')
          .select('*, service:services(*)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        
        // Map icon component
        const iconMap: Record<string, any> = { ZapIcon, DropletIcon, CameraIcon, CogIcon };
        const mappedNew = (pendingJobs || []).map(j => ({
          ...j,
          serviceName: j.service?.name,
          icon: iconMap[j.service?.icon] || BriefcaseIcon,
          price: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(j.quoted_price),
          time: new Date(j.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          distance: "1.2 km" // Mock distance for now
        }));
        setNewJobs(mappedNew);

        // 4. Get Active Jobs (Assigned to this worker)
        const { data: assignedJobs } = await supabase
          .from('jobs')
          .select('*, service:services(*), customer:profiles(*)')
          .eq('worker_id', workerData.id)
          .eq('status', 'in_progress');
        
        const mappedActive = (assignedJobs || []).map(j => ({
          ...j,
          customerName: j.customer?.full_name,
          serviceName: j.service?.name,
          time: new Date(j.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }));
        setActiveJobs(mappedActive);
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Stats Bar */}
      <div className="p-4">
        <div className="card-elevated !p-5 bg-gradient-to-br from-[#003178] to-[#0d47a1] text-white flex justify-around rounded-2xl shadow-xl shadow-blue-900/10">
          <div className="text-center">
            <div className="text-3xl font-extrabold">{worker?.total_jobs || 0}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mt-1">Jobs tháng</div>
          </div>
          <div className="h-12 w-px bg-white/20 self-center" />
          <div className="text-center">
            <div className="text-3xl font-extrabold">{worker?.avg_rating || 0}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mt-1 flex items-center justify-center gap-1">
              Rating <StarIcon size={10} className="fill-current text-amber-400" />
            </div>
          </div>
          <div className="h-12 w-px bg-white/20 self-center" />
          <div className="text-center">
            <div className="text-3xl font-extrabold text-amber-400">0</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mt-1">Thu nhập</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 flex gap-8 border-b border-outline-variant">
        <button 
          onClick={() => setTab("new")}
          className={`pb-4 text-label-md font-bold transition-all relative ${tab === "new" ? "text-primary-container" : "text-on-surface-variant"}`}
        >
          Việc mới
          {tab === "new" && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary-container rounded-t-full" />}
          {newJobs.length > 0 && <span className="ml-2 px-1.5 py-0.5 bg-error text-white text-[10px] rounded-full">{newJobs.length}</span>}
        </button>
        <button 
          onClick={() => setTab("active")}
          className={`pb-4 text-label-md font-bold transition-all relative ${tab === "active" ? "text-primary-container" : "text-on-surface-variant"}`}
        >
          Đang làm
          {tab === "active" && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary-container rounded-t-full" />}
        </button>
      </div>

      {/* Job Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "new" ? (
          newJobs.length > 0 ? (
            newJobs.map(job => (
              <div key={job.id} className="card animate-fade-in-up space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary-container">
                      <job.icon size={20} />
                    </div>
                    <div>
                      <div className="text-body-sm font-bold text-on-surface">{job.serviceName}</div>
                      <div className="text-label-sm text-on-surface-variant">{job.job_code}</div>
                    </div>
                  </div>
                  <div className="text-headline-md text-primary-container">{job.price}</div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <MapPinIcon size={14} />
                    <span className="text-body-sm">{job.address}</span>
                    <span className="text-label-sm px-1.5 py-0.5 bg-surface-container rounded-md">~{job.distance}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <ClockIcon size={14} />
                    <span className="text-body-sm">Hẹn lúc: {job.time}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button className="flex-1 btn-outline !py-2.5 !rounded-xl text-error border-error/20 hover:bg-error-container">Từ chối</button>
                  <button className="flex-[2] btn-primary !py-2.5 !rounded-xl">Nhận việc</button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-4 text-on-surface-variant">
                <BriefcaseIcon size={32} />
              </div>
              <p className="text-body-sm text-on-surface-variant">Chưa có việc mới nào quanh đây.</p>
            </div>
          )
        ) : (
          activeJobs.map(job => (
            <div key={job.id} className="card-elevated border-l-4 border-primary-container !p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="badge badge-in-progress">Đang thực hiện</span>
                <button className="text-primary-container font-bold text-body-sm">Chi tiết</button>
              </div>

              <div>
                <h3 className="text-body-md font-bold text-on-surface">{job.customerName}</h3>
                <p className="text-body-sm text-on-surface-variant">{job.serviceName}</p>
              </div>

              <div className="flex items-center gap-4 py-3 border-y border-outline-variant/50">
                <button className="flex-1 flex flex-col items-center gap-1 p-2 hover:bg-surface-container rounded-xl transition-colors">
                  <PhoneIcon size={20} className="text-success" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Gọi khách</span>
                </button>
                <div className="w-px h-8 bg-outline-variant/50" />
                <button className="flex-1 flex flex-col items-center gap-1 p-2 hover:bg-surface-container rounded-xl transition-colors">
                  <MapPinIcon size={20} className="text-primary-container" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Chỉ đường</span>
                </button>
              </div>

              <button className="w-full btn-primary !bg-success !border-success !py-3.5 !rounded-xl">
                Hoàn thành Job
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NavAction({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-primary-container' : 'text-on-surface-variant hover:text-on-surface'}`}>
      <Icon size={22} className={active ? 'scale-110' : ''} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
