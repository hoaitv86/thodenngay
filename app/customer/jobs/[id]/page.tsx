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

  // Rating and review states
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3000);
  };

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
          ),
          ratings(*)
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

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !job.worker_id) return;

    setSubmittingRating(true);

    const { data: ratingData, error } = await supabase
      .from('ratings')
      .insert({
        job_id: job.id,
        customer_id: job.customer_id,
        worker_id: job.worker_id,
        score: ratingScore,
        comment: ratingComment
      })
      .select()
      .single();

    setSubmittingRating(false);

    if (error) {
      showToast("Lỗi khi gửi đánh giá: " + error.message, "error");
      console.error(error);
    } else {
      showToast("Cảm ơn bạn đã đánh giá dịch vụ!", "success");
      // Update job locally to include the new rating
      setJob((prev: any) => ({
        ...prev,
        ratings: [ratingData]
      }));
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
    <div className="min-h-screen bg-surface flex flex-col max-w-md mx-auto relative">
      {/* Toast Notification */}
      {toast.type && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm px-4 py-3 rounded-xl shadow-lg border animate-fade-in flex items-start gap-3 ${
          toast.type === 'success' ? 'bg-[#e8f5e9] text-[#2e7d32] border-[#2e7d32]/20' : 'bg-[#ffebee] text-[#c62828] border-[#c62828]/20'
        }`}>
          <span className="text-body-sm font-bold leading-tight pt-0.5">{toast.message}</span>
        </div>
      )}
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
               (job.status === 'completed' || job.status === 'done') ? 'Đã hoàn thành' : 'Đã hủy'}
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

        {/* Work Completion Images */}
        {(job.status === 'completed' || job.status === 'done') && job.images && job.images.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-outline-variant/30">
            <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Hình ảnh nghiệm thu</h3>
            <div className="grid grid-cols-2 gap-2">
              {job.images.map((imgUrl: string, idx: number) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low shadow-sm">
                  <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img src={imgUrl} alt={`Ảnh nghiệm thu ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
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
            
            {job.ratings && job.ratings.length > 0 ? (
              // Already Rated
              <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 text-warning">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        size={18} 
                        className={star <= job.ratings[0].score ? "fill-warning text-warning" : "text-outline-variant"} 
                      />
                    ))}
                  </div>
                  <span className="text-label-sm text-on-surface-variant">
                    {new Date(job.ratings[0].created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                {job.ratings[0].comment ? (
                  <p className="text-body-sm text-on-surface-variant italic">"{job.ratings[0].comment}"</p>
                ) : (
                  <p className="text-body-sm text-on-surface-variant/60 italic">Không có bình luận.</p>
                )}
              </div>
            ) : (
              // Not Rated Yet: Show Rating Form
              <form onSubmit={handleSubmitRating} className="bg-white p-5 rounded-2xl border border-outline-variant/30 space-y-4 shadow-sm">
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
                    ratingScore >= 4 ? 'text-success' : ratingScore >= 3 ? 'text-amber-600' : 'text-error'
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
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-body-sm min-h-[80px] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingRating}
                  className="w-full btn-primary !py-3 rounded-xl! text-sm font-bold flex items-center justify-center gap-2"
                >
                  {submittingRating ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
              className="w-full btn-outline !text-error border-error/20 hover:bg-error-container !py-4"
            >
              Hủy yêu cầu
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
