"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import {
  BriefcaseIcon,
  CalendarIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SearchIcon,
  UserIcon,
  WrenchIcon,
} from "@/app/components/icons";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/customer/home", label: "Trang chủ", icon: LayoutDashboardIcon },
  { href: "/customer/booking", label: "Đặt lịch", icon: SearchIcon },
  { href: "/customer/jobs", label: "Đơn của tôi", icon: BriefcaseIcon },
  { href: "/customer/chat", label: "Chat", icon: MessageCircle },
  { href: "/customer/profile", label: "Tài khoản", icon: UserIcon },
];

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userName, setUserName] = useState("Khách hàng");

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile?.full_name) setUserName(profile.full_name);
    };

    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const currentItem = navItems.find((item) => pathname.startsWith(item.href));
  const pageLabel = currentItem?.label || "Khách hàng";
  const isProfilePage = pathname === "/customer/profile";

  return (
    <div className="min-h-dvh w-full bg-linear-to-b from-primary-fixed via-surface to-secondary-fixed/35 lg:flex">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-primary-container/10 lg:bg-linear-to-b lg:from-primary lg:via-primary-container lg:to-secondary-container lg:text-white">
        <div className="border-b border-white/12 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/14 text-white shadow-sm ring-1 ring-white/18">
              <WrenchIcon size={23} />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight text-white">{userName}</span>
              <span className="mt-1 block text-xs font-bold uppercase text-white/65">Khách hàng Alo Thợ</span>
            </div>
          </div>

          <Link
            href="/customer/booking"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary-container px-4 py-3 text-sm font-bold text-white shadow-[0_12px_26px_rgba(37,99,235,0.24)] transition-all hover:bg-primary active:scale-[0.98]"
          >
            <CalendarIcon size={17} />
            Đặt dịch vụ mới
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition-all ${
                  isActive
                    ? "bg-white text-primary-container shadow-sm"
                    : "text-white/72 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/12 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOutIcon size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh w-full flex-col lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/45 bg-white/72 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between px-4 lg:h-20 lg:max-w-6xl lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary-container to-secondary-container text-white shadow-sm lg:hidden">
                <WrenchIcon size={19} />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold text-on-surface-variant lg:text-xs lg:uppercase">
                  Xin chào, {userName}
                </span>
                <span className="mt-0.5 block truncate text-lg font-bold leading-tight text-primary-container">
                  {pageLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/customer/booking"
                className="hidden items-center gap-2 rounded-lg bg-secondary-container px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary active:scale-[0.98] sm:inline-flex"
              >
                <CalendarIcon size={16} />
                Đặt lịch
              </Link>
              <button
                onClick={handleLogout}
                aria-label="Đăng xuất"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/70 bg-white/70 text-on-surface-variant shadow-sm transition-colors hover:border-error/30 hover:bg-error-container hover:text-error"
                title="Đăng xuất"
              >
                <LogOutIcon size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8 ${isProfilePage ? "customer-profile-shell" : ""}`}>
          {children}
        </main>

        <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-white/55 bg-white/82 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_28px_rgba(15,35,66,0.1)] backdrop-blur-xl lg:hidden">
          <div className="grid h-[4.5rem] grid-cols-5 gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 transition-all ${
                    isActive
                      ? "bg-primary-container text-white shadow-sm"
                      : "text-on-surface-variant hover:bg-primary-fixed hover:text-primary-container"
                  }`}
                >
                  <item.icon size={21} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="max-w-full truncate text-[10px] font-bold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
