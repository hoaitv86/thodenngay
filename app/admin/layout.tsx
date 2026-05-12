"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Wrench as WrenchIcon,
  Settings,
  LogOut,
  UserCheck,
  CreditCard,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/jobs", label: "Quản lý Job", icon: Briefcase },
  { href: "/admin/workers", label: "Quản lý Thợ", icon: UserCheck },
  { href: "/admin/services", label: "Dịch vụ & Giá", icon: WrenchIcon },
  { href: "/admin/customers", label: "Khách hàng", icon: Users },
  { href: "/admin/payments", label: "Thanh toán", icon: CreditCard },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("Admin");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-on-primary/10">
        <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center">
          <WrenchIcon className="w-4.5 h-4.5 text-on-secondary" />
        </div>
        <div>
          <span className="font-bold text-on-primary text-body-md truncate max-w-[140px] block">{userName}</span>
          <span className="block text-label-sm text-on-primary/50">Admin Panel</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-medium transition-all ${
                isActive
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-on-primary/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-body-sm font-medium text-white/70 hover:bg-error/20 hover:text-error-container transition-all"
        >
          <LogOut className="w-5 h-5" />
          Đăng xuất
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-surface">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-primary shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-primary z-50 flex flex-col transform transition-transform md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-6 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-surface-container transition-colors"
          >
            <Menu className="w-5 h-5 text-on-surface" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-surface-container transition-colors">
              <Bell className="w-5 h-5 text-on-surface-variant" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-secondary-container rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-label-sm font-bold text-primary">
              {userName.charAt(0)}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-surface-container-low">
          {children}
        </main>
      </div>
    </div>
  );
}
