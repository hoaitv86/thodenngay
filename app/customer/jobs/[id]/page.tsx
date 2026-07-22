"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JobWorkflowSummary } from "@/app/components/JobWorkflowSummary";
import { getJobServices, isMissingWorkflowColumn, type JobWithWorkflow } from "@/lib/job-workflow";
import type { WorkflowData } from "@/config/serviceWorkflows";
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Briefcase, 
  User, 
  Phone, 
  ShieldCheck,
  Star,
  AlertCircle,
  Camera,
  X
} from "lucide-react";
import Link from "next/link";

type CustomerJobDetail = {
  id: string;
  job_code?: string | null;
  customer_id?: string | null;
  worker_id?: string | null;
  status?: string | null;
  quoted_price?: number | string | null;
  address?: string | null;
  scheduled_at?: string | null;
  description?: string | null;
  images?: string[] | null;
  workflow_data?: WorkflowData | null;
  service?: { id?: string | null; name?: string | null; description?: string | null } | null;
  job_services?: JobWithWorkflow["job_services"];
  worker?: {
    avg_rating?: number | string | null;
    total_jobs?: number | string | null;
    user?: { full_name?: string | null; phone?: string | null } | null;
  } | null;
  ratings?: Array<{
    score: number;
    comment?: string | null;
    images?: string[] | null;
    created_at?: string | null;
  }> | null;
};

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [job, setJob] = useState<CustomerJobDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Rating and review states
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

  // Rating image upload states
  const [ratingFiles, setRatingFiles] = useState<File[]>([]);
  const [ratingPreviews, setRatingPreviews] = useState<string[]>([]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3000);
  };

  useEffect(() => {
    const fetchJob = async () => {
      let result = await supabase
        .from('jobs')
        .select(`
          id,
          job_code,
          customer_id,
          worker_id,
          status,
          quoted_price,
          address,
          scheduled_at,
          description,
          images,
          workflow_data,
          service:services!jobs_service_id_fkey(id, name, description),
          job_services(service:services(id, name, description)),
          worker:workers(
            avg_rating,
            total_jobs,
            user:profiles(full_name, phone)
          ),
          ratings(score, comment, images, created_at)
        `)
        .eq('id', id)
        .single();

      if (result.error && isMissingWorkflowColumn(result.error.message)) {
        result = await supabase
          .from('jobs')
          .select(`
            id,
            job_code,
            customer_id,
            worker_id,
            status,
            quoted_price,
            address,
            scheduled_at,
            description,
            images,
            workflow_data,
            service:services!jobs_service_id_fkey(id, name, description),
            worker:workers(
              avg_rating,
              total_jobs,
              user:profiles(full_name, phone)
            ),
            ratings(score, comment, images, created_at)
          `)
          .eq('id', id)
          .single();
      }

      if (result.error) {
        console.error("Error fetching job:", result.error);
        router.push("/customer/jobs");
      } else {
        setJob(result.data as unknown as CustomerJobDetail);
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
      const { data } = await supabase
        .from('jobs')
        .select('id, job_code, customer_id, worker_id, status, quoted_price, address, scheduled_at, description, images, workflow_data, service:services!jobs_service_id_fkey(id, name, description)')
        .eq('id', id)
        .single();
      setJob(data as unknown as CustomerJobDetail);
    }
  };

  const handleRatingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setRatingFiles(prev => [...prev, ...files]);
    const urls = files.map(file => URL.createObjectURL(file));
    setRatingPreviews(prev => [...prev, ...urls]);
  };

  const removeRatingFile = (index: number) => {
    if (ratingPreviews[index]) URL.revokeObjectURL(ratingPreviews[index]);
    setRatingFiles(prev => prev.filter((_, i) => i !== index));
    setRatingPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !job.worker_id) return;

    setSubmittingRating(true);

    try {
      // 1. Upload rating images if any
      const imageUrls: string[] = [];
      for (let i = 0; i < ratingFiles.length; i++) {
        const file = ratingFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}.${fileExt}`;
        const filePath = `ratings/${job.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('rating-photos')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error('Không thể tải ảnh lên: ' + uploadError.message);
        }

        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('rating-photos')
            .getPublicUrl(filePath);
          imageUrls.push(publicUrl);
        }
      }

      // 2. Insert rating with images
      const { data: ratingData, error } = await supabase
        .from('ratings')
        .insert({
          job_id: job.id,
          customer_id: job.customer_id,
          worker_id: job.worker_id,
          score: ratingScore,
          comment: ratingComment,
          images: imageUrls
        })
        .select()
        .single();

      setSubmittingRating(false);

      if (error) {
        showToast('Lỗi khi gửi đánh giá: ' + error.message, 'error');
        console.error(error);
      } else {
        showToast('Cảm ơn bạn đã đánh giá dịch vụ!', 'success');
        setJob((prev) => prev ? ({
          ...prev,
          ratings: [ratingData]
        }) : prev);
        // Clean up previews
        ratingPreviews.forEach(url => URL.revokeObjectURL(url));
        setRatingFiles([]);
        setRatingPreviews([]);
      }
    } catch (err: unknown) {
      setSubmittingRating(false);
      showToast(err instanceof Error ? err.message : 'Đã xảy ra lỗi.', 'error');
      console.error(err);
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
  const existingRating = job.ratings?.[0] || null;

  return (
    <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col bg-surface">
      {/* Toast Notification */}
      {toast.type && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm px-4 py-3 rounded-lg shadow-lg border animate-fade-in flex items-start gap-3 ${
          toast.type === 'success' ? 'bg-success-container text-on-success-container border-success/30' : 'bg-error-container text-on-error-container border-error/30'
        }`}>
          <span className="text-body-sm font-bold leading-tight pt-0.5">{toast.message}</span>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-outline-variant/20 px-4 h-14 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-surface-container rounded-full transition-colors" aria-label="Quay lại">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-body-lg font-bold">Chi tiết công việc</h1>
      </header>

      <main className="flex-1 space-y-6 p-4 pb-10 lg:p-8">
        {/* Status Card */}
        <div className="app-hero-panel flex flex-col items-center text-center sm:p-6">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary-container shadow-lg shadow-black/10">
            <ShieldCheck size={32} />
          </div>
          <div className="relative mt-3">
            <h2 className="text-xl font-extrabold text-white">
              {job.status === 'pending' ? 'Đang tìm thợ...' : 
               job.status === 'in_progress' ? 'Thợ đang đến' : 
               (job.status === 'completed' || job.status === 'done') ? 'Đã hoàn thành' :
               job.status === 'cancel_requested' ? 'Chờ admin duyệt huỷ' : 'Đã hủy'}
            </h2>
            <p className="mt-1 text-label-md font-medium text-white/75">Mã đơn: {job.job_code}</p>
          </div>
        </div>

        {/* Service Info */}
        <div className="space-y-4">
          <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Thông tin dịch vụ</h3>
          <div className="flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-white p-4 shadow-sm sm:gap-4 sm:p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-white shadow-sm">
              <Briefcase size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-bold text-on-surface truncate">{job.service?.name}</p>
              <p className="text-label-sm text-on-surface-variant">{job.service?.description}</p>
            </div>
            <div className="shrink-0 rounded-lg bg-primary-fixed px-3 py-2 text-sm font-extrabold text-primary-container sm:text-body-md">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(job.quoted_price || 0))}
            </div>
          </div>
          {getJobServices(job).length > 1 && (
            <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
              <p className="text-xs font-bold uppercase text-on-surface-variant">Các dịch vụ đã chọn</p>
              <ul className="mt-2 space-y-2">
                {getJobServices(job).map(service => (
                  <li key={service.id} className="flex items-start gap-2 text-sm font-bold text-on-surface">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-container" />
                    {service.name || "Dịch vụ"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <JobWorkflowSummary data={job.workflow_data} />

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
                {job.scheduled_at ? new Date(job.scheduled_at).toLocaleString('vi-VN') : "Chưa hẹn"}
              </p>
            </div>
          </div>
        </div>

        {/* Worker Info (if assigned) */}
        {job.worker && (
          <div className="space-y-4 pt-4 border-t border-outline-variant/30">
            <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Thợ đảm nhận</h3>
            <div className="flex items-center gap-4 rounded-lg border border-outline-variant bg-white p-4 shadow-card">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-lg font-bold text-primary-container">
                {job.worker.user?.full_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-md font-bold text-on-surface truncate">{job.worker.user?.full_name}</p>
                <div className="flex items-center gap-1 text-warning">
                  <Star size={14} className="fill-current" />
                  <span className="text-label-sm font-bold">{job.worker.avg_rating}</span>
                  <span className="text-label-xs text-on-surface-variant font-normal">({job.worker.total_jobs} việc)</span>
                </div>
              </div>
              <a href={`tel:${job.worker.user?.phone}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-white shadow-md shadow-green-700/20">
                <Phone size={20} />
              </a>
            </div>
          </div>
        )}

        {/* Notes */}
        {job.description && (
          <div className="space-y-2">
            <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider opacity-60">Mô tả vấn đề</p>
            <div className="bg-surface-container-low p-4 rounded-lg text-body-sm text-on-surface-variant italic break-words">
              &ldquo;{job.description}&rdquo;
            </div>
          </div>
        )}

        {/* Customer Request Images */}
        {job.images && job.images.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-outline-variant/30">
            <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">
              Ảnh hiện trạng đã gửi cho thợ
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {job.images.map((imgUrl: string, idx: number) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low shadow-sm">
                  <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <Image src={imgUrl} alt={`Ảnh hiện trạng ${idx + 1}`} fill sizes="(max-width: 640px) 50vw, 180px" className="object-cover hover:scale-105 transition-transform duration-200" unoptimized />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rating / Review Section */}
        {(job.status === 'completed' || job.status === 'done') && job.worker && (
          <div className="pt-6 border-t border-outline-variant/30 space-y-4">
            <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Đánh giá dịch vụ</h3>
            
            {existingRating ? (
              // Already Rated
              <div className="bg-surface-container-low p-5 rounded-lg border border-outline-variant space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 text-warning">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        size={18} 
                        className={star <= existingRating.score ? "fill-warning text-warning" : "text-outline-variant"}
                      />
                    ))}
                  </div>
                  <span className="text-label-sm text-on-surface-variant">
                    {existingRating.created_at ? new Date(existingRating.created_at).toLocaleDateString('vi-VN') : "Chưa có ngày"}
                  </span>
                </div>
                {existingRating.comment ? (
                  <p className="text-body-sm text-on-surface-variant italic break-words">&ldquo;{existingRating.comment}&rdquo;</p>
                ) : (
                  <p className="text-body-sm text-on-surface-variant/60 italic">Không có bình luận.</p>
                )}
                {/* Rating images */}
                {existingRating.images && existingRating.images.length > 0 && (
                  <div className="pt-2 border-t border-outline-variant/20">
                    <p className="text-label-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Ảnh đánh giá</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {existingRating.images.map((imgUrl: string, idx: number) => (
                        <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant/30 bg-surface-container-low">
                          <Image src={imgUrl} alt={`Ảnh đánh giá ${idx + 1}`} fill sizes="(max-width: 640px) 33vw, 120px" className="object-cover hover:scale-105 transition-transform duration-200" unoptimized />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Not Rated Yet: Show Rating Form
              <form onSubmit={handleSubmitRating} className="space-y-4 rounded-lg border border-outline-variant bg-white p-5 shadow-card">
                <div className="text-center space-y-2">
                  <p className="text-body-sm text-on-surface-variant">Bạn thấy dịch vụ của thợ thế nào? Hãy đánh giá nhé!</p>
                  
                  {/* Star Selector */}
                  <div className="flex justify-center gap-2 py-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingScore(star)}
                        className="transition-transform active:scale-125 hover:scale-110"
                      >
                        <Star 
                          size={32} 
                          className={star <= ratingScore ? "fill-warning text-warning" : "text-outline-variant"} 
                        />
                      </button>
                    ))}
                  </div>
                  
                  {/* Star label */}
                  <p className={`text-sm font-bold transition-colors ${
                    ratingScore >= 4 ? 'text-success' : ratingScore >= 3 ? 'text-primary' : 'text-error'
                  }`}>
                    {ratingScore === 1 ? '😞 Rất tệ' : 
                     ratingScore === 2 ? '😕 Chưa hài lòng' : 
                     ratingScore === 3 ? '😐 Bình thường' : 
                     ratingScore === 4 ? '😊 Hài lòng' : '🤩 Tuyệt vời!'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-label-sm font-semibold text-on-surface">Nhận xét của bạn (tùy chọn)</label>
                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Chia sẻ trải nghiệm của bạn về thợ (thái độ, chất lượng)..."
                    className="input-field min-h-[80px] resize-none"
                  />
                </div>

                {/* Rating Image Upload */}
                <div className="space-y-2">
                  <label className="text-label-sm font-semibold text-on-surface">Ảnh chứng minh (tùy chọn)</label>
                  <p className="text-[11px] text-on-surface-variant">Thêm ảnh để đánh giá khách quan hơn về chất lượng công việc.</p>
                  
                  <label className="flex h-20 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary-container/40 bg-primary-fixed/40 transition-colors hover:bg-secondary-fixed">
                    <div className="flex items-center gap-2">
                      <Camera size={20} className="text-primary-container" />
                      <span className="text-xs font-bold text-primary-container">Thêm ảnh</span>
                      <span className="text-[10px] text-on-surface-variant">(PNG, JPG)</span>
                    </div>
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleRatingFileChange}
                      disabled={submittingRating}
                    />
                  </label>

                  {/* Previews */}
                  {ratingPreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2 sm:grid-cols-4">
                      {ratingPreviews.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant/30 group">
                          <Image src={url} alt="Preview" fill sizes="(max-width: 640px) 33vw, 120px" className="object-cover" unoptimized />
                          <button
                            type="button"
                            onClick={() => removeRatingFile(idx)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                            disabled={submittingRating}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingRating}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary-container px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-900/15 transition-all hover:bg-primary active:scale-[0.98] disabled:opacity-50"
                >
                  {submittingRating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {ratingFiles.length > 0 ? 'Đang tải ảnh...' : 'Đang gửi...'}
                    </span>
                  ) : "Gửi đánh giá ⭐"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="pt-6 space-y-3">
          {job.status === 'pending' && (
            <button 
              onClick={handleCancel}
              className="w-full rounded-lg border border-error/25 bg-error-container px-5 py-4 font-extrabold text-error transition-all hover:bg-error hover:text-white active:scale-[0.98]"
            >
              Hủy yêu cầu
            </button>
          )}
          <Link href="/dashboard" className="block w-full rounded-lg border border-outline-variant bg-white px-5 py-4 text-center font-extrabold text-on-surface-variant shadow-sm transition-all hover:border-primary/30 hover:text-primary">
            Quay lại trang chủ
          </Link>
        </div>
      </main>
    </div>
  );
}
