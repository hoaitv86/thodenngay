"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { applyDefaultServiceParents } from "@/lib/service-hierarchy";
import {
  getCustomerServiceBasePrice,
  getCustomerServiceDisplayName,
  getCustomerServiceGroups,
  getCustomerServicePathLabel,
} from "@/lib/customer-service-catalog";
import {
  LogoIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  WrenchIcon,
  ShieldCheckIcon,
  StarIcon,
  ClockIcon,
  MapPinIcon,
  BriefcaseIcon,
  BarChartIcon,
  CalendarIcon,
  PhoneIcon,
  UsersIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XIcon
} from "../components/icons";

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

type RawService = {
  id: string;
  name: string;
  description?: string | null;
  base_price?: number | null;
  icon?: string | null;
  parent_service_id?: string | null;
};

type BookingService = RawService & {
  iconComponent: IconComponent;
  formattedPrice: string;
  color: string;
  bgColor: string;
};

type ServiceColor = {
  color: string;
  bgColor: string;
};

export default function BookingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<BookingService[]>([]);
  const [selectedService, setSelectedService] = useState<BookingService | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [bookingData, setBookingData] = useState({
    address: "",
    time: "",
    description: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirect=/booking");
        return;
      }
      setUser(user);

      // Fetch real services
      const { data: svcs } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true);
      
      if (svcs) {
        // Map icon component and colors (supporting all 14 system icons)
        const iconMap: Record<string, IconComponent> = {
          ZapIcon,
          DropletIcon,
          CameraIcon,
          CogIcon,
          WrenchIcon,
          ShieldCheckIcon,
          StarIcon,
          ClockIcon,
          MapPinIcon,
          BriefcaseIcon,
          BarChartIcon,
          CalendarIcon,
          PhoneIcon,
          UsersIcon
        };
        const colorMap: Record<string, ServiceColor> = {
          'ZapIcon': { color: "#f59e0b", bgColor: "#fef3c7" },
          'DropletIcon': { color: "#3b82f6", bgColor: "#dbeafe" },
          'CameraIcon': { color: "#8b5cf6", bgColor: "#ede9fe" },
          'CogIcon': { color: "#10b981", bgColor: "#d1fae5" },
          'WrenchIcon': { color: "#ec4899", bgColor: "#fce7f3" },
          'ShieldCheckIcon': { color: "#059669", bgColor: "#d1fae5" },
          'StarIcon': { color: "#eab308", bgColor: "#fef9c3" },
          'ClockIcon': { color: "#6366f1", bgColor: "#e0e7ff" },
          'MapPinIcon': { color: "#ef4444", bgColor: "#fee2e2" },
          'BriefcaseIcon': { color: "#64748b", bgColor: "#f1f5f9" },
          'BarChartIcon': { color: "#06b6d4", bgColor: "#ecfeff" },
          'CalendarIcon': { color: "#f43f5e", bgColor: "#ffe4e6" },
          'PhoneIcon': { color: "#14b8a6", bgColor: "#ccfbf1" },
          'UsersIcon': { color: "#f97316", bgColor: "#ffedd5" }
        };

        const mapped = applyDefaultServiceParents(svcs as RawService[]).map((s): BookingService => ({
          ...s,
          iconComponent: iconMap[s.icon || ""] || BriefcaseIcon,
          formattedPrice: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(s.base_price || 0),
          ...(colorMap[s.icon || ""] || { color: "#003178", bgColor: "#f0f4f9" })
        }));
        setServices(mapped);
        if (mapped[0]) {
          setSelectedCategoryId(getCustomerServiceGroups(mapped)[0]?.category.id || "");
        }
      }
    };
    init();
  }, [router, supabase]);

  const handleNext = () => {
    if (step === 1 && !selectedService) return;
    setStep(step + 1);
  };
  const serviceGroups = getCustomerServiceGroups(services);
  const selectedGroup = serviceGroups.find((group) => group.category.id === selectedCategoryId) || serviceGroups[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(file => file.type.startsWith("image/"));
    const oversized = imageFiles.find(file => file.size > 8 * 1024 * 1024);
    if (oversized) {
      alert("Mỗi ảnh tối đa 8MB.");
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
    if (!user || !selectedService) return;
    
    setLoading(true);
    
    const jobCode = `JOB-${Math.floor(1000 + Math.random() * 9000)}`;
    const scheduledAt = bookingData.time === "Đến ngay" 
      ? new Date().toISOString() 
      : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // Simple placeholder for "Hẹn giờ"

    try {
      const imageUrls = await uploadRequestImages(user.id);
      const { error } = await supabase.from('jobs').insert({
        job_code: jobCode,
        customer_id: user.id,
        service_id: selectedService.id,
        address: bookingData.address,
        description: bookingData.description,
        quoted_price: getCustomerServiceBasePrice(selectedService, services),
        scheduled_at: scheduledAt,
        images: imageUrls,
        status: 'pending',
        source: 'app',
        created_by: user.id
      });

      if (error) {
        throw new Error(error.message);
      }

      setLoading(false);
      setStep(4); // Success
    } catch (error) {
      console.error("Booking error:", error);
      alert("Có lỗi xảy ra khi đặt lịch. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      {/* Header */}
      <header className="h-16 glass sticky top-0 z-50 flex items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon size={32} />
          <span className="font-bold text-base sm:text-lg text-primary-container">Thợ đến ngay</span>
        </Link>
        <div className="flex-1 flex justify-center px-3">
          <div className="flex items-center gap-3">
            {[1, 2, 3].map((s) => (
              <div 
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${step >= s ? 'bg-primary-container w-8' : 'bg-outline-variant'}`}
              />
            ))}
          </div>
        </div>
        <button onClick={() => router.back()} className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant">
          <XIcon size={20} />
        </button>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 sm:p-6 sm:py-10">
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="text-headline-lg mb-2">Bạn cần sửa gì?</h1>
            <p className="text-body-md text-on-surface-variant mb-6 sm:mb-8">Chọn loại dịch vụ bạn đang gặp vấn đề để Thợ đến ngay hỗ trợ tốt nhất.</p>
            
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {serviceGroups.map(({ category, services: categoryServices }) => {
                const isSelected = selectedGroup?.category.id === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      setSelectedService(null);
                    }}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${isSelected ? 'border-primary-container bg-primary-fixed/30 ring-1 ring-primary-container' : 'border-outline-variant bg-surface-container-lowest'}`}
                  >
                    <span className="block text-2xl leading-none">{category.emoji || "•"}</span>
                    <span className="mt-2 block text-sm font-bold text-on-surface">{category.name}</span>
                    <span className="mt-1 block text-xs text-on-surface-variant">{categoryServices.length} dịch vụ</span>
                  </button>
                );
              })}
            </div>

            {selectedGroup && (
              <div className="space-y-5">
                {selectedService && (
                  <div className="rounded-xl border border-success/20 bg-success-container/60 px-4 py-3 text-sm font-extrabold text-success">
                    Bạn đã chọn: {getCustomerServicePathLabel(selectedService, services).replace(" / ", " → ")}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {selectedGroup.services.map((svc) => {
                const isSelected = selectedService?.id === svc.id;
                const displayName = getCustomerServiceDisplayName(svc);
                const displayPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(getCustomerServiceBasePrice(svc, services));
                return (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedService(svc)}
                    className={`card flex items-center gap-3 p-4 text-left transition-all sm:gap-5 sm:p-5 ${isSelected ? 'border-primary-container bg-primary-fixed/30 ring-1 ring-primary-container' : ''}`}
                  >
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 sm:w-14 sm:h-14"
                      style={{ backgroundColor: svc.bgColor, color: svc.color }}
                    >
                      <svc.iconComponent size={28} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-on-surface">{displayName}</h3>
                      <p className="text-body-sm text-on-surface-variant line-clamp-2">{svc.description}</p>
                      <div className="text-label-sm text-primary-container mt-1 font-semibold">Từ {displayPrice}</div>
                    </div>
                    <div className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary-container border-primary-container' : 'border-outline-variant'}`}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </button>
                );
                    })}
                  </div>
              </div>
            )}

            <div className="mt-8 sticky bottom-4 sm:bottom-6">
              <button 
                onClick={handleNext}
                disabled={!selectedService}
                className="btn-primary w-full !py-4 shadow-xl"
              >
                Tiếp tục
                <ArrowRightIcon size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <button onClick={() => setStep(1)} className="text-primary-container font-semibold mb-6 flex items-center gap-1 hover:underline">
              ← Quay lại
            </button>
            <h1 className="text-headline-lg mb-2">Địa chỉ & Thời gian</h1>
            <p className="text-body-md text-on-surface-variant mb-6 sm:mb-8">Cho chúng tôi biết thợ cần đến đâu và khi nào.</p>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-label-md flex items-center gap-2">
                  <MapPinIcon size={16} /> Địa chỉ nhận việc
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Số nhà, tên đường, quận/huyện..."
                  value={bookingData.address}
                  onChange={e => setBookingData({...bookingData, address: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-label-md flex items-center gap-2">
                  <ClockIcon size={16} /> Thời gian mong muốn
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {["Đến ngay", "Hẹn giờ"].map(t => (
                    <button 
                      key={t}
                      onClick={() => setBookingData({...bookingData, time: t})}
                      className={`py-3 rounded-xl border-2 transition-all font-semibold ${bookingData.time === t ? 'border-primary-container bg-primary-fixed text-primary-container' : 'border-outline-variant text-on-surface-variant'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-label-md flex items-center gap-2">
                  Mô tả thêm (tùy chọn)
                </label>
                <textarea 
                  rows={4}
                  className="input-field" 
                  placeholder="Mô tả chi tiết tình trạng hỏng hóc để thợ chuẩn bị dụng cụ..."
                  value={bookingData.description}
                  onChange={e => setBookingData({...bookingData, description: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-label-md flex items-center gap-2">
                  <CameraIcon size={16} /> Ảnh hiện trạng / khu vực làm việc
                </label>
                <p className="text-xs text-on-surface-variant">
                  Tải tối đa 5 ảnh để thợ xem trước địa hình và chuẩn bị dụng cụ.
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
            </div>

            <div className="mt-10">
              <button 
                onClick={handleNext}
                disabled={!bookingData.address || !bookingData.time}
                className="btn-primary w-full !py-4 shadow-xl"
              >
                Tiếp tục
                <ArrowRightIcon size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && selectedService && (
          <div className="animate-fade-in">
            <button onClick={() => setStep(2)} className="text-primary-container font-semibold mb-6 flex items-center gap-1 hover:underline">
              ← Quay lại
            </button>
            <h1 className="text-headline-lg mb-2">Xác nhận đặt lịch</h1>
            <p className="text-body-md text-on-surface-variant mb-6 sm:mb-8">Kiểm tra lại thông tin trước khi gửi yêu cầu cho thợ.</p>

            <div className="card-elevated !p-4 sm:!p-6 space-y-6 mb-8">
              <div className="flex items-center gap-4 border-b border-outline-variant pb-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: selectedService.bgColor, color: selectedService.color }}
                >
                  <selectedService.iconComponent size={24} />
                </div>
                <div>
                  <div className="text-label-sm text-on-surface-variant uppercase tracking-wider">Dịch vụ</div>
                  <div className="font-bold text-on-surface">{selectedService.name}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                    <MapPinIcon size={18} />
                  </div>
                  <div>
                    <div className="text-label-sm text-on-surface-variant">Địa chỉ</div>
                    <div className="text-body-sm font-semibold">{bookingData.address}</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                    <ClockIcon size={18} />
                  </div>
                  <div>
                    <div className="text-label-sm text-on-surface-variant">Thời gian</div>
                    <div className="text-body-sm font-semibold">{bookingData.time}</div>
                  </div>
                </div>

                {bookingData.description && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                      <BriefcaseIcon size={18} />
                    </div>
                    <div>
                      <div className="text-label-sm text-on-surface-variant">Mô tả</div>
                      <div className="text-body-sm text-on-surface-variant italic">{bookingData.description}</div>
                    </div>
                  </div>
                )}

                {previewUrls.length > 0 && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                      <CameraIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-label-sm text-on-surface-variant">Ảnh hiện trạng</div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {previewUrls.map((url, idx) => (
                          <div key={url} className="aspect-square overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container">
                            <img src={url} alt={`Ảnh hiện trạng ${idx + 1}`} className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-primary-fixed/30 p-4 rounded-xl flex justify-between items-center">
                <span className="text-body-sm font-semibold text-primary-container">Giá ước tính</span>
                <span className="text-xl font-bold text-primary-container sm:text-headline-md">{selectedService.formattedPrice}</span>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary w-full !py-4 shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang gửi yêu cầu...
                  </span>
                ) : (
                  <>
                    Xác nhận đặt lịch
                    <ArrowRightIcon size={20} />
                  </>
                )}
              </button>
              <p className="text-center text-label-sm text-on-surface-variant">
                Bằng cách đặt lịch, bạn đồng ý với các Điều khoản & Chính sách của Thợ đến ngay.
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in-up text-center py-10">
            <div className="w-24 h-24 rounded-full bg-success-container flex items-center justify-center mx-auto mb-8 text-success animate-bounce">
              <CheckCircleIcon size={48} />
            </div>
            <h1 className="text-headline-lg mb-3">Đã nhận yêu cầu!</h1>
            <p className="text-body-lg text-on-surface-variant mb-10 max-w-sm mx-auto">
              Thợ đến ngay đang gán thợ phù hợp nhất cho bạn. Bạn sẽ nhận được thông báo trong vài phút tới.
            </p>
            
            <div className="space-y-4 max-w-xs mx-auto">
              <Link href="/dashboard" className="btn-primary w-full !py-4 shadow-lg">
                Theo dõi Job
              </Link>
              <Link href="/" className="btn-outline w-full !py-4">
                Quay về trang chủ
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
