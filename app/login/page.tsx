"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoIcon, PhoneIcon, ArrowRightIcon, ShieldCheckIcon } from "../components/icons";

type Step = "phone" | "otp";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      setError("Vui lòng nhập số điện thoại hợp lệ");
      return;
    }
    setLoading(true);
    setError("");

    // Simulate OTP send – replace with Supabase auth.signInWithOtp
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setStep("otp");
  };

  const handleOtpChange = (idx: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[idx] = value;
    setOtp(newOtp);

    // Auto-focus next input
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
    setLoading(true);
    setError("");

    // Master OTP check
    if (code !== "000000") {
      setError("Mã OTP không chính xác. Thử lại với 000000");
      setLoading(false);
      return;
    }

    // Simulate verify delay
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);

    // Seeded users redirection logic - checking last 9 digits for robustness
    const suffix = phone.slice(-9);

    if (suffix === "900000001") {
      router.replace("/admin");
    } else if (suffix === "900000002") {
      router.replace("/worker");
    } else if (suffix === "900000003") {
      router.replace("/dashboard");
    } else {
      router.replace("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#003178] via-[#0d47a1] to-[#1565c0] text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Background elements */}
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
            Dịch vụ sửa chữa{" "}
            <span className="text-[#fd6c00]">chuyên nghiệp</span>
          </h2>
          <p className="text-lg text-white/80 w-full max-w-[400px] leading-relaxed">
            Đăng nhập để đặt dịch vụ, theo dõi công việc và quản lý tài khoản của bạn.
          </p>

          <div className="flex flex-wrap items-center gap-6 mt-10 text-white/60">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon size={18} />
              <span className="text-label-sm">Bảo mật OTP</span>
            </div>
            <div className="flex items-center gap-2">
              <PhoneIcon size={18} />
              <span className="text-label-sm">Đăng nhập bằng SĐT</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-label-sm text-white/40">
          © 2026 Alo Thợ. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 w-full flex items-center justify-center p-6 bg-[#f9f9fc]">
        <div className="w-full max-w-[440px] mx-auto py-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <LogoIcon size={36} />
            <span className="text-2xl font-bold text-[#003178]">Alo Thợ</span>
          </div>

          <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-[0_20px_50px_rgba(0,49,120,0.05)] border border-slate-100">
            {step === "phone" ? (
              <>
                <div className="mb-8 text-center sm:text-left">
                  <h1 className="text-3xl font-bold text-[#1a1c1e] mb-2">Đăng nhập</h1>
                  <p className="text-[#434652]">Chào mừng bạn trở lại với Alo Thợ</p>
                </div>

                <form onSubmit={handlePhoneSubmit} className="space-y-6">
                  <div>
                    <label
                      htmlFor="phone-input"
                      className="block text-sm font-semibold text-[#1a1c1e] mb-2"
                    >
                      Số điện thoại
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#434652] flex items-center gap-2 text-base">
                        <span className="text-lg">🇻🇳</span>
                        <span className="font-medium">+84</span>
                      </span>
                      <input
                        id="phone-input"
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value.replace(/\D/g, ""));
                          setError("");
                        }}
                        className="w-full pl-20 pr-4 py-4 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e] text-lg font-medium"
                        placeholder="912 345 678"
                        maxLength={10}
                        autoFocus
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="text-[#ba1a1a] text-sm flex items-center gap-2 bg-[#ffdad6] p-3 rounded-lg">
                      <span>⚠</span> {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-4 bg-[#003178] hover:bg-[#00255a] text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98] flex items-center justify-center gap-2 group"
                    disabled={loading}
                    id="login-submit"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang gửi mã...
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
                    setStep("phone");
                    setOtp(["", "", "", "", "", ""]);
                    setError("");
                  }}
                  className="text-sm text-[#0d47a1] font-medium hover:underline mb-8 flex items-center gap-1 group"
                >
                  <span className="group-hover:-translate-x-1 transition-transform">←</span> Đổi số điện thoại
                </button>

                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-[#1a1c1e] mb-2">Xác thực</h1>
                  <p className="text-[#434652]">
                    Mã OTP đã gửi đến <span className="font-bold text-[#1a1c1e]">+84 {phone}</span>
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
                        Xác nhận
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

            <div className="mt-8 text-center">
              <p className="text-sm text-[#434652]">
                Chưa có tài khoản?{" "}
                <Link
                  href="/register"
                  className="text-[#0d47a1] font-bold hover:underline"
                >
                  Đăng ký ngay
                </Link>
              </p>
            </div>

            {/* Demo Accounts Info */}
            <div className="mt-10 p-4 bg-blue-50 border border-blue-100 rounded-xl text-left">
              <p className="text-xs font-bold text-[#003178] uppercase tracking-wider mb-2">Tài khoản dùng thử (OTP: 000000)</p>
              <div className="grid grid-cols-1 gap-2 text-xs text-[#434652]">
                <div className="flex justify-between">
                  <span>Quản trị (Admin):</span>
                  <span className="font-mono font-bold">0900000001</span>
                </div>
                <div className="flex justify-between">
                  <span>Thợ (Worker):</span>
                  <span className="font-mono font-bold">0900000002</span>
                </div>
                <div className="flex justify-between">
                  <span>Khách (Customer):</span>
                  <span className="font-mono font-bold">0900000003</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
