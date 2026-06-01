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
import PendingApproval from "./pending-approval";

export default function WorkerDashboard() {
  const [tab, setTab] = useState<"new" | "active">("new");
  const [loading, setLoading] = useState(true);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [newJobs, setNewJobs] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [workerStats, setWorkerStats] = useState({ jobsDone: 0, income: 0, rating: 0 });
  const [completingJobId, setCompletingJobId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' | null }>({ message: '', type: null });
  const supabase = createClient();

  // Completion modal states
  const [activeJobToComplete, setActiveJobToComplete] = useState<any | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3000);
  };

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
        console.log('pendingJobs', pendingJobs);
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
          .select('*, service:services(*), customer:profiles!customer_id(*)')
          .eq('worker_id', workerData.id)
          .in('status', ['assigned', 'in_progress']);
        console.log('assignedJobs', assignedJobs);
        const mappedActive = (assignedJobs || []).map(j => {
          const custName = Array.isArray(j.customer) ? j.customer[0]?.full_name : j.customer?.full_name;
          return {
            ...j,
            customerName: custName || 'Khách vãng lai',
            serviceName: j.service?.name,
            time: new Date(j.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          };
        });
        setActiveJobs(mappedActive);

        // 5. Calculate Real Stats
        const { data: workerJobs } = await supabase
          .from('jobs')
          .select('status, quoted_price')
          .eq('worker_id', workerData.id);
        console.log('workerJobs', workerJobs);
        let income = 0;
        let jobsDone = 0;

        if (workerJobs) {
          workerJobs.forEach(j => {
            if (j.status === 'completed' || j.status === 'done') {
              jobsDone++;
              income += (j.quoted_price || 0);
            }
          });
        }

        setWorkerStats({
          jobsDone: jobsDone || workerData.total_jobs || 0,
          income: income,
          rating: workerData.avg_rating || 0
        });
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleAcceptJob = async (jobId: string) => {
    if (!worker) return;
    const { error } = await supabase
      .from('jobs')
      .update({ worker_id: worker.id, status: 'assigned' })
      .eq('id', jobId);

    if (error) {
      showToast('Lỗi khi nhận việc: ' + error.message, 'error');
      console.error(error);
    } else {
      const acceptedJob = newJobs.find(j => j.id === jobId);
      showToast('Nhận việc thành công!', 'success');
      
      // Move from newJobs to activeJobs
      setNewJobs(prev => prev.filter(j => j.id !== jobId));
      
      if (acceptedJob) {
        let customerName = 'Khách hàng';
        let customerProfileObj = null;
        if (acceptedJob.customer_id) {
          const { data: custProfile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', acceptedJob.customer_id)
            .single();
          if (custProfile) {
            customerName = custProfile.full_name;
            customerProfileObj = custProfile;
          }
        }
        setActiveJobs(prev => [{
          ...acceptedJob,
          status: 'assigned',
          customerName,
          customer: customerProfileObj
        }, ...prev]);
      }
      setTab('active');
    }
  };

  const handleDeclineJob = (jobId: string) => {
    // Just hide from feed (don't change job status)
    setNewJobs(prev => prev.filter(j => j.id !== jobId));
    showToast('Đã bỏ qua công việc này.', 'info');
  };

  const triggerCompleteJob = (job: any) => {
    setActiveJobToComplete(job);
    setSelectedFiles([]);
    setPreviewUrls([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    // Add to selected files
    setSelectedFiles(prev => [...prev, ...files]);
    
    // Create preview URLs
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...urls]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    // Revoke URL to avoid memory leak
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index]);
    }
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirmCompleteJob = async () => {
    if (!activeJobToComplete) return;

    setUploadingImages(true);
    const job = activeJobToComplete;
    const imageUrls: string[] = [];

    try {
      // 1. Upload images to Supabase Storage if any are selected
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}.${fileExt}`;
        const filePath = `jobs/${job.id}/${fileName}`;

        const { data, error: uploadError } = await supabase.storage
          .from('job-photos')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error("Không thể tải hình ảnh lên: " + uploadError.message);
        }

        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from('job-photos')
            .getPublicUrl(filePath);
          imageUrls.push(publicUrl);
        }
      }

      // 2. Update job status to completed & save images
      const { data: updatedJobs, error: updateError } = await supabase
        .from('jobs')
        .update({ 
          status: 'completed',
          images: imageUrls
        })
        .eq('id', job.id)
        .select();

      if (updateError) {
        throw new Error("Không thể cập nhật trạng thái: " + updateError.message);
      }

      if (!updatedJobs || updatedJobs.length === 0) {
        throw new Error("Cập nhật thất bại. Vui lòng kiểm tra chính sách bảo mật RLS hoặc cấu trúc bảng của dữ liệu.");
      }

      // 3. Optimistic UI update
      setActiveJobs(prev => prev.filter(j => j.id !== job.id));
      const finalPrice = job.quoted_price || 0;
      setWorkerStats(prev => ({
        ...prev,
        jobsDone: prev.jobsDone + 1,
        income: prev.income + finalPrice
      }));

      showToast("Đã hoàn thành công việc thành công!", "success");
      setActiveJobToComplete(null);
      setSelectedFiles([]);
      setPreviewUrls([]);
    } catch (err: any) {
      showToast(err.message || "Đã xảy ra lỗi khi hoàn thành công việc.", "error");
      console.error(err);
    } finally {
      setUploadingImages(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check worker status — show pending/blocked screen
  if (worker && (worker.status === 'pending' || worker.status === 'blocked')) {
    return <PendingApproval worker={worker} workerName={(worker as any).user?.full_name || 'Thợ'} />;
  }

  return (
    <div className="flex flex-col w-full relative">
      {/* Toast Notification */}
      {toast.type && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm px-4 py-3 rounded-xl shadow-lg border animate-fade-in flex items-start gap-3 ${toast.type === 'success' ? 'bg-success-container text-on-success-container border-success/30' :
          toast.type === 'error' ? 'bg-error-container text-on-error-container border-error/30' :
            'bg-surface-container-high text-on-surface border-outline-variant'
          }`}>
          <div className="mt-0.5 shrink-0">
            {toast.type === 'success' ? <CheckCircleIcon size={20} /> :
              toast.type === 'error' ? <XIcon size={20} /> :
                <BellIcon size={20} />}
          </div>
          <span className="text-body-sm font-bold leading-tight pt-0.5">{toast.message}</span>
        </div>
      )}

      {/* Stats Bar */}
      <div className="p-4">
        <div className="card-elevated !p-5 bg-gradient-to-br from-[#003178] to-[#0d47a1] text-white flex justify-around rounded-2xl shadow-xl shadow-blue-900/10">
          <div className="text-center">
            <div className="text-3xl font-extrabold">{workerStats.jobsDone}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mt-1">Jobs tháng</div>
          </div>
          <div className="h-12 w-px bg-white/20 self-center" />
          <div className="text-center">
            <div className="text-3xl font-extrabold">{workerStats.rating}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mt-1 flex items-center justify-center gap-1">
              Rating <StarIcon size={10} className="fill-current text-amber-400" />
            </div>
          </div>
          <div className="h-12 w-px bg-white/20 self-center" />
          <div className="text-center">
            <div className="text-xl font-extrabold text-amber-400 leading-9">
              {workerStats.income >= 1000000
                ? (workerStats.income / 1000000).toFixed(1) + 'tr'
                : (workerStats.income / 1000).toFixed(0) + 'k'}
            </div>
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
                  <button 
                    onClick={() => handleDeclineJob(job.id)}
                    className="flex-1 btn-outline py-2.5 rounded-xl! text-error border-error/20 hover:bg-error-container"
                  >
                    Từ chối
                  </button>
                  <button 
                    onClick={() => handleAcceptJob(job.id)}
                    className="flex-2 btn-primary py-2.5! rounded-xl!"
                  >
                    Nhận việc
                  </button>
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
            <div key={job.id} className="card-elevated border-l-4 border-primary-container p-5! space-y-4">
              <div className="flex items-center justify-between">
                <span className={`badge ${job.status === 'assigned' ? 'badge-assigned' : 'badge-in-progress'} uppercase text-[10px]`}>
                  {job.status === 'assigned' ? 'Mới nhận' : 'Đang thực hiện'}
                </span>
                <button className="text-primary-container font-bold text-body-sm">Chi tiết</button>
              </div>

              <div>
                <h3 className="text-body-md font-bold text-on-surface">{job.customerName}</h3>
                <p className="text-body-sm text-on-surface-variant mb-2">{job.serviceName}</p>
                <div className="flex items-start gap-2 text-label-sm text-on-surface-variant bg-surface-container-lowest p-2 rounded-lg ">
                  <MapPinIcon size={14} className="shrink-0 mt-0.5 text-primary-container" />
                  <span className="line-clamp-2">{job.address || "Chưa cung cấp địa chỉ"}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 py-3 border-y border-outline-variant/50">
                <a
                  href={job.customer?.phone ? `tel:${job.customer.phone}` : "#"}
                  onClick={(e) => {
                    if (!job.customer?.phone) {
                      e.preventDefault();
                      showToast("Khách hàng chưa cập nhật số điện thoại!", "error");
                    }
                  }}
                  className="flex-1 flex flex-col items-center gap-1 p-2 hover:bg-surface-container rounded-xl transition-colors text-center text-decoration-none select-none"
                >
                  <PhoneIcon size={20} className="text-success" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Gọi khách</span>
                </a>
                <div className="w-px h-8 bg-outline-variant/50" />
                <button className="flex-1 flex flex-col items-center gap-1 p-2 hover:bg-surface-container rounded-xl transition-colors">
                  <MapPinIcon size={20} className="text-primary-container" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Chỉ đường</span>
                </button>
              </div>

              <button
                onClick={() => triggerCompleteJob(job)}
                className="w-full btn-primary !bg-success !border-success !py-3.5 !rounded-xl"
              >
                Hoàn thành Job
              </button>
            </div>
          ))
        )}
      </div>

      {/* Complete Job Modal */}
      {activeJobToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-fade-in-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/50">
              <h2 className="text-lg font-bold text-on-surface">Hoàn thành công việc</h2>
              <button 
                onClick={() => {
                  if (!uploadingImages) {
                    setActiveJobToComplete(null);
                    setSelectedFiles([]);
                    setPreviewUrls([]);
                  }
                }}
                className="p-1.5 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
                disabled={uploadingImages}
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="bg-surface-container-low p-4 rounded-xl space-y-2">
                <p className="text-body-sm font-bold text-on-surface">Khách hàng: {activeJobToComplete.customerName}</p>
                <p className="text-body-sm text-on-surface-variant">Dịch vụ: {activeJobToComplete.serviceName}</p>
                <p className="text-body-sm text-on-surface-variant">Mã đơn: {activeJobToComplete.job_code}</p>
                <p className="text-body-sm text-primary font-bold">
                  Thanh toán: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(activeJobToComplete.quoted_price)}
                </p>
              </div>

              {/* Upload Section */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface block">Hình ảnh thực tế sau khi làm</label>
                <p className="text-xs text-on-surface-variant">Hãy chụp và tải ảnh kết quả công việc để khách hàng nghiệm thu.</p>
                
                {/* File picker */}
                <div className="mt-2">
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-outline-variant/60 rounded-xl cursor-pointer hover:bg-surface-container-low transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <CameraIcon size={28} className="text-on-surface-variant/80 mb-2" />
                      <p className="text-xs font-bold text-primary">Tải ảnh lên (Nhiều ảnh)</p>
                      <p className="text-[10px] text-on-surface-variant mt-1">PNG, JPG, JPEG</p>
                    </div>
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                      disabled={uploadingImages}
                    />
                  </label>
                </div>

                {/* Previews */}
                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant group">
                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(idx)}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                          disabled={uploadingImages}
                        >
                          <XIcon size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-outline-variant/50 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
              <button 
                type="button"
                onClick={() => {
                  setActiveJobToComplete(null);
                  setSelectedFiles([]);
                  setPreviewUrls([]);
                }}
                className="btn-outline !py-2 !px-4 text-sm"
                disabled={uploadingImages}
              >
                Hủy bỏ
              </button>
              <button 
                type="button" 
                onClick={handleConfirmCompleteJob}
                className="btn-primary !py-2 !px-5 text-sm !bg-success !border-success min-w-[140px]"
                disabled={uploadingImages}
              >
                {uploadingImages ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang lưu...
                  </span>
                ) : "Hoàn thành Job"}
              </button>
            </div>
          </div>
        </div>
      )}
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
