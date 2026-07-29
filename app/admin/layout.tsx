"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  MessageCircle,
  FileText,
  MapPin,
  UserCog,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminModule } from "@/lib/admin-roles";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  module?: AdminModule;
  superAdminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: LayoutDashboard, module: "analytics" },
  { href: "/admin/jobs", label: "Quản lý Job", icon: Briefcase, module: "jobs" },
  { href: "/admin/workers", label: "Quản lý Thợ", icon: UserCheck, module: "workers" },
  { href: "/admin/services", label: "Dịch vụ & Giá", icon: WrenchIcon, module: "services" },
  { href: "/admin/customers", label: "Khách hàng", icon: Users, module: "customers" },
  { href: "/admin/chat", label: "Chat", icon: MessageCircle, module: "customers" },
  { href: "/admin/notifications", label: "Thông báo", icon: Bell, module: "analytics" },
  { href: "/admin/payments", label: "BillGo", icon: CreditCard, module: "billgo" },
  { href: "/admin/areas", label: "Địa bàn", icon: MapPin, module: "services" },
  { href: "/admin/content", label: "Quản lý nội dung", icon: FileText, module: "content" },
  { href: "/admin/admins", label: "Super Admin", icon: UserCog, superAdminOnly: true },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings, superAdminOnly: true },
];

function getModuleForPath(pathname: string) {
  const matched = navItems
    .filter((item) => item.module && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return matched?.module || null;
}

function SidebarContent({
  pathname,
  userName,
  items,
  onLogout,
  onNavigate,
}: {
  pathname: string;
  userName: string;
  items: NavItem[];
  onLogout: () => void;
  onNavigate: () => void;
}) {
  return (
    <>
      <div className="h-16 flex items-center gap-2 px-5 border-b border-on-primary/10">
        <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center">
          <WrenchIcon className="w-4.5 h-4.5 text-on-secondary" />
        </div>
        <div>
          <span className="font-bold text-on-primary text-base truncate max-w-[140px] block">{userName}</span>
          <span className="block text-[10px] font-bold text-on-primary/70 uppercase tracking-widest">Admin Panel</span>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-white/15 text-white! shadow-sm"
                  : "text-white/70! hover:bg-white/10 hover:text-white!"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-on-primary/10">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-white/70! hover:bg-error/20 hover:text-error-container! transition-all"
        >
          <LogOut className="w-5 h-5" />
          Đăng xuất
        </button>
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("Admin");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allowedModules, setAllowedModules] = useState<Set<AdminModule>>(() => new Set());
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const supabase = createClient();

  const visibleNavItems = navItems.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (!item.module) return true;
    return isSuperAdmin || allowedModules.has(item.module);
  });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile) setUserName(profile.full_name);

      const permissionRes = await fetch("/api/admin/me/permissions", { cache: "no-store" });
      if (permissionRes.ok) {
        const permissionData = await permissionRes.json();
        setIsSuperAdmin(Boolean(permissionData.isSuperAdmin));
        setRequiresPasswordChange(Boolean(permissionData.admin?.requires_password_change));
        setAllowedModules(
          new Set(
            (permissionData.permissions || [])
              .filter((item: { can_view?: boolean; can_manage?: boolean }) => item.can_view || item.can_manage)
              .map((item: { module: AdminModule }) => item.module),
          ),
        );
      }
      setPermissionsLoaded(true);
    };

    getUser();
  }, [supabase]);

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (requiresPasswordChange && !pathname.startsWith("/admin/admins")) {
      router.replace("/admin/admins?password=required");
      return;
    }

    const module = getModuleForPath(pathname);
    if (module && !isSuperAdmin && !allowedModules.has(module)) {
      router.replace(visibleNavItems[0]?.href || "/admin/admins");
    }
  }, [allowedModules, isSuperAdmin, pathname, permissionsLoaded, requiresPasswordChange, router, visibleNavItems]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="admin-shell flex h-screen bg-surface">
      <aside className="hidden md:flex w-64 flex-col bg-linear-to-b from-primary via-primary-container to-secondary-container shrink-0">
        <SidebarContent
          pathname={pathname}
          userName={userName}
          items={visibleNavItems}
          onLogout={handleLogout}
          onNavigate={() => setSidebarOpen(false)}
        />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-linear-to-b from-primary via-primary-container to-secondary-container z-50 flex flex-col transform transition-transform md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          pathname={pathname}
          userName={userName}
          items={visibleNavItems}
          onLogout={handleLogout}
          onNavigate={() => setSidebarOpen(false)}
        />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-outline-variant flex items-center justify-between px-6 shrink-0 shadow-card">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu quản trị"
            className="md:hidden p-2 rounded-lg hover:bg-surface-container transition-colors"
          >
            <Menu className="w-5 h-5 text-on-surface" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-surface-container transition-colors" aria-label="Thông báo">
              <Bell className="w-5 h-5 text-on-surface-variant" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-secondary-container rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-label-sm font-bold text-primary">
              {userName.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-surface-container-low">{children}</main>
      </div>
    </div>
  );
}
