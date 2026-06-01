"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  ChevronRightIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XIcon
} from "../components/icons";

export default function BookingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [bookingData, setBookingData] = useState({
    address: "",
    time: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

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
        const iconMap: Record<string, any> = {
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
        const colorMap: Record<string, any> = {
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

        const mapped = svcs.map(s => ({
          ...s,
          iconComponent: iconMap[s.icon] || BriefcaseIcon,
          formattedPrice: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(s.base_price),
          ...(colorMap[s.icon] || { color: "#003178", bgColor: "#f0f4f9" })
        }));
        setServices(mapped);
      }
    };
    init();
  }, [router, supabase]);

  const handleNext = () => {
    if (step === 1 && !selectedService) return;
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedService) return;
    
    setLoading(true);
    
    const jobCode = `JOB-${Math.floor(1000 + Math.random() * 9000)}`;
    const scheduledAt = bookingData.time === "Đến ngay" 
      ? new Date().toISOString() 
      : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // Simple placeholder for "Hẹn giờ"

    const { error } = await supabase.from('jobs').insert({
      job_code: jobCode,
      customer_id: user.id,
      service_id: selectedService.id,
      address: bookingData.address,
      description: bookingData.description,
      quoted_price: selectedService.base_price,
      scheduled_at: scheduledAt,
      status: 'pending',
      source: 'app',
      created_by: user.id
    });

    if (error) {
      console.error("Booking error:", error);
      alert("Có lỗi xảy ra khi đặt lịch. Vui lòng thử lại.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep(4); // Success
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="h-16 glass sticky top-0 z-50 flex items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon size={32} />
          <span className="font-bold text-lg text-primary-container">Alo Thợ</span>
        </Link>
        <div className="flex-1 flex justify-center">
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

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 py-10">
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="text-headline-lg mb-2">Bạn cần sửa gì?</h1>
            <p className="text-body-md text-on-surface-variant mb-8">Chọn loại dịch vụ bạn đang gặp vấn đề để Alo Thợ hỗ trợ tốt nhất.</p>
            
            <div className="grid grid-cols-1 gap-4">
              {services.map((svc) => {
                const isSelected = selectedService?.id === svc.id;
                return (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedService(svc)}
                    className={`flex items-center gap-5 p-5 card text-left transition-all ${isSelected ? 'border-primary-container bg-primary-fixed/30 ring-1 ring-primary-container' : ''}`}
                  >
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: svc.bgColor, color: svc.color }}
                    >
                      <svc.iconComponent size={28} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-on-surface">{svc.name}</h3>
                      <p className="text-body-sm text-on-surface-variant">{svc.description}</p>
                      <div className="text-label-sm text-primary-container mt-1 font-semibold">Từ {svc.formattedPrice}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary-container border-primary-container' : 'border-outline-variant'}`}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-10 sticky bottom-6">
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
            <p className="text-body-md text-on-surface-variant mb-8">Cho chúng tôi biết thợ cần đến đâu và khi nào.</p>

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

        {step === 3 && (
          <div className="animate-fade-in">
            <button onClick={() => setStep(2)} className="text-primary-container font-semibold mb-6 flex items-center gap-1 hover:underline">
              ← Quay lại
            </button>
            <h1 className="text-headline-lg mb-2">Xác nhận đặt lịch</h1>
            <p className="text-body-md text-on-surface-variant mb-8">Kiểm tra lại thông tin trước khi gửi yêu cầu cho thợ.</p>

            <div className="card-elevated !p-6 space-y-6 mb-8">
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
              </div>

              <div className="bg-primary-fixed/30 p-4 rounded-xl flex justify-between items-center">
                <span className="text-body-sm font-semibold text-primary-container">Giá ước tính</span>
                <span className="text-headline-md text-primary-container">{selectedService.price}</span>
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
                Bằng cách đặt lịch, bạn đồng ý với các Điều khoản & Chính sách của Alo Thợ.
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
              Alo Thợ đang gán thợ phù hợp nhất cho bạn. Bạn sẽ nhận được thông báo trong vài phút tới.
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
