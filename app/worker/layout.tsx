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
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-surface border-x border-outline-variant shadow-2xl relative">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 glass h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003178] flex items-center justify-center shadow-lg shadow-blue-900/20">
            <LogoIcon size={24} />
          </div>
          <div>
            <span className="block font-bold text-[#003178] leading-tight truncate max-w-[120px]">{userName}</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-success uppercase tracking-wider">Online</span>
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
      <main className="flex-1 overflow-y-auto pb-24 bg-surface">
        {children}
      </main>

      {/* Premium Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur-xl border-t border-outline-variant/30 z-50">
        <div className="grid grid-cols-4 h-20">
          {[
            { href: "/worker", label: "Việc làm", icon: LayoutDashboardIcon },
            { href: "/worker/history", label: "Lịch sử", icon: BriefcaseIcon },
            { href: "/worker/wallet", label: "Ví", icon: DollarSignIcon },
            { href: "/worker/profile", label: "Hồ sơ", icon: UserIcon },
          ].map((item) => {
            const isActive = pathname === item.href || (item.href !== "/worker" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1.5 transition-all ${isActive
                    ? "text-[#003178] scale-110"
                    : "text-[#434652] hover:bg-slate-50"
                  }`}
              >
                <item.icon size={22} className={isActive ? "stroke-[2.5px]" : ""} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "opacity-100" : "opacity-60"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
