"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LogoIcon,
  BriefcaseIcon,
  UserIcon,
  LayoutDashboardIcon,
  DollarSignIcon,
  BellIcon,
  LogOutIcon
} from "../components/icons";

const navItems = [
  { href: "/worker", label: "Việc làm", icon: LayoutDashboardIcon },
  { href: "/worker/history", label: "Lịch sử", icon: BriefcaseIcon },
  { href: "/worker/wallet", label: "Ví", icon: DollarSignIcon },
  { href: "/worker/profile", label: "Hồ sơ", icon: UserIcon },
];

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("Thợ");
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile) setUserName(profile.full_name);
      }
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-dvh w-full bg-surface lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-outline-variant/30 lg:bg-white">
        <div className="flex h-20 items-center gap-3 border-b border-outline-variant/20 px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#003178] shadow-lg shadow-blue-900/20">
            <LogoIcon size={26} />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-extrabold leading-tight text-[#003178]">{userName}</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-success">Online</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/worker" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-extrabold transition-all ${
                  isActive
                    ? "bg-primary-fixed text-primary-container shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                }`}
              >
                <item.icon size={20} className={isActive ? "stroke-[2.5px]" : ""} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-outline-variant/20 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-extrabold text-error transition-colors hover:bg-error-container"
          >
            <LogOutIcon size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh w-full flex-col lg:pl-64">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 glass h-16 flex items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003178] flex items-center justify-center shadow-lg shadow-blue-900/20 lg:hidden">
            <LogoIcon size={24} />
          </div>
          <div>
            <span className="block font-bold text-[#003178] leading-tight truncate max-w-[180px] lg:max-w-none lg:text-lg">Trang thợ</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-success uppercase tracking-wider">{userName} đang online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2.5 hover:bg-surface-container rounded-xl text-on-surface-variant relative transition-colors">
            <BellIcon size={22} />
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-error border-2 border-white rounded-full" />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 hover:bg-error-container hover:text-error rounded-lg text-on-surface-variant transition-colors border border-transparent hover:border-error/20"
            title="Đăng xuất"
          >
            <LogOutIcon size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-y-auto bg-surface pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8">
        <div className="w-full lg:mx-auto lg:max-w-6xl">
          {children}
        </div>
      </main>

      {/* Premium Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-outline-variant/30 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-4 h-20">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/worker" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-w-0 flex flex-col items-center justify-center gap-1.5 transition-all ${isActive
                  ? "text-[#003178]"
                  : "text-[#434652] hover:bg-slate-50"
                  }`}
              >
                <item.icon size={22} className={isActive ? "stroke-[2.5px]" : ""} />
                <span className={`max-w-full truncate text-[10px] font-bold uppercase tracking-wide ${isActive ? "opacity-100" : "opacity-60"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      </div>
    </div>
  );
}
