"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon, CheckCircleIcon, ChevronLeftIcon, LogoIcon, ShieldCheckIcon } from "../components/icons";
import { createClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/settings";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { settings } = useSettings();
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const prepareRecoverySession = async () => {
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (error) {
          setSessionError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
          return;
        }
        setReady(true);
        return;
      }

      if (typeof window !== "undefined") {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (!mounted) return;
          if (error) {
            setSessionError("Không thể xác thực phiên đặt lại mật khẩu.");
            return;
          }
          window.history.replaceState(null, "", window.location.pathname);
          setReady(true);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setReady(true);
      } else {
        setSessionError("Vui lòng mở trang này từ email đặt lại mật khẩu.");
      }
    };

    void prepareRecoverySession();
    return () => {
      mounted = false;
    };
  }, [searchParams, supabase.auth]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (password.length < 6) {
      setSessionError("Mật khẩu mới phải có tối thiểu 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setSessionError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSaving(true);
    setSessionError("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setSessionError(error.message || "Không thể cập nhật mật khẩu.");
      return;
    }

    setMessage("Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng SĐT và mật khẩu mới.");
    window.setTimeout(() => router.replace("/login"), 1200);
  };

  return (
    <div className="auth-shell flex flex-col lg:flex-row">
      <div className="auth-brand-panel p-12">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_20%)] opacity-10" />
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <LogoIcon size={40} />
            <span className="text-2xl font-bold">{settings.app_name}</span>
          </Link>
        </div>
        <div className="relative z-10">
          <h2 className="mb-4 text-3xl font-bold text-white">Đặt mật khẩu mới</h2>
          <p className="w-full max-w-[400px] text-lg leading-relaxed text-white/80">Tạo mật khẩu mới cho tài khoản của bạn mà không thay đổi email Auth hay tạo tài khoản mới.</p>
        </div>
        <div className="relative z-10 text-label-sm text-white/40">© 2026 {settings.app_name}. All rights reserved.</div>
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-white p-4 sm:p-6">
        <div className="w-full max-w-[440px] py-6 sm:py-8">
          <div className="lg:hidden mb-6 flex items-center gap-3">
            <LogoIcon size={36} />
            <span className="text-2xl font-bold text-primary">{settings.app_name}</span>
          </div>

          <div className="auth-card">
            <Link href="/login" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-primary-container hover:underline">
              <ChevronLeftIcon size={16} />
              Quay lại đăng nhập
            </Link>

            <div className="mb-7 text-center sm:text-left">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
                <ShieldCheckIcon size={28} />
              </div>
              <h1 className="mb-2 text-2xl font-bold text-on-surface sm:text-3xl">Đặt mật khẩu mới</h1>
              <p className="text-on-surface-variant">Mật khẩu mới cần có tối thiểu 6 ký tự.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div>
                <label htmlFor="reset-password" className="mb-2 block text-sm font-semibold text-on-surface">Mật khẩu mới</label>
                <input id="reset-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input-field py-4" placeholder="••••••••" disabled={!ready || saving} />
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className="mb-2 block text-sm font-semibold text-on-surface">Nhập lại mật khẩu mới</label>
                <input id="reset-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="input-field py-4" placeholder="••••••••" disabled={!ready || saving} />
              </div>

              {sessionError && (
                <div className="flex gap-2 rounded-lg bg-error-container p-3 text-sm text-error" role="alert">
                  <span aria-hidden="true">!</span> {sessionError}
                </div>
              )}

              {message && (
                <div className="flex items-center gap-2 rounded-lg bg-success-container p-3 text-sm font-bold text-success" role="status">
                  <CheckCircleIcon size={18} /> {message}
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-4 group" disabled={!ready || saving}>
                {saving ? (
                  <span className="flex items-center gap-2"><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Đang cập nhật...</span>
                ) : (
                  <>Cập nhật mật khẩu<ArrowRightIcon size={20} className="transition-transform group-hover:translate-x-1" /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-surface">Đang tải...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
