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
  CameraIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XIcon
} from "../../components/icons";

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

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'ZapIcon': return ZapIcon;
      case 'DropletIcon': return DropletIcon;
      case 'CameraIcon': return CameraIcon;
      default: return CogIcon;
    }
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
      <div className="bg-[#003178] text-white pt-7 pb-11 px-4 sm:px-6">
        <h1 className="text-2xl font-bold leading-tight text-white">Đặt dịch vụ mới</h1>
        <p className="opacity-80 text-sm mt-1 leading-6">
          Chúng tôi sẽ tìm thợ phù hợp nhất với yêu cầu của bạn.
        </p>
      </div>

      {/* Booking Form */}
      <div className="flex-1 px-4 -mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-outline-variant p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Service Selection */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                <BriefcaseIcon size={18} className="text-primary-container" />
                Chọn loại dịch vụ <span className="text-error">*</span>
              </label>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {services.map(service => {
                  const Icon = getIcon(service.icon);
                  const isSelected = formData.serviceId === service.id;

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, serviceId: service.id })}
                      className={`flex min-h-[116px] flex-col items-center justify-center p-3 rounded-xl border-2 transition-all sm:p-4 ${isSelected
                          ? 'border-primary-container bg-primary-fixed/30'
                          : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${isSelected ? 'bg-primary-container text-white' : 'bg-surface-container text-on-surface-variant'
                        }`}>
                        <Icon size={20} />
                      </div>
                      <span className={`text-xs font-bold text-center ${isSelected ? 'text-primary-container' : 'text-on-surface'}`}>
                        {service.name}
                      </span>
                      <span className="text-[10px] text-on-surface-variant mt-1">
                        Từ {service.base_price?.toLocaleString('vi-VN')}đ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                <MapPinIcon size={18} className="text-primary-container" />
                Địa chỉ thực hiện <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Số nhà, Tên đường, Phường/Xã..."
                className="input-field w-full"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                <ClockIcon size={18} className="text-primary-container" />
                Thời gian mong muốn <span className="text-error">*</span>
              </label>
              <input
                type="datetime-local"
                required
                className="input-field w-full"
                value={formData.scheduledAt}
                onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-on-surface">
                Mô tả tình trạng (Tùy chọn)
              </label>
              <textarea
                placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải..."
                className="input-field w-full min-h-[100px] resize-none"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Request Images */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                <CameraIcon size={18} className="text-primary-container" />
                Ảnh hiện trạng / khu vực làm việc
              </label>
              <p className="text-xs text-on-surface-variant">
                Tải tối đa 5 ảnh để thợ xem trước địa hình và chuẩn bị dụng cụ phù hợp.
              </p>
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/60 bg-surface-container-lowest px-4 py-5 text-center transition-colors hover:bg-surface-container-low">
                <CameraIcon size={26} className="mb-2 text-on-surface-variant/70" />
                <span className="text-sm font-bold text-primary-container">Thêm ảnh</span>
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
              className="w-full btn-primary !py-4 text-base flex items-center justify-center gap-2 mt-4 shadow-md shadow-primary-container/20 disabled:opacity-50 disabled:shadow-none"
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
