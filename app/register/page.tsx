"use client";

import { useState, useEffect, Suspense } from "react";
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

import { createClient } from "@/lib/supabase/client";

function RegisterContent() {

  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "worker" ? "worker" : "customer";

  const [role, setRole] = useState<UserRole>(initialRole);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    specialties: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
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
          address: formData.address
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
      <div className="min-h-screen flex items-center justify-center bg-[#f9f9fc] p-6">
        <div className="max-w-md text-center bg-white p-10 rounded-2xl shadow-xl border border-slate-100">
          <div className="w-20 h-20 rounded-full bg-[#e8f5e9] flex items-center justify-center mx-auto mb-6 text-[#2e7d32]">
            <CheckCircleIcon size={40} />
          </div>
          <h1 className="text-3xl font-bold text-[#1a1c1e] mb-3">
            {role === "customer" ? "Đăng ký thành công!" : "Đã gửi yêu cầu!"}
          </h1>
          <p className="text-[#434652] mb-8 leading-relaxed">
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
          <h2 className="text-lg mb-4 text-white font-bold">
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
            <LogoIcon size={36} />
            <span className="text-2xl font-bold text-[#003178]">Alo Thợ</span>
          </div>

          <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-[0_20px_50px_rgba(0,49,120,0.05)] border border-slate-100">
            <div className="mb-8 text-center sm:text-left">
              <h1 className="text-3xl font-bold text-[#1a1c1e] mb-2">Đăng ký</h1>
              <p className="text-[#434652]">Tạo tài khoản mới để bắt đầu sử dụng</p>
            </div>

            {/* Role Toggle */}
            <div className="flex p-1.5 bg-[#f3f3f6] rounded-xl mb-8">
              <button
                type="button"
                onClick={() => setRole("customer")}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-lg text-sm font-semibold transition-all ${role === "customer"
                    ? "bg-white text-[#003178] shadow-sm"
                    : "text-[#434652] hover:text-[#1a1c1e]"
                  }`}
              >
                <UserIcon size={18} />
                Khách hàng
              </button>
              <button
                type="button"
                onClick={() => setRole("worker")}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-lg text-sm font-semibold transition-all ${role === "worker"
                    ? "bg-white text-[#003178] shadow-sm"
                    : "text-[#434652] hover:text-[#1a1c1e]"
                  }`}
              >
                <WrenchIcon size={18} />
                Đăng ký thợ
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                    placeholder="Nguyễn Văn A"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                    placeholder="name@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                    Số điện thoại (tùy chọn)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                    placeholder="0912345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                    Địa chỉ (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                    placeholder="Q.1, TP.HCM"
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
                          className={`px-4 py-2.5 rounded-xl text-sm transition-all border ${formData.specialties.includes(sp)
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface">Đang tải...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
