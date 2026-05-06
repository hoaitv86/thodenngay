"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LogoIcon,
  UserIcon,
  WrenchIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from "../components/icons";

type UserRole = "customer" | "worker";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "worker" ? "worker" : "customer";

  const [role, setRole] = useState<UserRole>(initialRole);
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    specialties: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const specialtyOptions = [
    "Điện dân dụng",
    "Điện công nghiệp",
    "Ống nước",
    "Camera an ninh",
    "Cơ khí",
    "Điều hòa",
    "Sơn nhà",
    "Mộc",
  ];

  const toggleSpecialty = (sp: string) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(sp)
        ? prev.specialties.filter((s) => s !== sp)
        : [...prev.specialties, sp],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Vui lòng nhập họ tên");
      return;
    }
    if (!formData.phone || formData.phone.length < 9) {
      setError("Vui lòng nhập số điện thoại hợp lệ");
      return;
    }
    if (role === "worker" && formData.specialties.length === 0) {
      setError("Vui lòng chọn ít nhất 1 chuyên môn");
      return;
    }

    setLoading(true);
    setError("");

    // Simulate sending OTP
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setStep("otp");
  };

  const handleOtpChange = (idx: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[idx] = value;
    setOtp(newOtp);

    if (value && idx < 5) {
      const next = document.getElementById(`otp-${idx + 1}`);
      next?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      const prev = document.getElementById(`otp-${idx - 1}`);
      prev?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Vui lòng nhập đủ 6 số OTP");
      return;
    }
    
    if (code !== "000000") {
      setError("Mã OTP không đúng. Thử với 000000");
      return;
    }

    setLoading(true);
    setError("");

    // Simulate final registration
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-success-container flex items-center justify-center mx-auto mb-6 text-success">
            <CheckCircleIcon size={40} />
          </div>
          <h1 className="text-headline-lg text-on-surface mb-3">
            {role === "customer" ? "Đăng ký thành công!" : "Đã gửi yêu cầu!"}
          </h1>
          <p className="text-body-md text-on-surface-variant mb-8">
            {role === "customer"
              ? "Tài khoản của bạn đã được tạo. Bạn có thể đăng nhập và bắt đầu đặt dịch vụ."
              : "Yêu cầu đăng ký thợ đã được gửi. Admin sẽ duyệt trong 24h. Bạn sẽ nhận được thông báo qua SMS."}
          </p>
          <Link href="/login" className="btn-primary !py-3.5">
            Đăng nhập ngay
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#003178] via-[#0d47a1] to-[#1565c0] text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-[#fd6c00] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <LogoIcon size={40} />
            <span className="text-2xl font-bold">Alo Thợ</span>
          </Link>
        </div>

        <div className="relative z-10">
          <h2 className="text-headline-lg mb-4 text-white font-bold">
            {role === "customer" ? (
              <>
                Tìm thợ giỏi{" "}
                <span className="text-[#fd6c00]">dễ dàng</span>
              </>
            ) : (
              <>
                Nhận việc{" "}
                <span className="text-[#fd6c00]">mỗi ngày</span>
              </>
            )}
          </h2>
          <p className="text-lg text-white/80 w-full max-w-[400px] leading-relaxed">
            {role === "customer"
              ? "Đăng ký tài khoản để đặt dịch vụ sửa chữa tại nhà nhanh chóng và tiện lợi."
              : "Đăng ký làm thợ trên Alo Thợ để tiếp cận hàng ngàn khách hàng tiềm năng."}
          </p>
        </div>

        <div className="relative z-10 text-label-sm text-white/40">
          © 2026 Alo Thợ. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="flex-1 w-full flex items-center justify-center p-6 bg-[#f9f9fc] overflow-y-auto">
        <div className="w-full max-w-[500px] mx-auto py-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <LogoIcon size={36} color="#003178" />
            <span className="text-2xl font-bold text-[#003178]">Alo Thợ</span>
          </div>

          <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-[0_20px_50px_rgba(0,49,120,0.05)] border border-slate-100">
            {step === "form" ? (
              <>
                <div className="mb-8 text-center sm:text-left">
                  <h1 className="text-3xl font-bold text-[#1a1c1e] mb-2">Đăng ký</h1>
                  <p className="text-[#434652]">Tạo tài khoản mới để bắt đầu sử dụng</p>
                </div>

                {/* Role Toggle */}
                <div className="flex p-1.5 bg-[#f3f3f6] rounded-xl mb-8">
                  <button
                    type="button"
                    onClick={() => setRole("customer")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                      role === "customer"
                        ? "bg-white text-[#003178] shadow-sm"
                        : "text-[#434652] hover:text-[#1a1c1e]"
                    }`}
                    id="role-customer"
                  >
                    <UserIcon size={18} />
                    Khách hàng
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("worker")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                      role === "worker"
                        ? "bg-white text-[#003178] shadow-sm"
                        : "text-[#434652] hover:text-[#1a1c1e]"
                    }`}
                    id="role-worker"
                  >
                    <WrenchIcon size={18} />
                    Đăng ký thợ
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name-input" className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                      Họ và tên
                    </label>
                    <input
                      id="name-input"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                      placeholder="Nguyễn Văn A"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-phone" className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                      Số điện thoại
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#434652] flex items-center gap-1.5 text-base">
                        <span className="text-lg">🇻🇳</span>
                        <span className="font-medium">+84</span>
                      </span>
                      <input
                        id="reg-phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            phone: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        className="w-full pl-20 pr-4 py-3.5 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                        placeholder="912 345 678"
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="address-input" className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                      Địa chỉ
                    </label>
                    <input
                      id="address-input"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                      placeholder="123 Nguyễn Huệ, Q.1, TP.HCM"
                    />
                  </div>

                  {/* Worker Specialties */}
                  {role === "worker" && (
                    <div>
                      <label className="block text-sm font-semibold text-[#1a1c1e] mb-3">
                        Chuyên môn <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {specialtyOptions.map((sp) => (
                          <button
                            key={sp}
                            type="button"
                            onClick={() => toggleSpecialty(sp)}
                            className={`px-4 py-2.5 rounded-xl text-sm transition-all border ${
                              formData.specialties.includes(sp)
                                ? "bg-[#003178] border-[#003178] text-white shadow-md font-semibold"
                                : "bg-[#f3f3f6] border-transparent text-[#434652] hover:border-[#003178]/30"
                            }`}
                          >
                            {formData.specialties.includes(sp) && "✓ "}
                            {sp}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="text-[#ba1a1a] text-sm flex items-center gap-2 bg-[#ffdad6] p-3 rounded-lg">
                      <span>⚠</span> {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-4 bg-[#003178] hover:bg-[#00255a] text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98] flex items-center justify-center gap-2 group"
                    disabled={loading}
                    id="register-submit"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang xử lý...
                      </span>
                    ) : (
                      <>
                        Tiếp tục
                        <ArrowRightIcon size={20} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setStep("form");
                    setOtp(["", "", "", "", "", ""]);
                    setError("");
                  }}
                  className="text-sm text-[#0d47a1] font-medium hover:underline mb-8 flex items-center gap-1 group"
                >
                  <span className="group-hover:-translate-x-1 transition-transform">←</span> Quay lại
                </button>

                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-[#1a1c1e] mb-2">Xác thực</h1>
                  <p className="text-[#434652]">
                    Mã OTP đã gửi đến <span className="font-bold text-[#1a1c1e]">+84 {formData.phone}</span>
                  </p>
                </div>

                <form onSubmit={handleOtpSubmit} className="space-y-8">
                  <div className="flex gap-2 sm:gap-3 justify-center">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`otp-${idx}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-10 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  {error && (
                    <div className="text-[#ba1a1a] text-sm text-center flex items-center justify-center gap-2 bg-[#ffdad6] p-3 rounded-lg">
                      <span>⚠</span> {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-4 bg-[#003178] hover:bg-[#00255a] text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98] flex items-center justify-center gap-2 group"
                    disabled={loading}
                    id="otp-submit"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang xác nhận...
                      </span>
                    ) : (
                      <>
                        Hoàn tất đăng ký
                        <ArrowRightIcon size={20} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-sm text-[#434652]">
                    Không nhận được mã?{" "}
                    <button
                      type="button"
                      className="text-[#0d47a1] font-bold hover:underline"
                    >
                      Gửi lại mã
                    </button>
                  </p>
                </form>
              </>
            )}

            <div className="mt-8 pt-8 border-t border-slate-100 text-center">
              <p className="text-sm text-[#434652]">
                Đã có tài khoản?{" "}
                <Link
                  href="/login"
                  className="text-[#0d47a1] font-bold hover:underline"
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
