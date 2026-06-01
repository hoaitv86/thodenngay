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
  WrenchIcon,
  ShieldCheckIcon,
  StarIcon,
  BarChartIcon,
  CalendarIcon,
  PhoneIcon,
  UsersIcon,
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
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (data) setServices(data);

      // Default time: Tomorrow 9:00 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const tzoffset = (new Date()).getTimezoneOffset() * 60000;
      const localISOTime = new Date(tomorrow.getTime() - tzoffset).toISOString().slice(0, 16);

      setFormData(prev => ({ ...prev, scheduledAt: localISOTime }));
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

    // Determine quoted_price based on selected service
    const selectedService = services.find(s => s.id === formData.serviceId);
    const quotedPrice = selectedService?.base_price || 0;

    const jobCode = 'APP' + Math.floor(10000 + Math.random() * 90000);

    const { error } = await supabase.from('jobs').insert({
      job_code: jobCode,
      customer_id: user.id,
      service_id: formData.serviceId,
      address: formData.address,
      scheduled_at: new Date(formData.scheduledAt).toISOString(),
      description: formData.description,
      quoted_price: quotedPrice,
      status: 'pending',
      source: 'app',
      created_by: user.id
    });

    setIsSubmitting(false);

    if (error) {
      showToast("Lỗi khi đặt dịch vụ: " + error.message, "error");
    } else {
      showToast("Đặt dịch vụ thành công! Hệ thống đang tìm thợ cho bạn.", "success");
      setTimeout(() => {
        router.push("/customer/jobs");
      }, 1500);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'ZapIcon': return ZapIcon;
      case 'DropletIcon': return DropletIcon;
      case 'CameraIcon': return CameraIcon;
      case 'CogIcon': return CogIcon;
      case 'WrenchIcon': return WrenchIcon;
      case 'ShieldCheckIcon': return ShieldCheckIcon;
      case 'StarIcon': return StarIcon;
      case 'ClockIcon': return ClockIcon;
      case 'MapPinIcon': return MapPinIcon;
      case 'BriefcaseIcon': return BriefcaseIcon;
      case 'BarChartIcon': return BarChartIcon;
      case 'CalendarIcon': return CalendarIcon;
      case 'PhoneIcon': return PhoneIcon;
      case 'UsersIcon': return UsersIcon;
      default: return BriefcaseIcon;
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
    <div className="flex flex-col w-full min-h-[calc(100vh-8rem)] bg-surface animate-fade-in relative">
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
      <div className="bg-[#003178] text-white pt-8 pb-12 px-6">
        <h1 className="text-2xl font-bold">Đặt dịch vụ mới</h1>
        <p className="opacity-80 text-sm mt-1">
          Chúng tôi sẽ tìm thợ phù hợp nhất với yêu cầu của bạn.
        </p>
      </div>

      {/* Booking Form */}
      <div className="flex-1 px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg border border-outline-variant p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Service Selection */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                <BriefcaseIcon size={18} className="text-primary-container" />
                Chọn loại dịch vụ <span className="text-error">*</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                {services.map(service => {
                  const Icon = getIcon(service.icon);
                  const isSelected = formData.serviceId === service.id;

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, serviceId: service.id })}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${isSelected
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

            <button
              type="submit"
              disabled={isSubmitting || !formData.serviceId || !formData.address || !formData.scheduledAt}
              className="w-full btn-primary !py-4 !rounded-xl text-base flex items-center justify-center gap-2 mt-4 shadow-md shadow-primary-container/20 disabled:opacity-50 disabled:shadow-none"
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
      <div className="h-24"></div> {/* Bottom padding for navigation */}
    </div>
  );
}
