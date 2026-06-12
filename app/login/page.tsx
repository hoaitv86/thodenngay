"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/settings";
import { LogoIcon, ArrowRightIcon, ShieldCheckIcon, UserIcon } from "../components/icons";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const { settings } = useSettings();
  const showDemoAccounts = process.env.NODE_ENV !== "production";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) {
      setError("Vui lòng nhập đầy đủ tài khoản và mật khẩu");
      return;
    }
    setLoading(true);
    setError("");

    let email = loginId.trim();
    if (!email.includes("@")) {
      const res = await fetch("/api/auth/resolve-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Không tìm thấy tài khoản theo SĐT này.");
        setLoading(false);
        return;
      }

      email = data.email;
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message === "Email not confirmed" || authError.code === "email_not_confirmed") {
        setError("Tài khoản chưa được xác thực. Vui lòng kiểm tra hòm thư email của bạn.");
      } else if (authError.message === "Invalid login credentials") {
        setError("Tài khoản hoặc mật khẩu không chính xác.");
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
    <div className="auth-shell flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="auth-brand-panel p-12">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_20%)] opacity-10" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <LogoIcon size={40} />
            <span className="text-2xl font-bold">{settings.app_name}</span>
          </Link>
        </div>

        <div className="relative z-10">
          <h2 className="text-3xl mb-4 text-white font-bold">
            Dịch vụ sửa chữa{" "}
            <span className="text-secondary-container">chuyên nghiệp</span>
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
          © 2026 {settings.app_name}. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex w-full flex-1 items-center justify-center bg-white p-4 sm:p-6">
        <div className="w-full max-w-[440px] mx-auto py-6 sm:py-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <LogoIcon size={36} />
            <span className="text-2xl font-bold text-primary">{settings.app_name}</span>
          </div>

          <div className="auth-card">
            <div className="mb-7 text-center sm:text-left">
              <h1 className="mb-2 text-2xl font-bold text-on-surface sm:text-3xl">Đăng nhập</h1>
              <p className="text-on-surface-variant">Chào mừng bạn trở lại với {settings.app_name}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
              <div>
                <label htmlFor="login-id" className="block text-sm font-semibold text-on-surface mb-2">
                  Email hoặc SĐT
                </label>
                <input
                  id="login-id"
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="input-field py-4"
                  placeholder="name@example.com hoặc 0912345678"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-semibold text-on-surface mb-2">
                  Mật khẩu
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field py-4"
                  placeholder="••••••••"
                />
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
              <p className="text-sm text-on-surface-variant">
                Chưa có tài khoản?{" "}
                <Link
                  href="/register"
                  className="font-bold text-primary-container hover:underline"
                >
                  Đăng ký ngay
                </Link>
              </p>
            </div>

            {showDemoAccounts && (
              <div className="mt-8 rounded-lg border border-primary-fixed bg-primary-fixed/35 p-4 text-left">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Tài khoản dùng thử (Pass: 123456)</p>
                <div className="grid grid-cols-1 gap-2 text-xs text-on-surface-variant">
                  <div className="grid gap-1 sm:flex sm:justify-between">
                    <span>Admin:</span>
                    <span className="break-all font-mono font-bold">admin@alotho.local</span>
                  </div>
                  <div className="grid gap-1 sm:flex sm:justify-between">
                    <span>Thợ:</span>
                    <span className="break-all font-mono font-bold">worker@alotho.local</span>
                  </div>
                  <div className="grid gap-1 sm:flex sm:justify-between">
                    <span>Khách:</span>
                    <span className="break-all font-mono font-bold">customer@alotho.local</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
