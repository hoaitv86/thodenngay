"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, MoreHorizontal, Package, Plus, ShoppingCart } from "lucide-react";
import {
  resolveWorkerMenuByPlacement,
  type WorkerFeatureContext,
  type WorkerFeatureDefinition,
  type WorkerFeatureIconKey,
  type WorkerRole,
} from "@/config/workerFeatureRegistry";
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
type MobileMoreGroup = {
  id: string;
  label: string;
  groups: WorkerFeatureDefinition["group"][];
};

const workerFeatureIcons: Record<WorkerFeatureIconKey, NavIcon> = {
  dashboard: LayoutDashboardIcon,
  users: UsersIcon,
  plus: Plus,
  package: Package,
  cart: ShoppingCart,
  money: DollarSignIcon,
  chat: MessageCircle,
  briefcase: BriefcaseIcon,
  user: UserIcon,
  more: MoreHorizontal,
};

const defaultMenuContext: WorkerFeatureContext = {
  role: "worker" as WorkerRole,
  specialties: [],
  data: { billgoHistory: false, billgoAccess: false },
};

const mobileMoreItem: WorkerFeatureDefinition = {
  id: "more",
  label: "Thêm",
  route: "#more",
  href: "#more",
  icon: "more",
  order: 999,
  enabled: true,
  placements: ["mobilePrimary"],
  group: "more",
};

const mobileMoreGroups: MobileMoreGroup[] = [
  { id: "business", label: "Kinh doanh", groups: ["commerce"] },
  { id: "management", label: "Quản lý", groups: ["work", "communication"] },
  { id: "system", label: "Hệ thống", groups: ["account", "more"] },
];

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userName, setUserName] = useState("Thợ");
  const [menuContext, setMenuContext] = useState(defaultMenuContext);
  const [moreOpen, setMoreOpen] = useState(false);

  const sidebarItems = useMemo(
    () => resolveWorkerMenuByPlacement(menuContext, "sidebar"),
    [menuContext]
  );
  const mobilePrimaryItems = useMemo(
    () => resolveWorkerMenuByPlacement(menuContext, "mobilePrimary"),
    [menuContext]
  );
  const mobileMoreItems = useMemo(
    () => resolveWorkerMenuByPlacement(menuContext, "mobileMore"),
    [menuContext]
  );
  const mobileItems = [...mobilePrimaryItems, mobileMoreItem];
  const groupedMobileMoreItems = useMemo(
    () =>
      mobileMoreGroups
        .map((group) => ({
          ...group,
          items: mobileMoreItems.filter((item) => group.groups.includes(item.group)),
        }))
        .filter((group) => group.items.length > 0),
    [mobileMoreItems]
  );

  useEffect(() => {
    if (!moreOpen) return;

    window.history.pushState({ workerMoreOpen: true }, "", window.location.href);
    const closeOnBack = () => setMoreOpen(false);
    window.addEventListener("popstate", closeOnBack);

    return () => {
      window.removeEventListener("popstate", closeOnBack);
    };
  }, [moreOpen]);

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: worker }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, role")
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
      const role = typeof profile?.role === "string" ? profile.role : "worker";

      if (!isMounted) return;

      setMenuContext({
        role: role as WorkerRole,
        specialties,
        data: {
          billgoHistory,
          billgoAccess: billgoHistory,
        },
      });
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

  const isActiveItem = (item: WorkerFeatureDefinition) => {
    if (item.id === "create_job" || item.id === "more") return false;
    if (item.exactActive) return pathname === item.route;
    return pathname === item.route || (item.route !== "/worker" && pathname.startsWith(item.route));
  };

  const renderNavLink = (item: WorkerFeatureDefinition, compact = false) => {
    const isActive = isActiveItem(item);
    const Icon = workerFeatureIcons[item.icon];

    return (
      <Link
        key={item.id}
        href={item.href}
        title={item.label}
        className={`group flex items-center rounded-lg text-sm font-extrabold transition-all ${
          compact ? "gap-3 px-4 py-3" : "gap-3 px-4 py-3"
        } ${
          isActive
            ? "bg-primary text-white shadow-sm"
            : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
        }`}
      >
        <Icon size={20} className={isActive ? "stroke-[2.5px]" : ""} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-dvh w-full bg-surface md:flex">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex md:w-64 md:flex-col md:border-r md:border-outline-variant/25 md:bg-white">
        <div className="flex h-20 items-center justify-start gap-3 border-b border-outline-variant/20 px-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container-low shadow-sm">
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
          {sidebarItems.map((item) => renderNavLink(item, true))}
        </nav>

        <div className="border-t border-outline-variant/20 p-3">
          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="flex w-full items-center justify-start gap-3 rounded-lg px-4 py-3 text-sm font-extrabold text-error transition-colors hover:bg-error-container"
          >
            <LogOutIcon size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh w-full flex-col md:pl-64">
        <header className="sticky top-0 z-40 glass flex h-16 items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm md:hidden">
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
              className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-on-surface-variant transition-colors hover:border-error/20 hover:bg-error-container hover:text-error md:hidden"
              title="Đăng xuất"
            >
              <LogOutIcon size={18} />
              <span className="hidden text-[10px] font-bold uppercase sm:inline">Đăng xuất</span>
            </button>
          </div>
        </header>

        <style>{`
          @media (max-width: 767px) {
            .worker-mobile-content {
              padding-bottom: calc(8rem + env(safe-area-inset-bottom));
            }
          }

          @media (min-width: 768px) {
            .worker-mobile-content {
              padding-bottom: 2rem;
            }
          }
        `}</style>

        <main className="worker-mobile-content flex-1 overflow-y-auto bg-surface">
          <div className="w-full lg:mx-auto lg:max-w-6xl">
            {children}
          </div>
        </main>

        {moreOpen && (
          <div
            className="fixed inset-x-0 z-50 px-3 md:hidden"
            style={{ bottom: "calc(5.75rem + env(safe-area-inset-bottom))" }}
            data-worker-more-sheet
          >
            <button
              type="button"
              className="fixed inset-0 -z-10 bg-black/20"
              aria-label="Đóng menu thêm"
              onClick={() => setMoreOpen(false)}
            />
            <div className="mx-auto max-w-md overflow-hidden rounded-t-3xl border border-outline-variant/25 bg-white shadow-[0_-16px_40px_rgba(15,23,42,0.16)]">
              <div className="flex justify-center pt-3">
                <span className="h-1 w-10 rounded-full bg-outline-variant/50" />
              </div>
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <span className="text-base font-extrabold text-on-surface">Thêm</span>
                <button
                  type="button"
                  className="min-h-10 rounded-lg px-3 text-xs font-extrabold uppercase text-on-surface-variant hover:bg-surface-container-low"
                  onClick={() => setMoreOpen(false)}
                >
                  Đóng
                </button>
              </div>
              <div className="max-h-[min(28rem,65dvh)] overflow-y-auto px-3 pb-4">
                {groupedMobileMoreItems.map((group) => (
                  <section key={group.id} className="border-t border-outline-variant/15 py-3 first:border-t-0 first:pt-1">
                    <h2 className="px-1 pb-2 text-[11px] font-extrabold uppercase tracking-wide text-on-surface-variant/70">
                      {group.label}
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map((item) => {
                        const Icon = workerFeatureIcons[item.icon];
                        const isActive = isActiveItem(item);

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 text-sm font-extrabold transition-colors ${
                              isActive
                                ? "border-primary bg-primary-fixed text-primary"
                                : "border-outline-variant/25 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                            }`}
                          >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-white/80" : "bg-surface-container-low"}`}>
                              <Icon size={19} className={isActive ? "stroke-[2.5px]" : ""} />
                            </span>
                            <span className="min-w-0 truncate leading-tight">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}

        <nav
          className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-outline-variant/25 bg-white/95 px-2 pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl md:hidden"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
          data-worker-bottom-nav
          aria-label="Điều hướng chính trên mobile"
        >
          <div className="grid h-20 grid-cols-5 items-end gap-1">
            {mobileItems.map((item) => {
              const isMore = item.id === "more";
              const isCreateJob = item.id === "create_job";
              const isActive = isMore ? moreOpen : isActiveItem(item);
              const Icon = workerFeatureIcons[item.icon];

              if (isMore) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMoreOpen((open) => !open)}
                    className={`flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                      isActive ? "text-primary" : "text-on-surface-variant hover:bg-slate-50"
                    }`}
                    aria-expanded={moreOpen}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? "bg-primary-fixed shadow-sm" : ""}`}>
                      <Icon size={21} className={isActive ? "stroke-[2.5px]" : ""} />
                    </span>
                    <span className={`max-w-full truncate text-[10px] font-extrabold uppercase leading-none ${isActive ? "opacity-100" : "opacity-70"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                    isCreateJob ? "h-20 -translate-y-2" : "h-16"
                  } ${
                    isActive ? "text-primary" : "text-on-surface-variant hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-xl ${
                      isCreateJob
                        ? "h-12 w-12 bg-primary text-white shadow-[0_8px_18px_rgba(22,90,88,0.24)]"
                        : `h-10 w-10 ${isActive ? "bg-primary-fixed shadow-sm" : ""}`
                    }`}
                  >
                    <Icon size={isCreateJob ? 23 : 21} className={isActive || isCreateJob ? "stroke-[2.5px]" : ""} />
                  </span>
                  <span
                    className={`max-w-full truncate text-[10px] font-extrabold uppercase leading-none ${
                      isActive || isCreateJob ? "opacity-100" : "opacity-70"
                    }`}
                  >
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

