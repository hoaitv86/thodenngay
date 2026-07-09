"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Package } from "lucide-react";
import { resolveWorkerFeatures, type WorkerFeatureIconKey } from "@/config/workerFeatureRegistry";
import { createClient } from "@/lib/supabase/client";
import {
  BellIcon,
  BriefcaseIcon,
  DollarSignIcon,
  LayoutDashboardIcon,
  LogoIcon,
  LogOutIcon,
  UserIcon,
  UsersIcon,
} from "../components/icons";

type NavIcon = React.ComponentType<{ size?: number; className?: string }>;

const workerFeatureIcons: Record<WorkerFeatureIconKey, NavIcon> = {
  dashboard: LayoutDashboardIcon,
  users: UsersIcon,
  package: Package,
  money: DollarSignIcon,
  chat: MessageCircle,
  briefcase: BriefcaseIcon,
  user: UserIcon,
};

const defaultNavItems = resolveWorkerFeatures({
  role: "worker",
  specialties: [],
  data: { billgoHistory: false },
});

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userName, setUserName] = useState("Thợ");
  const [navItems, setNavItems] = useState(defaultNavItems);

  useEffect(() => {
    let isMounted = true;

    const hasBillGoData = async (workerId: string) => {
      const [subscriptionResult, receivableResult] = await Promise.all([
        supabase
          .from("billgo_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("worker_id", workerId),
        supabase
          .from("billgo_receivables")
          .select("id", { count: "exact", head: true })
          .eq("worker_id", workerId)
          .not("subscription_id", "is", null),
      ]);

      return (subscriptionResult.count || 0) > 0 || (receivableResult.count || 0) > 0;
    };

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: worker }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single(),
        supabase
          .from("workers")
          .select("id, specialties")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (!isMounted) return;

      if (profile?.full_name) setUserName(profile.full_name);

      const specialties = Array.isArray(worker?.specialties)
        ? worker.specialties.filter((item): item is string => typeof item === "string")
        : [];
      const billgoHistory = worker?.id ? await hasBillGoData(worker.id) : false;

      if (!isMounted) return;

      setNavItems(resolveWorkerFeatures({
        role: "worker",
        specialties,
        data: { billgoHistory },
      }));
    };

    void getUser();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const isActiveItem = (href: string) =>
    pathname === href || (href !== "/worker" && pathname.startsWith(href));

  return (
    <div className="min-h-dvh w-full bg-surface lg:flex">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-outline-variant/25 lg:bg-white">
        <div className="flex h-20 items-center gap-3 border-b border-outline-variant/20 px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-low shadow-sm">
            <LogoIcon size={26} />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-extrabold leading-tight text-primary">{userName}</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-success">Online</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = isActiveItem(item.href);
            const Icon = workerFeatureIcons[item.icon];

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-extrabold transition-all ${isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
              >
                <Icon size={20} className={isActive ? "stroke-[2.5px]" : ""} />
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
            <LogOutIcon size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh w-full flex-col lg:pl-64">
        <header className="sticky top-0 z-40 glass flex h-16 items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm lg:hidden">
              <LogoIcon size={24} />
            </div>
            <div>
              <span className="block max-w-[180px] truncate text-base font-bold leading-tight text-primary lg:max-w-none lg:text-lg">Trang thợ</span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="max-w-[180px] truncate text-[10px] font-bold uppercase text-success sm:max-w-none">{userName} đang online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative rounded-lg p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container" aria-label="Thông báo">
              <BellIcon size={22} />
              <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-error" />
            </button>
            <button
              onClick={handleLogout}
              aria-label="Đăng xuất"
              className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-on-surface-variant transition-colors hover:border-error/20 hover:bg-error-container hover:text-error"
              title="Đăng xuất"
            >
              <LogOutIcon size={18} />
              <span className="hidden text-[10px] font-bold uppercase sm:inline">Đăng xuất</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8">
          <div className="w-full lg:mx-auto lg:max-w-6xl">
            {children}
          </div>
        </main>

        <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-outline-variant/30 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
          <div
            className="grid h-20"
            style={{ gridTemplateColumns: `repeat(${Math.max(navItems.length, 1)}, minmax(0, 1fr))` }}
          >
            {navItems.map((item) => {
              const isActive = isActiveItem(item.href);
              const Icon = workerFeatureIcons[item.icon];

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1.5 transition-all ${isActive
                      ? "text-primary"
                      : "text-on-surface-variant hover:bg-slate-50"
                    }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${isActive ? "bg-primary-fixed" : ""}`}>
                    <Icon size={21} className={isActive ? "stroke-[2.5px]" : ""} />
                  </span>
                  <span className={`max-w-full truncate text-[10px] font-bold uppercase ${isActive ? "opacity-100" : "opacity-60"}`}>
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
