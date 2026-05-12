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
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-surface relative">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/20 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
            <Wrench className="w-4 h-4 text-on-primary" />
          </div>
          <span className="font-bold text-primary text-body-md truncate max-w-[150px]">{userName}</span>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 hover:bg-error-container hover:text-error rounded-lg text-on-surface-variant transition-colors border border-transparent hover:border-error/20"
          title="Đăng xuất"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">Đăng xuất</span>
        </button>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/20 z-30">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
