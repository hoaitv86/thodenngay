"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
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

type GpsLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  captured_at?: string;
};

import { createClient } from "@/lib/supabase/client";
import { buildPhoneLoginEmail, normalizePhone } from "@/lib/account-roles";
import { useSettings } from "@/lib/settings";
import {
  buildWorkerSpecialtyGroups,
  expandWorkerSpecialties,
  type WorkerSpecialtyGroup,
} from "@/lib/worker-specialty-catalog";

function RegisterContent() {

  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const initialWorkerSignup = searchParams.get("role") === "worker";

  const [requestWorkerRole, setRequestWorkerRole] = useState(initialWorkerSignup);
  const [formData, setFormData] = useState({
    name: "",
    recoveryEmail: "",
    password: "",
    phone: "",
    address: "",
    gpsLocation: null as GpsLocation | null,
  });
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();
  const [specialtyGroups, setSpecialtyGroups] = useState<WorkerSpecialtyGroup[]>(() => buildWorkerSpecialtyGroups());
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
  const [selectedChildValues, setSelectedChildValues] = useState<string[]>([]);

  useEffect(() => {
    async function fetchServices() {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, parent_service_id")
        .eq("is_active", true);

      if (data && !error) {
        setSpecialtyGroups(buildWorkerSpecialtyGroups(data));
      }
    }
    fetchServices();
  }, [supabase]);

  const selectedSpecialties = useMemo(
    () => expandWorkerSpecialties(selectedParentIds, selectedChildValues, specialtyGroups),
    [selectedParentIds, selectedChildValues, specialtyGroups]
  );

  const toggleParentSpecialty = (group: WorkerSpecialtyGroup) => {
    setSelectedParentIds(prev => {
      const isSelected = prev.includes(group.id);
      if (isSelected) {
        setSelectedChildValues(childValues => childValues.filter(value => !group.children.some(child => child.value === value)));
        return prev.filter(id => id !== group.id);
      }
      return [...prev, group.id];
    });
  };

  const toggleChildSpecialty = (group: WorkerSpecialtyGroup, value: string) => {
    setSelectedParentIds(prev => prev.includes(group.id) ? prev : [...prev, group.id]);
    setSelectedChildValues(prev =>
      prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value]
    );
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
    const normalizedPhone = normalizePhone(formData.phone);
    if (!formData.name || !formData.phone || !formData.password) {
      setError("Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }
    if (normalizedPhone.length < 8) {
      setError("Số điện thoại không hợp lệ");
      return;
    }
    if (formData.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);
    setError("");

    // Supabase Auth Sign Up
    const workerSpecialties = requestWorkerRole
      ? expandWorkerSpecialties(selectedParentIds, selectedChildValues, specialtyGroups)
      : [];
    const recoveryEmail = formData.recoveryEmail.trim().toLowerCase();
    const email = buildPhoneLoginEmail(normalizedPhone);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.name,
          phone: normalizedPhone,
          role: "customer",
          requested_role: requestWorkerRole ? "worker" : "customer",
          specialties: workerSpecialties,
          recovery_email: recoveryEmail || null,
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
          phone: normalizedPhone,
          address: formData.address,
          gps_location: formData.gpsLocation,
          latitude: formData.gpsLocation?.lat || null,
          longitude: formData.gpsLocation?.lng || null,
          last_location_at: formData.gpsLocation?.captured_at || null,
          location_updated_at: formData.gpsLocation?.captured_at || null,
          location_updated_by: formData.gpsLocation ? "register" : null,
          recovery_email: recoveryEmail || null
        })
        .eq('id', data.user.id);

      if (requestWorkerRole && workerSpecialties.length > 0) {
        await supabase
          .from('workers')
          .update({
            specialties: workerSpecialties
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
            {requestWorkerRole ? "Đã tạo tài khoản và gửi hồ sơ thợ!" : "Đăng ký thành công!"}
          </h1>
          <p className="mb-8 leading-relaxed text-on-surface-variant">
            {requestWorkerRole
              ? "Tài khoản mới của bạn mặc định là khách hàng. Hồ sơ thợ đã được gửi và đang chờ admin duyệt."
              : "Tài khoản khách hàng của bạn đã được tạo. Bạn có thể đăng nhập bằng số điện thoại và mật khẩu."}
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
            {requestWorkerRole ? (
              <>
                Một tài khoản,{" "}
                <span className="text-secondary-container">nhiều vai trò</span>
              </>
            ) : (
              <>
                Tìm thợ giỏi{" "}
                <span className="text-secondary-container">dễ dàng</span>
              </>
            )}
          </h2>
          <p className="text-lg text-white/80 w-full max-w-[400px] leading-relaxed">
            {requestWorkerRole
              ? `Đăng ký bằng số điện thoại, dùng được vai trò khách hàng ngay và chờ duyệt hồ sơ thợ trên ${settings.app_name}.`
              : "Đăng ký bằng số điện thoại để đặt dịch vụ sửa chữa tại nhà nhanh chóng và tiện lợi."}
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

            <div className="mb-7 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                  <UserIcon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-on-surface">Tài khoản khách hàng</p>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    Tài khoản mới luôn được tạo là khách hàng trước, đăng nhập bằng số điện thoại và mật khẩu.
                  </p>
                </div>
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-3 text-sm font-bold text-on-surface shadow-sm">
                <input
                  type="checkbox"
                  checked={requestWorkerRole}
                  onChange={(event) => setRequestWorkerRole(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <WrenchIcon size={18} />
                Tôi muốn đăng ký thêm vai trò thợ
              </label>
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
                    Email khôi phục tài khoản (không bắt buộc)
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    value={formData.recoveryEmail}
                    onChange={(e) => setFormData((p) => ({ ...p, recoveryEmail: e.target.value }))}
                    className="input-field py-3.5"
                    placeholder="email@example.com"
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
                    Số điện thoại <span className="text-error">*</span>
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
                            {requestWorkerRole ? "Định vị thợ" : "Định vị khách hàng"}
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">
                            {requestWorkerRole
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
                {requestWorkerRole && (
                  <div>
                    <label className="block text-sm font-semibold text-on-surface mb-3">
                      Chuyên môn <span className="text-error">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {specialtyGroups.map((group) => {
                        const isParentSelected = selectedParentIds.includes(group.id);
                        const selectedChildrenCount = group.children.filter(child => selectedChildValues.includes(child.value)).length;

                        return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => toggleParentSpecialty(group)}
                          className={`min-h-14 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${isParentSelected
                              ? "bg-primary border-primary text-white shadow-sm font-semibold"
                              : "bg-surface-container-low border-transparent text-on-surface-variant hover:border-primary/30"
                            }`}
                        >
                          <span className="block font-extrabold">{isParentSelected ? "✓ " : ""}{group.label}</span>
                          <span className={`mt-0.5 block text-[11px] ${isParentSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                            {selectedChildrenCount > 0 ? `${selectedChildrenCount} kỹ năng` : `${group.children.length} kỹ năng`}
                          </span>
                        </button>
                      );
                      })}
                    </div>

                    {selectedParentIds.length > 0 && (
                      <div className="mt-3 space-y-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3">
                        {specialtyGroups
                          .filter(group => selectedParentIds.includes(group.id))
                          .map(group => (
                            <div key={`children-${group.id}`} className="space-y-2">
                              <p className="text-xs font-extrabold uppercase text-on-surface-variant">{group.label}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {group.children.map(child => {
                                  const isSelected = selectedChildValues.includes(child.value);
                                  return (
                                    <button
                                      key={child.id}
                                      type="button"
                                      onClick={() => toggleChildSpecialty(group, child.value)}
                                      className={`min-h-10 rounded-lg border px-3 py-2 text-left text-xs font-bold transition-all ${
                                        isSelected
                                          ? "border-secondary-container bg-secondary-container text-white"
                                          : "border-outline-variant/50 bg-white text-on-surface-variant hover:border-secondary-container/50"
                                      }`}
                                    >
                                      {isSelected ? "✓ " : ""}{child.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {selectedSpecialties.length > 0 && (
                      <div className="mt-3 rounded-xl bg-primary-fixed/70 p-3 text-xs font-semibold text-primary-container">
                        Đã chọn: {selectedSpecialties.join(", ")}
                      </div>
                    )}
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
