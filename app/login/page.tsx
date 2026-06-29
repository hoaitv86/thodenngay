"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/settings";
import {
  LogoIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  UserIcon,
  WrenchIcon,
  ClockIcon,
  MapPinIcon,
  StarIcon,
} from "../components/icons";

const serviceTickets = [
  {
    icon: WrenchIcon,
    title: "Sửa điện",
    meta: "Quận 7 - chờ nhận việc",
    tone: "bg-secondary-container",
  },
  {
    icon: MapPinIcon,
    title: "Thay vòi nước",
    meta: "Bình Thạnh - đã gán thợ",
    tone: "bg-teal-600",
  },
  {
    icon: StarIcon,
    title: "Bảo trì máy lạnh",
    meta: "Thủ Đức - khách đánh giá 5 sao",
    tone: "bg-amber-500",
  },
];

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
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        console.error("Profile fetch error:", profileError);
        setError("Không tìm thấy hồ sơ người dùng. Vui lòng kiểm tra lại database.");
        setLoading(false);
        return;
      }

      if (profile.role === "admin") router.replace("/admin/dashboard");
      else if (profile.role === "worker") router.replace("/worker");
      else router.replace("/customer/home");
    }

    setLoading(false);
  };

  return (
    <div className="auth-shell flex min-h-screen flex-col bg-[#13201e] lg:flex-row">
      <div className="auth-brand-panel p-8 sm:p-10 lg:p-12">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_26%),linear-gradient(0deg,rgba(232,102,36,0.18),transparent_42%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <LogoIcon size={40} />
            <span className="text-2xl font-bold">{settings.app_name}</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-[480px]">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
            <ClockIcon size={15} />
            Hỗ trợ đặt thợ và theo dõi tiến độ
          </div>
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Dịch vụ sửa chữa tại nhà, gọn gàng từ lúc đặt đến lúc hoàn tất.
          </h2>
          <p className="w-full max-w-[430px] text-base leading-relaxed text-white/80 sm:text-lg">
            Đăng nhập để đặt dịch vụ, nhận thợ phù hợp, theo dõi vị trí và quản lý lịch sử công việc của bạn.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container text-white">
                <WrenchIcon size={20} />
              </div>
              <p className="text-sm font-bold text-white">Nhiều nhóm dịch vụ</p>
              <p className="mt-1 text-xs leading-5 text-white/70">Điện, nước, máy lạnh, camera và các hạng mục tại nhà.</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
                <MapPinIcon size={20} />
              </div>
              <p className="text-sm font-bold text-white">Có định vị làm việc</p>
              <p className="mt-1 text-xs leading-5 text-white/70">Lưu vị trí khách và thợ khi được gán việc.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-5 text-white/70">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon size={18} />
              <span className="text-label-sm">Bảo mật tài khoản</span>
            </div>
            <div className="flex items-center gap-2">
              <UserIcon size={18} />
              <span className="text-label-sm">Dành cho khách, thợ và admin</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-label-sm text-white/40">
          © 2026 {settings.app_name}. All rights reserved.
        </div>
      </div>

      <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-[#15231f] p-4 sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(150deg,rgba(20,137,111,0.32),transparent_30%),linear-gradient(330deg,rgba(232,102,36,0.28),transparent_34%),linear-gradient(90deg,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.65)_1px,transparent_0)] [background-size:24px_24px]" />

        <div className="relative z-10 mx-auto grid w-full max-w-[980px] items-center gap-5 py-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="hidden text-white lg:block">
            <div className="mb-5 flex items-center gap-3">
              <LogoIcon size={36} />
              <span className="text-2xl font-bold">{settings.app_name}</span>
            </div>
            <div className="rounded-xl border border-white/15 bg-[#20312d]/80 p-5 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-white/60">Bảng điều phối hôm nay</p>
                  <p className="mt-1 text-lg font-bold text-white">3 việc đang sẵn sàng xử lý</p>
                </div>
                <div className="rounded-lg bg-secondary-container px-3 py-2 text-sm font-bold text-white">Live</div>
              </div>
              <div className="space-y-3">
                {serviceTickets.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.07] p-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.tone} text-white`}>
                        <Icon size={19} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{item.title}</p>
                        <p className="truncate text-xs text-white/60">{item.meta}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-full">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <LogoIcon size={36} />
              <span className="text-2xl font-bold text-white">{settings.app_name}</span>
            </div>

            <div
              className="rounded-xl border border-white/20 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur sm:p-8"
              style={{ backgroundColor: "#20312d" }}
            >
              <div className="mb-7 text-center sm:text-left">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-secondary-fixed">
                  <ShieldCheckIcon size={15} />
                  Đăng nhập an toàn
                </div>
                <h1 className="mb-2 text-2xl font-bold !text-white sm:text-3xl">Đăng nhập</h1>
                <p className="!text-white opacity-75">Chào mừng bạn trở lại với {settings.app_name}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
                <div>
                  <label htmlFor="login-id" className="mb-2 block text-sm font-semibold !text-white opacity-90">
                    Email hoặc SĐT
                  </label>
                  <input
                    id="login-id"
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="input-field !border-white/20 !bg-white/10 py-4 !text-white placeholder:!text-white/45 focus:!border-secondary-container"
                    placeholder="name@example.com hoặc 0912345678"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-2 block text-sm font-semibold !text-white opacity-90">
                    Mật khẩu
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field !border-white/20 !bg-white/10 py-4 !text-white placeholder:!text-white/45 focus:!border-secondary-container"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="flex gap-2 rounded-lg bg-error-container p-3 text-sm text-error" role="alert">
                    <span aria-hidden="true">!</span> {error}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full py-4 group" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Đang đăng nhập...
                    </span>
                  ) : (
                    <>
                      Đăng nhập
                      <ArrowRightIcon size={20} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-sm !text-white opacity-75">
                  Chưa có tài khoản?{" "}
                  <Link href="/register" className="font-bold text-secondary-fixed hover:underline">
                    Đăng ký ngay
                  </Link>
                </p>
              </div>

              {showDemoAccounts && (
                <div className="mt-8 rounded-lg border border-white/15 bg-white/10 p-4 text-left">
                  <p className="mb-2 text-xs font-bold uppercase text-secondary-fixed">Tài khoản dùng thử</p>
                  <div className="grid grid-cols-1 gap-2 text-xs !text-white opacity-75">
                    <div className="grid gap-1 sm:flex sm:justify-between">
                      <span>Admin:</span>
                      <span className="break-all font-mono font-bold text-white">admin@alotho.local / admin</span>
                    </div>
                    <div className="grid gap-1 sm:flex sm:justify-between">
                      <span>Thợ:</span>
                      <span className="break-all font-mono font-bold text-white">worker@alotho.local / 123456</span>
                    </div>
                    <div className="grid gap-1 sm:flex sm:justify-between">
                      <span>Khách:</span>
                      <span className="break-all font-mono font-bold text-white">customer@alotho.local / 123456</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
