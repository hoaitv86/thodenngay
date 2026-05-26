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
    <div className="px-4 py-6 space-y-6 max-w-md mx-auto">
      <div>
        <h1 className="text-headline-md text-on-surface">Đơn của tôi</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Theo dõi trạng thái và lịch sử các đơn đặt dịch vụ.
        </p>
      </div>

      <div className="space-y-4">
        {jobs.length > 0 ? (
          jobs.map((job) => {
            const status = getStatusInfo(job.status);
            const StatusIcon = status.icon;
            return (
              <div 
                key={job.id} 
                className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="grid gap-3 mb-3 sm:flex sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary">
                      <Briefcase size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-body-sm font-bold text-on-surface">
                        {job.service?.name || "Dịch vụ"}
                      </h3>
                      <p className="text-label-sm text-on-surface-variant">
                        Mã đơn: {job.job_code}
                      </p>
                    </div>
                  </div>
                  <div className={`w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${status.color}`}>
                    <StatusIcon size={12} />
                    {status.label}
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

                <div className="flex items-center justify-between mt-3">
                  <div className="text-body-sm font-bold text-primary-container">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.quoted_price)}
                  </div>
                  <Link href={`/customer/jobs/${job.id}`} className="text-label-sm font-bold text-primary flex items-center gap-1">
                    Chi tiết
                    <ChevronRight size={14} />
                  </Link>
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
            <Link href="/customer/booking" className="mt-4 inline-flex text-primary font-bold text-body-sm underline">
              Đặt dịch vụ ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
