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
  const [services, setServices] = useState<any[]>([]);
  const [workerStats, setWorkerStats] = useState({ jobsDone: 0, income: 0, rating: 0 });
  const [completingJobId, setCompletingJobId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' | null }>({ message: '', type: null });
  const [quickFormOpen, setQuickFormOpen] = useState(false);
  const [creatingQuickJob, setCreatingQuickJob] = useState(false);
  const [quickJob, setQuickJob] = useState({
    customerPhone: "",
    serviceId: "",
    address: "",
    quotedPrice: "",
    description: "",
  });
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

        const { data: servicesData } = await supabase
          .from('services')
          .select('id, name, base_price, icon')
          .eq('is_active', true)
          .order('name');
        if (servicesData) {
          setServices(servicesData);
          setQuickJob(prev => {
            if (prev.serviceId || servicesData.length === 0) return prev;
            const firstService = servicesData[0];
            return {
              ...prev,
              serviceId: firstService.id,
              quotedPrice: firstService.base_price ? String(firstService.base_price) : "",
            };
          });
        }

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
        setActiveJobs(prev => [{ ...acceptedJob, status: 'assigned', customerName: 'Khách hàng' }, ...prev]);
      }
      setTab('active');
    }
  };

  const handleDeclineJob = (jobId: string) => {
    // Just hide from feed (don't change job status)
    setNewJobs(prev => prev.filter(j => j.id !== jobId));
    showToast('Đã bỏ qua công việc này.', 'info');
  };

  const handleQuickServiceChange = (serviceId: string) => {
    const selectedService = services.find(service => service.id === serviceId);
    setQuickJob(prev => ({
      ...prev,
      serviceId,
      quotedPrice: selectedService?.base_price ? String(selectedService.base_price) : prev.quotedPrice,
    }));
  };

  const handleCreateQuickJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker || creatingQuickJob) return;

    if (!quickJob.customerPhone.trim() || !quickJob.serviceId || !quickJob.address.trim()) {
      showToast("Vui lòng nhập SĐT khách, dịch vụ và địa chỉ.", "error");
      return;
    }

    const quotedPrice = quickJob.quotedPrice ? Number(quickJob.quotedPrice) : null;
    if (quotedPrice !== null && (!Number.isFinite(quotedPrice) || quotedPrice < 0)) {
      showToast("Giá dịch vụ không hợp lệ.", "error");
      return;
    }

    setCreatingQuickJob(true);
    try {
      const { data, error } = await supabase.rpc('worker_create_quick_job', {
        p_customer_phone: quickJob.customerPhone,
        p_service_id: quickJob.serviceId,
        p_address: quickJob.address,
        p_description: quickJob.description || null,
        p_quoted_price: quotedPrice,
      });

      if (error) throw error;

      const createdJob = data as any;
      setActiveJobs(prev => [
        {
          ...createdJob,
          serviceName: createdJob.serviceName,
          customerName: createdJob.customerName || 'Khách hàng',
          time: new Date(createdJob.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ]);
      setQuickJob(prev => ({
        customerPhone: "",
        serviceId: prev.serviceId,
        address: "",
        quotedPrice: prev.quotedPrice,
        description: "",
      }));
      setQuickFormOpen(false);
      setTab("active");
      showToast(`Đã tạo và nhận việc ${createdJob.job_code}.`, "success");
    } catch (err: any) {
      showToast(err.message || "Không thể tạo việc nhanh.", "error");
    } finally {
      setCreatingQuickJob(false);
    }
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
        <div className="card-elevated !p-4 bg-gradient-to-br from-[#003178] to-[#0d47a1] text-white grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center rounded-2xl shadow-xl shadow-blue-900/10 sm:!p-5">
          <div className="min-w-0 text-center">
            <div className="text-2xl font-extrabold sm:text-3xl">{workerStats.jobsDone}</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-wide opacity-70 sm:text-[10px]">Jobs tháng</div>
          </div>
          <div className="h-12 w-px bg-white/20 self-center" />
          <div className="min-w-0 text-center">
            <div className="text-2xl font-extrabold sm:text-3xl">{workerStats.rating}</div>
            <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wide opacity-70 sm:text-[10px]">
              Rating <StarIcon size={10} className="fill-current text-amber-400" />
            </div>
          </div>
          <div className="h-12 w-px bg-white/20 self-center" />
          <div className="min-w-0 text-center">
            <div className="text-lg font-extrabold text-amber-400 leading-8 sm:text-xl">
              {workerStats.income >= 1000000
                ? (workerStats.income / 1000000).toFixed(1) + 'tr'
                : (workerStats.income / 1000).toFixed(0) + 'k'}
            </div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-wide opacity-70 sm:text-[10px]">Thu nhập</div>
          </div>
        </div>
      </div>

      {/* Quick Job Creation */}
      <div className="px-4 pb-4">
        <div className="rounded-2xl border border-primary-fixed bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setQuickFormOpen(open => !open)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary-container shrink-0">
                <BriefcaseIcon size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-body-sm font-bold text-on-surface">Tạo việc nhanh cho khách quen</h2>
                <p className="text-xs leading-5 text-on-surface-variant">
                  Khách chưa đặt đơn, thợ tạo job tại chỗ và nhận luôn.
                </p>
              </div>
            </div>
            <ChevronRightIcon
              size={18}
              className={`shrink-0 text-primary-container transition-transform ${quickFormOpen ? "rotate-90" : ""}`}
            />
          </button>

          {quickFormOpen && (
            <form onSubmit={handleCreateQuickJob} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  SĐT khách quen
                </label>
                <input
                  type="tel"
                  value={quickJob.customerPhone}
                  onChange={(e) => setQuickJob(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="VD: 0912345678"
                  className="input-field !py-2.5"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Dịch vụ
                  </label>
                  <select
                    value={quickJob.serviceId}
                    onChange={(e) => handleQuickServiceChange(e.target.value)}
                    className="input-field !py-2.5"
                  >
                    <option value="">Chọn dịch vụ</option>
                    {services.map(service => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Giá thỏa thuận
                  </label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={quickJob.quotedPrice}
                    onChange={(e) => setQuickJob(prev => ({ ...prev, quotedPrice: e.target.value }))}
                    placeholder="VD: 200000"
                    className="input-field !py-2.5"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Địa chỉ làm việc
                </label>
                <input
                  value={quickJob.address}
                  onChange={(e) => setQuickJob(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Nhập địa chỉ thực tế"
                  className="input-field !py-2.5"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Mô tả việc cần làm
                </label>
                <textarea
                  value={quickJob.description}
                  onChange={(e) => setQuickJob(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ghi chú nhanh tình trạng, yêu cầu, vật tư..."
                  className="input-field min-h-20 resize-none !py-2.5"
                />
              </div>

              <button
                type="submit"
                disabled={creatingQuickJob}
                className="btn-primary w-full !py-3 text-sm"
              >
                {creatingQuickJob ? "Đang tạo..." : "Tạo và nhận việc"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 flex gap-8 border-b border-outline-variant overflow-x-auto">
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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary-container">
                      <job.icon size={20} />
                    </div>
                    <div>
                      <div className="text-body-sm font-bold text-on-surface">{job.serviceName}</div>
                      <div className="text-label-sm text-on-surface-variant">{job.job_code}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-lg font-bold text-primary-container">{job.price}</div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-on-surface-variant">
                    <MapPinIcon size={14} className="mt-1 shrink-0" />
                    <span className="min-w-0 flex-1 text-body-sm leading-6">{job.address}</span>
                    <span className="text-label-sm px-1.5 py-0.5 bg-surface-container rounded-md">~{job.distance}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <ClockIcon size={14} />
                    <span className="text-body-sm">Hẹn lúc: {job.time}</span>
                  </div>
                </div>

                {job.images && job.images.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-label-sm font-bold text-on-surface-variant uppercase tracking-wide">
                      <CameraIcon size={14} />
                      Ảnh khách gửi trước
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {job.images.slice(0, 3).map((imgUrl: string, idx: number) => (
                        <a
                          key={imgUrl}
                          href={imgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-low"
                        >
                          <img src={imgUrl} alt={`Ảnh hiện trạng ${idx + 1}`} className="h-full w-full object-cover" />
                          {idx === 2 && job.images.length > 3 && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-bold text-white">
                              +{job.images.length - 3}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => handleDeclineJob(job.id)}
                    className="flex-1 btn-outline !w-auto !py-2.5 text-error border-error/20 hover:bg-error-container"
                  >
                    Từ chối
                  </button>
                  <button 
                    onClick={() => handleAcceptJob(job.id)}
                    className="flex-[2] btn-primary !w-auto !py-2.5"
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
            <div key={job.id} className="card-elevated border-l-4 border-primary-container !p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                <span className={`badge ${job.status === 'assigned' ? 'badge-assigned' : 'badge-in_progress'} uppercase text-[10px]`}>
                  {job.status === 'assigned' ? 'Mới nhận' : 'Đang thực hiện'}
                </span>
                <button className="text-primary-container font-bold text-body-sm">Chi tiết</button>
              </div>

              <div className="min-w-0">
                <h3 className="text-body-md font-bold text-on-surface truncate">{job.customerName}</h3>
                <p className="text-body-sm text-on-surface-variant mb-2">{job.serviceName}</p>
                <div className="flex items-start gap-2 text-label-sm text-on-surface-variant bg-surface-container-lowest p-2 rounded-lg ">
                  <MapPinIcon size={14} className="shrink-0 mt-0.5 text-primary-container" />
                  <span className="line-clamp-2">{job.address || "Chưa cung cấp địa chỉ"}</span>
                </div>
              </div>

              {job.images && job.images.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-label-sm font-bold text-on-surface-variant uppercase tracking-wide">
                    <CameraIcon size={14} />
                    Ảnh khách gửi trước
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {job.images.slice(0, 3).map((imgUrl: string, idx: number) => (
                      <a
                        key={imgUrl}
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-low"
                      >
                        <img src={imgUrl} alt={`Ảnh hiện trạng ${idx + 1}`} className="h-full w-full object-cover" />
                        {idx === 2 && job.images.length > 3 && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-bold text-white">
                            +{job.images.length - 3}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 py-3 border-y border-outline-variant/50">
                <button
                  onClick={() => showToast("Tính năng đang được phát triển, vui lòng chờ...", "info")}
                  className="flex-1 flex flex-col items-center gap-1 p-2 hover:bg-surface-container rounded-xl transition-colors"
                >
                  <PhoneIcon size={20} className="text-success" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Gọi khách</span>
                </button>
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
            <div className="p-4 sm:p-5 border-t border-outline-variant/50 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
              <button 
                type="button"
                onClick={() => {
                  setActiveJobToComplete(null);
                  setSelectedFiles([]);
                  setPreviewUrls([]);
                }}
                className="btn-outline !w-auto flex-1 !py-2 !px-4 text-sm sm:flex-none"
                disabled={uploadingImages}
              >
                Hủy bỏ
              </button>
              <button 
                type="button" 
                onClick={handleConfirmCompleteJob}
                className="btn-primary !w-auto flex-[1.4] !py-2 !px-5 text-sm !bg-success !border-success sm:min-w-[140px] sm:flex-none"
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
