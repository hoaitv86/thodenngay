"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LogoIcon,
  UserIcon,
  WrenchIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  MapPinIcon,
} from "../components/icons";

type UserRole = "customer" | "worker";
type GpsLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
};

import { createClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/settings";

function RegisterContent() {

  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const initialRole = searchParams.get("role") === "worker" ? "worker" : "customer";

  const [role, setRole] = useState<UserRole>(initialRole);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    gpsLocation: null as GpsLocation | null,
    specialties: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const [specialtyOptions, setSpecialtyOptions] = useState<string[]>([
    "Sửa điện",
    "Sửa nước",
    "Lắp camera",
    "Cơ khí",
    "Điều hòa",
    "Sơn nhà",
    "Mộc",
  ]);

  useEffect(() => {
    async function fetchServices() {
      const { data, error } = await supabase
        .from("services")
        .select("name")
        .eq("is_active", true);

      if (data && !error) {
        setSpecialtyOptions(data.map((svc: { name: string }) => svc.name));
      }
    }
    fetchServices();
  }, [supabase]);

  const toggleSpecialty = (sp: string) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(sp)
        ? prev.specialties.filter((s) => s !== sp)
        : [...prev.specialties, sp],
    }));
  };

  const handleUseCurrentLocation = () => {
    setError("");
    setLocationMessage("");

    if (!("geolocation" in navigator)) {
      setLocationMessage("Trình duyệt không hỗ trợ định vị. Bạn vẫn có thể nhập địa chỉ thủ công.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
        };

        setFormData((prev) => ({
          ...prev,
          gpsLocation: location,
        }));
        setLocationMessage(`Đã lấy vị trí hiện tại (${location.lat}, ${location.lng}).`);
        setLocating(false);
      },
      () => {
        setLocationMessage("Không thể lấy vị trí. Vui lòng cho phép quyền định vị hoặc thử lại.");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      }
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      setError("Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }
    if (formData.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);
    setError("");

    // Supabase Auth Sign Up
    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.name,
          role: role,
          specialties: role === 'worker' ? formData.specialties : [],
        }
      }
    });

    if (authError) {
      setError("Lỗi đăng ký: " + authError.message);
      setLoading(false);
      return;
    }

    // Update profile with optional fields if trigger didn't handle everything 
    // or if we need to add more details like phone/address immediately
    if (data.user) {
      await supabase
        .from('profiles')
        .update({
          phone: formData.phone,
          address: formData.address,
          gps_location: formData.gpsLocation
        })
        .eq('id', data.user.id);

      if (role === 'worker' && formData.specialties.length > 0) {
        await supabase
          .from('workers')
          .update({
            specialties: formData.specialties
          })
          .eq('user_id', data.user.id);
      }
    }

    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="auth-card max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-success-container text-success">
            <CheckCircleIcon size={40} />
          </div>
          <h1 className="mb-3 text-3xl font-bold text-on-surface">
            {role === "customer" ? "Đăng ký thành công!" : "Đã gửi yêu cầu!"}
          </h1>
          <p className="mb-8 leading-relaxed text-on-surface-variant">
            {role === "customer"
              ? "Tài khoản của bạn đã được tạo. Vui lòng kiểm tra email để xác nhận (nếu yêu cầu) và đăng nhập."
              : "Hồ sơ thợ của bạn đã được gửi và đang chờ duyệt. Admin sẽ liên hệ với bạn sớm nhất."}
          </p>
          <Link href="/login" className="w-full btn-primary !py-4 flex items-center justify-center gap-2">
            Đăng nhập ngay
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="auth-brand-panel p-12">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0)_42%),linear-gradient(180deg,rgba(242,106,33,0.16),rgba(242,106,33,0)_52%)]" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <LogoIcon size={40} />
            <span className="text-2xl font-bold">{settings.app_name}</span>
          </Link>
        </div>

        <div className="relative z-10">
          <h2 className="text-lg mb-4 text-white font-bold">
            {role === "customer" ? (
              <>
                Tìm thợ giỏi{" "}
                <span className="text-secondary-container">dễ dàng</span>
              </>
            ) : (
              <>
                Nhận việc{" "}
                <span className="text-secondary-container">mỗi ngày</span>
              </>
            )}
          </h2>
          <p className="text-lg text-white/80 w-full max-w-[400px] leading-relaxed">
            {role === "customer"
              ? "Đăng ký tài khoản để đặt dịch vụ sửa chữa tại nhà nhanh chóng và tiện lợi."
              : `Đăng ký làm thợ trên ${settings.app_name} để tiếp cận hàng ngàn khách hàng tiềm năng.`}
          </p>
        </div>

        <div className="relative z-10 text-label-sm text-white/40">
          © 2026 {settings.app_name}. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="flex w-full flex-1 items-center justify-center overflow-y-auto bg-white p-4 sm:p-6">
        <div className="w-full max-w-[500px] mx-auto py-6 sm:py-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <LogoIcon size={36} />
            <span className="text-2xl font-bold text-primary">{settings.app_name}</span>
          </div>

          <div className="auth-card">
            <div className="mb-7 text-center sm:text-left">
              <h1 className="mb-2 text-2xl font-bold text-on-surface sm:text-3xl">Đăng ký</h1>
              <p className="text-on-surface-variant">Tạo tài khoản mới để bắt đầu sử dụng</p>
            </div>

            {/* Role Toggle */}
            <div className="mb-7 grid grid-cols-2 gap-1.5 rounded-lg bg-surface-container-low p-1.5">
              <button
                type="button"
                onClick={() => setRole("customer")}
                className={`flex min-w-0 items-center justify-center gap-2 py-3 px-2 rounded-lg text-sm font-semibold transition-all sm:py-3.5 sm:px-4 ${role === "customer"
                    ? "bg-white text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                  }`}
              >
                <UserIcon size={18} />
                Khách hàng
              </button>
              <button
                type="button"
                onClick={() => setRole("worker")}
                className={`flex min-w-0 items-center justify-center gap-2 py-3 px-2 rounded-lg text-sm font-semibold transition-all sm:py-3.5 sm:px-4 ${role === "worker"
                    ? "bg-white text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                  }`}
              >
                <WrenchIcon size={18} />
                Đăng ký thợ
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-5 sm:space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:gap-6">
                <div>
                  <label htmlFor="register-name" className="block text-sm font-semibold text-on-surface mb-2">
                    Họ và tên
                  </label>
                  <input
                    id="register-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="input-field py-3.5"
                    placeholder="Nguyễn Văn A"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="register-email" className="block text-sm font-semibold text-on-surface mb-2">
                    Email
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    className="input-field py-3.5"
                    placeholder="name@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="register-password" className="block text-sm font-semibold text-on-surface mb-2">
                    Mật khẩu
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                    className="input-field py-3.5"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label htmlFor="register-phone" className="block text-sm font-semibold text-on-surface mb-2">
                    Số điện thoại (tùy chọn)
                  </label>
                  <input
                    id="register-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    className="input-field py-3.5"
                    placeholder="0912345678"
                  />
                </div>

                <div>
                  <label htmlFor="register-address" className="block text-sm font-semibold text-on-surface mb-2">
                    Địa chỉ (tùy chọn)
                  </label>
                  <input
                    id="register-address"
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                    className="input-field py-3.5"
                    placeholder="Q.1, TP.HCM"
                  />
                </div>

                <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
                      <MapPinIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-extrabold text-on-surface">
                            {role === "worker" ? "Định vị thợ" : "Định vị khách hàng"}
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">
                            {role === "worker"
                              ? "Lưu tọa độ khu vực hoạt động để hệ thống gợi ý đơn phù hợp gần bạn."
                              : "Lưu tọa độ để thợ tìm đúng vị trí khi bạn đặt dịch vụ."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleUseCurrentLocation}
                          disabled={locating}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-secondary-container px-3 py-2 text-xs font-extrabold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                        >
                          {locating ? (
                            <>
                              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Đang lấy...
                            </>
                          ) : (
                            <>
                              <MapPinIcon size={15} />
                              Lấy vị trí hiện tại
                            </>
                          )}
                        </button>
                      </div>

                      {formData.gpsLocation && (
                        <div className="mt-3 rounded-lg bg-success-container px-3 py-2 text-xs font-semibold text-success">
                          Vị trí đã lưu: {formData.gpsLocation.lat}, {formData.gpsLocation.lng}
                          {formData.gpsLocation.accuracy ? ` · sai số khoảng ${formData.gpsLocation.accuracy}m` : ""}
                        </div>
                      )}

                      {locationMessage && !formData.gpsLocation && (
                        <p className="mt-3 text-xs font-semibold text-on-surface-variant">{locationMessage}</p>
                      )}
                    </div>
                  </div>
                </div>


                {/* Worker Specialties */}
                {role === "worker" && (
                  <div>
                    <label className="block text-sm font-semibold text-on-surface mb-3">
                      Chuyên môn <span className="text-error">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {specialtyOptions.map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          onClick={() => toggleSpecialty(sp)}
                          className={`px-3 py-2.5 rounded-xl text-sm transition-all border ${formData.specialties.includes(sp)
                              ? "bg-primary border-primary text-white shadow-sm font-semibold"
                              : "bg-surface-container-low border-transparent text-on-surface-variant hover:border-primary/30"
                            }`}
                        >
                          {formData.specialties.includes(sp) && "✓ "}
                          {sp}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex gap-2 rounded-lg bg-error-container p-3 text-sm text-error" role="alert">
                  <span aria-hidden="true">!</span> {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-4 group"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang xử lý...
                  </span>
                ) : (
                  <>
                    Đăng ký ngay
                    <ArrowRightIcon size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-outline-variant/20 pt-7 text-center">
              <p className="text-sm text-on-surface-variant">
                Đã có tài khoản?{" "}
                <Link
                  href="/login"
                  className="font-bold text-primary-container hover:underline"
                >
                  Đăng nhập
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface">Đang tải...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
