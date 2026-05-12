"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoIcon, PhoneIcon, ArrowRightIcon, ShieldCheckIcon, UserIcon } from "../components/icons";

type Step = "phone" | "otp";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu");
      return;
    }
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message === "Email not confirmed" || (authError as any).code === "email_not_confirmed") {
        setError("Tài khoản chưa được xác thực. Vui lòng kiểm tra hòm thư email của bạn.");
      } else if (authError.message === "Invalid login credentials") {
        setError("Email hoặc mật khẩu không chính xác.");
      } else {
        setError(authError.message || "Đã xảy ra lỗi khi đăng nhập.");
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      console.log("Fetching profile for user ID:", data.user.id);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        console.error("Profile fetch error:", profileError);
        setError("Không tìm thấy hồ sơ người dùng (Profiles). Vui lòng kiểm tra lại Database.");
        setLoading(false);
        return;
      }

      console.log("Found profile:", profile);

      if (profile.role === 'admin') router.replace("/admin");
      else if (profile.role === 'worker') router.replace("/worker");
      else router.replace("/dashboard");
    }

    setLoading(false);
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
              <span className="text-label-sm">Bảo mật SSL</span>
            </div>
            <div className="flex items-center gap-2">
              <UserIcon size={18} />
              <span className="text-label-sm">Đăng nhập tài khoản</span>
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
            <div className="mb-8 text-center sm:text-left">
              <h1 className="text-3xl font-bold text-[#1a1c1e] mb-2">Đăng nhập</h1>
              <p className="text-[#434652]">Chào mừng bạn trở lại với Alo Thợ</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-4 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                  placeholder="name@example.com"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1a1c1e] mb-2">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-4 bg-[#f3f3f6] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003178]/10 focus:border-[#003178] focus:bg-white transition-all text-[#1a1c1e]"
                  placeholder="••••••••"
                />
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
                    Đang đăng nhập...
                  </span>
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRightIcon size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

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
              <p className="text-xs font-bold text-[#003178] uppercase tracking-wider mb-2">Tài khoản dùng thử (Pass: 123456)</p>
              <div className="grid grid-cols-1 gap-2 text-xs text-[#434652]">
                <div className="flex justify-between">
                  <span>Admin:</span>
                  <span className="font-mono font-bold">admin@alotho.local</span>
                </div>
                <div className="flex justify-between">
                  <span>Thợ (Worker):</span>
                  <span className="font-mono font-bold">worker@alotho.local</span>
                </div>
                <div className="flex justify-between">
                  <span>Khách (Customer):</span>
                  <span className="font-mono font-bold">customer@alotho.local</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
