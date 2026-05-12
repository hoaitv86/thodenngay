"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Briefcase, 
  User, 
  Phone, 
  ShieldCheck,
  Star,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          service:services(*),
          worker:workers(
            *,
            user:profiles(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error("Error fetching job:", error);
        router.push("/customer/jobs");
      } else {
        setJob(data);
      }
      setLoading(false);
    };

    if (id) fetchJob();
  }, [id, supabase, router]);

  const handleCancel = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy đơn này không?")) return;

    const { error } = await supabase
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      alert("Không thể hủy đơn. Vui lòng thử lại.");
    } else {
      router.refresh();
      // Refetch job locally
      const { data } = await supabase.from('jobs').select('*, service:services(*)').eq('id', id).single();
      setJob(data);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-surface flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-outline-variant/20 px-4 h-14 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-surface-container rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-body-lg font-bold">Chi tiết công việc</h1>
      </header>

      <main className="flex-1 p-4 space-y-6 pb-10">
        {/* Status Card */}
        <div className="card-elevated !p-6 flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center text-primary-container">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h2 className="text-headline-sm text-on-surface">
              {job.status === 'pending' ? 'Đang tìm thợ...' : 
               job.status === 'in_progress' ? 'Thợ đang đến' : 
               job.status === 'completed' ? 'Đã hoàn thành' : 'Đã hủy'}
            </h2>
            <p className="text-label-md text-on-surface-variant font-medium mt-1">Mã đơn: {job.job_code}</p>
          </div>
        </div>

        {/* Service Info */}
        <div className="space-y-4">
          <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Thông tin dịch vụ</h3>
          <div className="card !p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shrink-0">
              <Briefcase size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-bold text-on-surface truncate">{job.service?.name}</p>
              <p className="text-label-sm text-on-surface-variant">{job.service?.description}</p>
            </div>
            <div className="text-body-md font-bold text-primary-container">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.quoted_price)}
            </div>
          </div>
        </div>

        {/* Location & Time */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 text-on-surface-variant">
            <MapPin size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-label-sm font-bold uppercase tracking-wider opacity-60">Địa chỉ</p>
              <p className="text-body-md font-medium text-on-surface">{job.address}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-on-surface-variant">
            <Clock size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-label-sm font-bold uppercase tracking-wider opacity-60">Thời gian</p>
              <p className="text-body-md font-medium text-on-surface">
                {new Date(job.scheduled_at).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
        </div>

        {/* Worker Info (if assigned) */}
        {job.worker && (
          <div className="space-y-4 pt-4 border-t border-outline-variant/30">
            <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Thợ đảm nhận</h3>
            <div className="card !p-4 flex items-center gap-4 border-primary-container/20 bg-primary-fixed/5">
              <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center text-primary-container font-bold text-lg">
                {job.worker.user?.full_name?.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-body-md font-bold text-on-surface">{job.worker.user?.full_name}</p>
                <div className="flex items-center gap-1 text-warning">
                  <Star size={14} className="fill-current" />
                  <span className="text-label-sm font-bold">{job.worker.avg_rating}</span>
                  <span className="text-label-xs text-on-surface-variant font-normal">({job.worker.total_jobs} việc)</span>
                </div>
              </div>
              <a href={`tel:${job.worker.user?.phone}`} className="w-10 h-10 rounded-full bg-success-container flex items-center justify-center text-success">
                <Phone size={20} />
              </a>
            </div>
          </div>
        )}

        {/* Notes */}
        {job.description && (
          <div className="space-y-2">
            <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider opacity-60">Mô tả vấn đề</p>
            <div className="bg-surface-container-low p-4 rounded-xl text-body-sm text-on-surface-variant italic">
              "{job.description}"
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-6 space-y-3">
          {job.status === 'pending' && (
            <button 
              onClick={handleCancel}
              className="w-full btn-outline !text-error border-error/20 hover:bg-error-container !py-4"
            >
              Hủy yêu cầu
            </button>
          )}
          {job.status === 'completed' && (
            <button className="w-full btn-primary !py-4">
              Đánh giá dịch vụ
            </button>
          )}
          <Link href="/dashboard" className="block w-full btn-outline !py-4 text-center">
            Quay lại trang chủ
          </Link>
        </div>
      </main>
    </div>
  );
}
