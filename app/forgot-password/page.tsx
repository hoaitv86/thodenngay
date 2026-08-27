"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, ChevronLeftIcon, LogoIcon, MailIcon, PhoneIcon } from "../components/icons";
import { useSettings } from "@/lib/settings";

export default function ForgotPasswordPage() {
  const { settings } = useSettings();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMaskedEmail("");

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Không thể gửi email đặt lại mật khẩu.");
      setLoading(false);
      return;
    }

    setMaskedEmail(data.maskedEmail || "email đã đăng ký");
    setLoading(false);
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
          <h2 className="mb-4 text-3xl font-bold text-white">Khôi phục tài khoản</h2>
          <p className="w-full max-w-[400px] text-lg leading-relaxed text-white/80">
            Nhập số điện thoại đã đăng ký, hệ thống sẽ gửi hướng dẫn tới email thật đang lưu trong hồ sơ.
          </p>
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
                <MailIcon size={28} />
              </div>
              <h1 className="mb-2 text-2xl font-bold text-on-surface sm:text-3xl">Quên mật khẩu</h1>
              <p className="text-on-surface-variant">Chúng tôi sẽ gửi email đặt lại mật khẩu nếu tài khoản có email khôi phục.</p>
            </div>

            {maskedEmail ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-success/20 bg-success-container p-4 text-success">
                  <p className="font-extrabold">Đã gửi email!</p>
                  <p className="mt-1 text-sm leading-6">Vui lòng kiểm tra {maskedEmail}, bao gồm cả thư rác/spam.</p>
                </div>
                <button type="button" className="btn-outline w-full !justify-center !py-3" onClick={() => setMaskedEmail("")}>Gửi lại với SĐT khác</button>
                <Link href="/login" className="btn-primary flex w-full items-center justify-center gap-2 !py-4">Quay lại đăng nhập</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                <div>
                  <label htmlFor="forgot-phone" className="mb-2 block text-sm font-semibold text-on-surface">Số điện thoại</label>
                  <div className="relative">
                    <PhoneIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      id="forgot-phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="input-field py-4 pl-11"
                      placeholder="0912345678"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex gap-2 rounded-lg bg-error-container p-3 text-sm text-error" role="alert">
                    <span aria-hidden="true">!</span> {error}
                  </div>
                )}

                <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-sm leading-6 text-on-surface-variant">
                  Nếu tài khoản chưa có email thật, vui lòng liên hệ hỗ trợ để xác minh và đặt lại mật khẩu.
                </div>

                <button type="submit" className="btn-primary w-full py-4 group" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2"><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Đang gửi...</span>
                  ) : (
                    <>Tiếp tục<ArrowRightIcon size={20} className="transition-transform group-hover:translate-x-1" /></>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
