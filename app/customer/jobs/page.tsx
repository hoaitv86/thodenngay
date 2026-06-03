"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
  Camera
} from "lucide-react";

export default function CustomerJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchJobs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          service:services(*),
          ratings(*)
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setJobs(data);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#003178] via-[#0d47a1] to-[#fd6c00] p-5 text-white shadow-xl shadow-primary/15">
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Theo dõi dịch vụ</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-white">Đơn của tôi</h1>
        <p className="mt-2 max-w-[19rem] text-sm leading-6 text-white/80">
          Xem trạng thái đặt lịch, ảnh hiện trạng và đánh giá sau khi hoàn thành.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {jobs.length > 0 ? (
          jobs.map((job) => {
            const status = getStatusInfo(job.status);
            const StatusIcon = status.icon;
            return (
              <div 
                key={job.id} 
                className="overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-lg shadow-blue-900/5 transition-all hover:shadow-xl active:scale-[0.98]"
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
                    <div className="w-11 h-11 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-md shadow-primary/20">
                      <Briefcase size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-body-sm font-bold text-on-surface">
                        {job.service?.name || "Dịch vụ"}
                      </h3>
                      <p className="text-label-sm text-on-surface-variant">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.quoted_price)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Unrated badge for completed jobs */}
                {(job.status === 'completed' || job.status === 'done') && (!job.ratings || job.ratings.length === 0) && (
                  <Link 
                    href={`/customer/jobs/${job.id}`}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200/50 rounded-xl text-amber-700 hover:bg-amber-100 transition-colors"
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

                <div className="mt-3 flex items-center justify-end">
                  <Link href={`/customer/jobs/${job.id}`} className="inline-flex items-center gap-1 rounded-xl bg-secondary-container px-3 py-2 text-xs font-extrabold text-white shadow-md shadow-secondary-container/20">
                    Chi tiết
                    <ChevronRight size={14} />
                  </Link>
                </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 bg-surface-container-lowest rounded-3xl border border-dashed border-outline-variant/50">
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
