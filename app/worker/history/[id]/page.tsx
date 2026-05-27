"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MapPinIcon,
  ClockIcon,
  BriefcaseIcon,
  UserIcon,
  CheckCircleIcon,
  XIcon,
  StarIcon,
  CameraIcon,
  CalendarIcon,
  DollarSignIcon,
  ChevronLeftIcon,
  PhoneIcon
} from "../../../components/icons";

export default function WorkerJobDetailPage() {
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
          customer:profiles!customer_id(*),
          ratings(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error("Error fetching job:", error);
        router.push("/worker/history");
      } else {
        setJob(data);
      }
      setLoading(false);
    };

    if (id) fetchJob();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) return null;

  const isCompleted = job.status === 'completed' || job.status === 'done';
  const customerName = Array.isArray(job.customer) ? job.customer[0]?.full_name : job.customer?.full_name;
  const customerPhone = Array.isArray(job.customer) ? job.customer[0]?.phone : job.customer?.phone;
  const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.quoted_price || 0);
  const completedDate = new Date(job.updated_at || job.scheduled_at);
  const scheduledDate = new Date(job.scheduled_at);

  return (
    <div className="flex flex-col w-full min-h-[calc(100dvh-8rem)] bg-surface animate-fade-in">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 px-4 h-14 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-surface-container rounded-full transition-colors -ml-2">
          <ChevronLeftIcon size={20} />
        </button>
        <h1 className="text-body-lg font-bold text-on-surface">Chi tiết công việc</h1>
      </div>

      <div className="flex-1 p-4 space-y-6 pb-10">
        {/* Status Hero */}
        <div className={`relative flex flex-col items-center overflow-hidden rounded-2xl border p-5 text-center shadow-xl sm:p-6 ${
          isCompleted
            ? 'border-success/20 bg-gradient-to-br from-[#003178] via-[#0d47a1] to-[#16a34a] text-white shadow-green-900/10'
            : 'border-error/20 bg-gradient-to-br from-[#003178] via-[#0d47a1] to-[#ba1a1a] text-white shadow-red-900/10'
        }`}>
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25" />
          <div className={`relative flex h-16 w-16 items-center justify-center rounded-full ${
            isCompleted 
              ? 'bg-white text-success' 
              : 'bg-white text-error'
          }`}>
            {isCompleted ? <CheckCircleIcon size={32} /> : <XIcon size={32} />}
          </div>
          <div className="relative mt-3">
            <h2 className="text-xl font-extrabold text-white">
              {isCompleted ? 'Đã hoàn thành' : 'Đã hủy'}
            </h2>
            <p className="mt-1 break-all font-mono text-label-md font-medium text-white/75">{job.job_code}</p>
          </div>
          <div className="relative mt-3 rounded-xl bg-white px-4 py-2 text-2xl font-extrabold text-primary-container shadow-lg shadow-black/10">
            {formattedPrice}
          </div>
        </div>

        {/* Service Info */}
        <div className="space-y-3">
          <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Dịch vụ</h3>
          <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-lg shadow-blue-900/5 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-white shadow-md shadow-primary/20">
              <BriefcaseIcon size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-bold text-on-surface truncate">{job.service?.name || 'Dịch vụ'}</p>
              {job.service?.description && (
                <p className="text-label-sm text-on-surface-variant line-clamp-1">{job.service.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="space-y-3">
          <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Khách hàng</h3>
          <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-lg shadow-blue-900/5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-lg font-bold text-white">
              {(customerName || 'K').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-bold text-on-surface truncate">{customerName || 'Khách vãng lai'}</p>
              {customerPhone && (
                <p className="text-label-sm text-on-surface-variant">{customerPhone}</p>
              )}
            </div>
            {customerPhone && (
              <a 
                href={`tel:${customerPhone}`} 
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-white shadow-md shadow-green-700/20 transition-all hover:brightness-110"
              >
                <PhoneIcon size={20} />
              </a>
            )}
          </div>
        </div>

        {/* Location & Time */}
        <div className="space-y-4">
          <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Thông tin chi tiết</h3>
          
          <div className="space-y-4 rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-lg shadow-blue-900/5">
            {/* Address */}
            {job.address && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <MapPinIcon size={18} />
                </div>
              <div className="min-w-0">
                <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Địa chỉ thi công</p>
                  <p className="text-body-sm font-medium text-on-surface mt-0.5 break-words">{job.address}</p>
                </div>
              </div>
            )}

            {/* Scheduled Time */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                <CalendarIcon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Lịch hẹn</p>
                <p className="text-body-sm font-medium text-on-surface mt-0.5 break-words">
                  {scheduledDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {' — '}
                  {scheduledDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Completed Time */}
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                isCompleted ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}>
                <ClockIcon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
                  {isCompleted ? 'Thời gian hoàn thành' : 'Thời gian hủy'}
                </p>
                <p className="text-body-sm font-medium text-on-surface mt-0.5 break-words">
                  {completedDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {' — '}
                  {completedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Earnings */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                <DollarSignIcon size={18} />
              </div>
              <div>
                <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Thu nhập</p>
                <p className="text-body-md font-bold text-success mt-0.5">{formattedPrice}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Description / Notes */}
        {job.description && (
          <div className="space-y-3">
            <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Mô tả công việc</h3>
            <div className="bg-surface-container-low p-4 rounded-xl text-body-sm text-on-surface-variant italic leading-relaxed break-words">
              &ldquo;{job.description}&rdquo;
            </div>
          </div>
        )}

        {/* Completion Images */}
        {isCompleted && job.images && job.images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Hình ảnh nghiệm thu</h3>
              <span className="text-[10px] px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant font-medium">
                {job.images.length} ảnh
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {job.images.map((imgUrl: string, idx: number) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low shadow-sm group">
                  <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img 
                      src={imgUrl} 
                      alt={`Ảnh nghiệm thu ${idx + 1}`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                    />
                  </a>
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
                    {idx + 1}/{job.images.length}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer Rating */}
        {job.ratings && job.ratings.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Đánh giá từ khách hàng</h3>
            <div className="card !p-5 space-y-3 border-amber-200/30 bg-amber-50/30">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon 
                      key={star} 
                      size={18} 
                      className={star <= job.ratings[0].score ? "fill-amber-400 text-amber-400" : "text-outline-variant"} 
                    />
                  ))}
                </div>
                <span className="text-label-sm text-on-surface-variant font-medium">
                  {new Date(job.ratings[0].created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
              {job.ratings[0].comment ? (
                <p className="text-body-sm text-on-surface-variant italic leading-relaxed break-words">&ldquo;{job.ratings[0].comment}&rdquo;</p>
              ) : (
                <p className="text-body-sm text-on-surface-variant/50 italic">Khách hàng không để lại bình luận.</p>
              )}
              {/* Rating images from customer */}
              {job.ratings[0].images && job.ratings[0].images.length > 0 && (
                <div className="pt-3 border-t border-amber-200/30">
                  <p className="text-label-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Ảnh đánh giá từ khách</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {job.ratings[0].images.map((imgUrl: string, idx: number) => (
                      <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant/30 bg-surface-container-low group">
                        <img 
                          src={imgUrl} 
                          alt={`Ảnh đánh giá ${idx + 1}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                        />
                        <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">
                          {idx + 1}/{job.ratings[0].images.length}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Back button */}
        <div className="pt-4">
          <button 
            onClick={() => router.push('/worker/history')} 
            className="w-full btn-outline !py-3.5 text-sm font-bold"
          >
            ← Quay lại Lịch sử
          </button>
        </div>
      </div>
    </div>
  );
}
