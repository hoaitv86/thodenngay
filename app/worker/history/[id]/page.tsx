"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MapPinIcon,
  ClockIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  XIcon,
  StarIcon,
  CalendarIcon,
  DollarSignIcon,
  ChevronLeftIcon,
  PhoneIcon,
  ShieldCheckIcon
} from "../../../components/icons";

interface CompletionItem {
  name: string;
  quantity: number;
  unitPrice: number;
  warrantyDays: number;
}

interface WorkerJobDetail {
  id: string;
  job_code?: string | null;
  status?: string | null;
  address?: string | null;
  scheduled_at: string;
  updated_at?: string | null;
  description?: string | null;
  quoted_price?: number | null;
  images?: string[] | null;
  completion_items?: CompletionItem[] | null;
  final_amount?: number | null;
  warranty_days?: number | null;
  warranty_note?: string | null;
  service?: {
    name?: string | null;
    description?: string | null;
  } | null;
  customer?: {
    full_name?: string | null;
    phone?: string | null;
  } | Array<{
    full_name?: string | null;
    phone?: string | null;
  }> | null;
  ratings?: Array<{
    score: number;
    comment?: string | null;
    created_at: string;
    images?: string[] | null;
  }> | null;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

export default function WorkerJobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [job, setJob] = useState<WorkerJobDetail | null>(null);
  const [workerName, setWorkerName] = useState("Thợ thực hiện");
  const [workerPhone, setWorkerPhone] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .single();
        if (profile?.full_name) setWorkerName(profile.full_name);
        if (profile?.phone) setWorkerPhone(profile.phone);
      }

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
  }, [id, router, supabase]);

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
  const completedDate = new Date(job.updated_at || job.scheduled_at);
  const scheduledDate = new Date(job.scheduled_at);
  const completionItems: CompletionItem[] = Array.isArray(job.completion_items) && job.completion_items.length > 0
    ? job.completion_items
    : [{
        name: job.service?.name || 'Công dịch vụ',
        quantity: 1,
        unitPrice: Number(job.quoted_price || 0),
        warrantyDays: Number(job.warranty_days || 30),
      }];
  const finalAmount = Number(job.final_amount || completionItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0));
  const serviceName = job.service?.name || completionItems[0]?.name || "Công dịch vụ";
  const warrantyDays = Number(job.warranty_days || completionItems.reduce((max, item) => Math.max(max, Number(item.warrantyDays || 0)), 0));
  const warrantyUntil = new Date(completedDate);
  warrantyUntil.setDate(warrantyUntil.getDate() + warrantyDays);
  const completionImages = job.images || [];
  const firstRating = job.ratings?.[0];
  const ratingImages = firstRating?.images || [];

  return (
    <div className="flex flex-col w-full min-h-[calc(100dvh-8rem)] bg-surface animate-fade-in">
      <style>{`
        @media print {
          @page {
            margin: 14mm;
          }

          body {
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .invoice-print-area,
          .invoice-print-area * {
            visibility: visible !important;
          }

          .invoice-print-area {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 px-4 h-14 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-surface-container rounded-full transition-colors -ml-2">
          <ChevronLeftIcon size={20} />
        </button>
        <h1 className="text-body-lg font-bold text-on-surface">Chi tiết công việc</h1>
      </div>

      <div className="flex-1 p-4 space-y-6 pb-10">
        {/* Status Hero */}
        <div className={`relative flex flex-col items-center overflow-hidden rounded-xl border p-5 text-center shadow-sm sm:p-6 ${
          isCompleted
            ? 'border-success/20 bg-linear-to-br from-primary via-primary-container to-success text-white'
            : 'border-error/20 bg-linear-to-br from-primary via-primary-container to-error text-white'
        }`}>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25" />
          <div className={`relative flex h-16 w-16 items-center justify-center rounded-full ${
            isCompleted 
              ? 'bg-white text-success' 
              : 'bg-white text-error'
          }`}>
            {isCompleted ? <CheckCircleIcon size={32} /> : <XIcon size={32} />}
          </div>
          <div className="relative mt-3">
            <h2 className={`text-xl font-extrabold ${isCompleted ? "" : "text-white"}`} style={isCompleted ? { color: "#fcd34d" } : undefined}>
              {isCompleted ? 'Đã hoàn thành' : 'Đã hủy'}
            </h2>
            <p className="mt-1 break-all font-mono text-label-md font-medium text-white/75">{job.job_code}</p>
          </div>
          <div className="relative mt-3 rounded-lg bg-white px-4 py-2 text-2xl font-extrabold text-primary-container shadow-sm">
            {formatCurrency(finalAmount)}
          </div>
        </div>

        {/* Service Info */}
        <div className="space-y-3">
          <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Dịch vụ</h3>
          <div className="flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-white p-4 shadow-sm sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-white shadow-sm">
              <BriefcaseIcon size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-bold text-on-surface truncate">{serviceName}</p>
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
                <p className="text-body-md font-bold text-success mt-0.5">{formatCurrency(finalAmount)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice & Warranty */}
        {isCompleted && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Hóa đơn & bảo hành</h3>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print rounded-lg border border-primary-container/30 bg-primary-fixed px-3 py-2 text-xs font-bold text-primary-container"
              >
                In / Xuất hóa đơn
              </button>
            </div>

            <div className="invoice-print-area space-y-4 rounded-xl border border-outline-variant/20 bg-white p-4 shadow-sm">
              <div className="border-b border-outline-variant/30 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-on-surface-variant">Phiếu thu dịch vụ</p>
                    <p className="mt-1 text-xl font-extrabold text-on-surface">Hóa Đơn Công Việc</p>
                    <p className="mt-1 font-mono text-sm font-bold text-primary-container">{job.job_code || job.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-on-surface-variant">Ngày xuất</p>
                    <p className="text-sm font-bold text-on-surface">{completedDate.toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Khách hàng</p>
                  <p className="mt-1 font-bold text-on-surface">{customerName || "Khách vãng lai"}</p>
                  {customerPhone && <p className="mt-0.5 text-on-surface-variant">{customerPhone}</p>}
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Dịch vụ</p>
                  <p className="mt-1 font-bold text-on-surface">{serviceName}</p>
                </div>
                <div className="rounded-lg bg-surface-container-low p-3 sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Địa chỉ thi công</p>
                  <p className="mt-1 font-medium text-on-surface">{job.address || "Chưa cập nhật"}</p>
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Lịch hẹn</p>
                  <p className="mt-1 font-medium text-on-surface">
                    {scheduledDate.toLocaleDateString('vi-VN')} {scheduledDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Hoàn thành</p>
                  <p className="mt-1 font-medium text-on-surface">
                    {completedDate.toLocaleDateString('vi-VN')} {completedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead className="bg-surface-container-low text-[11px] uppercase text-on-surface-variant">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold">Hạng mục</th>
                      <th className="px-3 py-2 text-center font-bold">SL</th>
                      <th className="px-3 py-2 text-right font-bold">Đơn giá</th>
                      <th className="px-3 py-2 text-center font-bold">BH</th>
                      <th className="px-3 py-2 text-right font-bold">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completionItems.map((item, index) => {
                      const quantity = Number(item.quantity || 0);
                      const unitPrice = Number(item.unitPrice || 0);
                      return (
                        <tr key={`${item.name}-${index}`} className="border-t border-outline-variant/20">
                          <td className="px-3 py-3 font-semibold text-on-surface">{item.name || `Hạng mục ${index + 1}`}</td>
                          <td className="px-3 py-3 text-center font-semibold text-on-surface-variant">{quantity}</td>
                          <td className="px-3 py-3 text-right text-on-surface-variant">{formatCurrency(unitPrice)}</td>
                          <td className="px-3 py-3 text-center text-on-surface-variant">{Number(item.warrantyDays || 0)} ngày</td>
                          <td className="px-3 py-3 text-right font-bold text-on-surface">{formatCurrency(quantity * unitPrice)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 border-t border-outline-variant/30 pt-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-on-surface-variant">Báo giá ban đầu</span>
                  <span className="font-bold text-on-surface">{formatCurrency(Number(job.quoted_price || 0))}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-success-container px-4 py-3">
                  <span className="text-sm font-bold text-on-success-container">Tổng thanh toán</span>
                  <span className="text-xl font-extrabold text-success">{formatCurrency(finalAmount)}</span>
                </div>
              </div>

              <div className="rounded-xl border border-success/20 bg-success-container/35 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-container text-success">
                    <ShieldCheckIcon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-on-surface">Phiếu bảo hành</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Hiệu lực {warrantyDays} ngày, đến {warrantyUntil.toLocaleDateString('vi-VN')}.
                    </p>
                    {job.warranty_note && (
                      <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-on-surface-variant">
                        {job.warranty_note}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-outline-variant/30 pt-4">
                <div className="min-w-[12rem] text-center">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Thợ Thi Công</p>
                  <p className="mt-1 font-bold text-on-surface">{workerName}</p>
                  {workerPhone && <p className="mt-0.5 text-sm text-on-surface-variant">{workerPhone}</p>}
                </div>
              </div>

              <p className="text-center text-[11px] font-semibold text-on-surface-variant">
                Phiếu được tạo từ hệ thống Thợ đến ngay. Vui lòng đối chiếu mã đơn khi cần hỗ trợ.
              </p>
            </div>
          </div>
        )}

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
        {isCompleted && completionImages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Hình ảnh nghiệm thu</h3>
              <span className="text-[10px] px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant font-medium">
                {completionImages.length} ảnh
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {completionImages.map((imgUrl: string, idx: number) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low shadow-sm group">
                  <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img 
                      src={imgUrl} 
                      alt={`Ảnh nghiệm thu ${idx + 1}`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                    />
                  </a>
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
                    {idx + 1}/{completionImages.length}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer Rating */}
        {firstRating && (
          <div className="space-y-3">
            <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Đánh giá từ khách hàng</h3>
            <div className="card !p-5 space-y-3 border-amber-200/30 bg-amber-50/30">
              <div className="flex items-center gap-3 rounded-lg bg-white/70 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-sm font-bold text-white">
                  {(customerName || "K").charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-on-surface-variant">Khách hàng đánh giá</p>
                  <p className="truncate text-sm font-bold text-on-surface">{customerName || "Khách vãng lai"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon 
                      key={star} 
                      size={18} 
                      className={star <= firstRating.score ? "fill-amber-400 text-amber-400" : "text-outline-variant"} 
                    />
                  ))}
                </div>
                <span className="text-label-sm text-on-surface-variant font-medium">
                  {new Date(firstRating.created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
              {firstRating.comment ? (
                <p className="text-body-sm text-on-surface-variant italic leading-relaxed break-words">&ldquo;{firstRating.comment}&rdquo;</p>
              ) : (
                <p className="text-body-sm text-on-surface-variant/50 italic">Khách hàng không để lại bình luận.</p>
              )}
              {/* Rating images from customer */}
              {ratingImages.length > 0 && (
                <div className="pt-3 border-t border-amber-200/30">
                  <p className="text-label-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Ảnh đánh giá từ khách</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ratingImages.map((imgUrl: string, idx: number) => (
                      <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant/30 bg-surface-container-low group">
                        <img 
                          src={imgUrl} 
                          alt={`Ảnh đánh giá ${idx + 1}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                        />
                        <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">
                          {idx + 1}/{ratingImages.length}
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
