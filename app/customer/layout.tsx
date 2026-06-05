"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, ClipboardList, User, Wrench, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/customer/home", label: "Trang chủ", icon: Home },
  { href: "/customer/booking", label: "Đặt dịch vụ", icon: Search },
  { href: "/customer/jobs", label: "Đơn của tôi", icon: ClipboardList },
  { href: "/customer/profile", label: "Tài khoản", icon: User },
];

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userName, setUserName] = useState("Khách");

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
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-outline-variant/30 lg:bg-white">
        <div className="flex h-20 items-center gap-3 border-b border-outline-variant/20 px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-container shadow-sm">
            <Wrench className="h-5 w-5 text-on-primary" />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-extrabold leading-tight text-primary">{userName}</span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Khách hàng</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-extrabold transition-all ${
                  isActive
                    ? "bg-primary-fixed text-primary-container shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-outline-variant/20 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-extrabold text-error transition-colors hover:bg-error-container"
          >
            <LogOut className="h-5 w-5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh w-full flex-col lg:pl-64">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-outline-variant/20 bg-surface-container-lowest/90 px-4 backdrop-blur-xl lg:h-20 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center lg:hidden">
            <Wrench className="w-4 h-4 text-on-primary" />
          </div>
          <div>
            <span className="block font-bold text-primary text-body-md truncate max-w-[180px] lg:max-w-none lg:text-lg">Trang khách hàng</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-wider text-on-surface-variant lg:block">{userName}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Đăng xuất"
          className="flex items-center gap-2 px-3 py-2 hover:bg-error-container hover:text-error rounded-lg text-on-surface-variant transition-colors border border-transparent hover:border-error/20"
          title="Đăng xuất"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">Đăng xuất</span>
        </button>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8">
        <div className="w-full lg:mx-auto lg:max-w-6xl">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-outline-variant/20 bg-surface-container-lowest/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-4 h-16 px-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span className="max-w-full truncate text-[10px] font-semibold sm:text-[11px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      </div>
    </div>
  );
}
