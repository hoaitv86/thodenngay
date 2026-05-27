"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MapPinIcon,
  ClockIcon,
  BriefcaseIcon,
  CogIcon,
  ZapIcon,
  DropletIcon,
  WrenchIcon,
  CameraIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XIcon
} from "../../components/icons";

const serviceVisuals = [
  {
    match: ["điện", "dien", "electric"],
    icon: ZapIcon,
    iconClass: "bg-amber-100 text-amber-700",
    selectedClass: "border-amber-500 bg-amber-50 shadow-amber-900/10",
    labelClass: "text-amber-700",
    chipClass: "bg-amber-100 text-amber-700",
  },
  {
    match: ["nước", "nuoc", "ống", "ong", "plumb"],
    icon: DropletIcon,
    iconClass: "bg-sky-100 text-sky-700",
    selectedClass: "border-sky-500 bg-sky-50 shadow-sky-900/10",
    labelClass: "text-sky-700",
    chipClass: "bg-sky-100 text-sky-700",
  },
  {
    match: ["camera", "cam", "cctv"],
    icon: CameraIcon,
    iconClass: "bg-violet-100 text-violet-700",
    selectedClass: "border-violet-500 bg-violet-50 shadow-violet-900/10",
    labelClass: "text-violet-700",
    chipClass: "bg-violet-100 text-violet-700",
  },
  {
    match: ["cơ khí", "co khi", "sắt", "sat", "khóa", "khoa"],
    icon: CogIcon,
    iconClass: "bg-emerald-100 text-emerald-700",
    selectedClass: "border-emerald-500 bg-emerald-50 shadow-emerald-900/10",
    labelClass: "text-emerald-700",
    chipClass: "bg-emerald-100 text-emerald-700",
  },
  {
    match: ["sửa", "sua", "lắp", "lap", "bảo trì", "bao tri"],
    icon: WrenchIcon,
    iconClass: "bg-rose-100 text-rose-700",
    selectedClass: "border-rose-500 bg-rose-50 shadow-rose-900/10",
    labelClass: "text-rose-700",
    chipClass: "bg-rose-100 text-rose-700",
  },
];

const defaultServiceVisual = {
  icon: BriefcaseIcon,
  iconClass: "bg-primary-fixed text-primary-container",
  selectedClass: "border-primary-container bg-primary-fixed/40 shadow-blue-900/10",
  labelClass: "text-primary-container",
  chipClass: "bg-primary-fixed text-primary-container",
};

export default function CustomerBooking() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | null }>({ message: '', type: null });
  const [services, setServices] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    serviceId: "",
    address: "",
    scheduledAt: "",
    description: ""
  });

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      
      // Fetch active services
      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (servicesData) setServices(servicesData);

      // Fetch user profile for address
      let userAddress = "";
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('address')
          .eq('id', user.id)
          .single();
        if (profile?.address) {
          userAddress = profile.address;
        }
      }

      // Default time: Tomorrow 9:00 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const tzoffset = (new Date()).getTimezoneOffset() * 60000;
      const localISOTime = new Date(tomorrow.getTime() - tzoffset).toISOString().slice(0, 16);

      setFormData(prev => ({ ...prev, scheduledAt: localISOTime, address: userAddress }));
      setLoading(false);
    };
    init();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (type === 'error') {
      setTimeout(() => setToast({ message: '', type: null }), 3000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(file => file.type.startsWith("image/"));
    const oversized = imageFiles.find(file => file.size > 8 * 1024 * 1024);
    if (oversized) {
      showToast("Mỗi ảnh tối đa 8MB.", "error");
      e.target.value = "";
      return;
    }

    const nextFiles = [...selectedFiles, ...imageFiles].slice(0, 5);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles(nextFiles);
    setPreviewUrls(nextFiles.map(file => URL.createObjectURL(file)));
    e.target.value = "";
  };

  const removeSelectedFile = (index: number) => {
    const nextFiles = selectedFiles.filter((_, i) => i !== index);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles(nextFiles);
    setPreviewUrls(nextFiles.map(file => URL.createObjectURL(file)));
  };

  const uploadRequestImages = async (userId: string) => {
    const imageUrls: string[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `requests/${userId}/${Date.now()}_${i}.${ext}`;
      const { error } = await supabase.storage
        .from("job-photos")
        .upload(filePath, file);

      if (error) {
        throw new Error("Không thể tải ảnh lên: " + error.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("job-photos")
        .getPublicUrl(filePath);
      imageUrls.push(publicUrl);
    }
    return imageUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serviceId || !formData.address || !formData.scheduledAt) {
      showToast("Vui lòng điền đầy đủ các thông tin bắt buộc!", "error");
      return;
    }

    setIsSubmitting(true);

    // Get current user for customer_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast("Bạn chưa đăng nhập!", "error");
      setIsSubmitting(false);
      return;
    }

    try {
      // Determine quoted_price based on selected service
      const selectedService = services.find(s => s.id === formData.serviceId);
      const quotedPrice = selectedService?.base_price || 0;
      const imageUrls = await uploadRequestImages(user.id);
      const jobCode = 'APP' + Math.floor(10000 + Math.random() * 90000);

      const { error } = await supabase.from('jobs').insert({
        job_code: jobCode,
        customer_id: user.id,
        service_id: formData.serviceId,
        address: formData.address,
        scheduled_at: new Date(formData.scheduledAt).toISOString(),
        description: formData.description,
        quoted_price: quotedPrice,
        images: imageUrls,
        status: 'pending',
        source: 'app',
        created_by: user.id
      });

      if (error) {
        throw new Error(error.message);
      }

      setIsSubmitting(false);
      showToast("Đặt dịch vụ thành công! Hệ thống đang tìm thợ cho bạn.", "success");
      setTimeout(() => {
        router.push("/customer/jobs");
      }, 1500);
    } catch (error: any) {
      setIsSubmitting(false);
      showToast("Lỗi khi đặt dịch vụ: " + error.message, "error");
    }
  };

  const getServiceVisual = (service: any) => {
    const explicitIcon = String(service.icon || "");
    const name = String(service.name || "").toLowerCase();
    const explicitVisual = serviceVisuals.find(item => item.icon.name === explicitIcon);
    if (explicitVisual) return explicitVisual;

    return serviceVisuals.find(item => item.match.some(keyword => name.includes(keyword))) || defaultServiceVisual;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100dvh-8rem)] bg-surface animate-fade-in relative">
      {/* Toast Notification */}
      {toast.type && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm px-4 py-3 rounded-xl shadow-lg border animate-fade-in flex items-start gap-3 ${toast.type === 'success' ? 'bg-success-container text-on-success-container border-success/30' : 'bg-error-container text-on-error-container border-error/30'
          }`}>
          <div className="mt-0.5 shrink-0">
            {toast.type === 'success' ? <CheckCircleIcon size={20} /> : <XIcon size={20} />}
          </div>
          <span className="text-body-sm font-bold leading-tight pt-0.5">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#003178] via-[#0d47a1] to-[#fd6c00] px-4 pb-12 pt-7 text-white shadow-lg shadow-primary/10 sm:px-6">
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25" />
        <h1 className="relative text-2xl font-extrabold leading-tight text-white">Đặt dịch vụ mới</h1>
        <p className="relative mt-2 max-w-[19rem] text-sm leading-6 text-white/80">
          Chúng tôi sẽ tìm thợ phù hợp nhất với yêu cầu của bạn.
        </p>
      </div>

      {/* Booking Form */}
      <div className="-mt-6 flex-1 px-4 sm:mx-auto sm:w-full sm:max-w-md lg:max-w-4xl lg:px-8">
        <div className="rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-xl shadow-blue-900/5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Service Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-extrabold text-primary-container">
                  <BriefcaseIcon size={18} />
                  Chọn loại dịch vụ <span className="text-error">*</span>
                </label>
                <span className="rounded-full bg-primary-fixed px-2.5 py-1 text-[10px] font-bold uppercase text-primary-container">
                  Bắt buộc
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                {services.map(service => {
                  const visual = getServiceVisual(service);
                  const Icon = visual.icon;
                  const isSelected = formData.serviceId === service.id;

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, serviceId: service.id })}
                      className={`flex min-h-[128px] flex-col items-start justify-between rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] sm:p-4 ${isSelected
                          ? `${visual.selectedClass} shadow-lg`
                          : 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/30 hover:bg-primary-fixed/20'
                        }`}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ${isSelected ? 'bg-white text-on-surface' : visual.iconClass}`}>
                          <Icon size={21} />
                        </div>
                        {isSelected && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white">
                            <CheckCircleIcon size={14} />
                          </span>
                        )}
                      </div>
                      <div className="mt-3 min-w-0">
                        <span className={`block text-sm font-extrabold leading-5 ${isSelected ? visual.labelClass : 'text-on-surface'}`}>
                          {service.name}
                        </span>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${isSelected ? visual.chipClass : 'bg-surface-container text-on-surface-variant'}`}>
                          Từ {service.base_price ? service.base_price.toLocaleString('vi-VN') : 0}đ
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
            {/* Address */}
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-primary-container flex items-center gap-2">
                <MapPinIcon size={18} />
                Địa chỉ thực hiện <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Số nhà, Tên đường, Phường/Xã..."
                className="input-field w-full !border-primary-fixed !bg-primary-fixed/20 font-semibold text-on-surface placeholder:text-on-surface-variant/60"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-primary-container flex items-center gap-2">
                <ClockIcon size={18} />
                Thời gian mong muốn <span className="text-error">*</span>
              </label>
              <input
                type="datetime-local"
                required
                className="input-field w-full !border-primary-fixed !bg-primary-fixed/20 font-semibold text-on-surface"
                value={formData.scheduledAt}
                onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
              />
            </div>
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-primary-container">
                Mô tả tình trạng (Tùy chọn)
              </label>
              <textarea
                placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải..."
                className="input-field w-full min-h-[112px] resize-none !border-outline-variant/40 !bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Request Images */}
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-primary-container flex items-center gap-2">
                <CameraIcon size={18} />
                Ảnh hiện trạng / khu vực làm việc
              </label>
              <p className="text-xs text-on-surface-variant">
                Tải tối đa 5 ảnh để thợ xem trước địa hình và chuẩn bị dụng cụ phù hợp.
              </p>
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-secondary-container/50 bg-secondary-container/5 px-4 py-5 text-center transition-colors hover:bg-secondary-container/10">
                <CameraIcon size={26} className="mb-2 text-secondary-container" />
                <span className="text-sm font-bold text-secondary">Thêm ảnh</span>
                <span className="mt-1 text-[11px] text-on-surface-variant">PNG, JPG, JPEG • tối đa 8MB/ảnh</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {previewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previewUrls.map((url, idx) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container">
                      <img src={url} alt={`Ảnh hiện trạng ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(idx)}
                        className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white"
                        aria-label="Xóa ảnh"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !formData.serviceId || !formData.address || !formData.scheduledAt}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-container px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-secondary-container/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </span>
              ) : (
                <>
                  Xác nhận đặt lịch
                  <ArrowRightIcon size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      <div className="h-6"></div>
    </div>
  );
}
