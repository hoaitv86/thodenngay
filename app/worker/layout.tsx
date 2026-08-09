"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { ACTIVE_ROLE_COOKIE } from "@/lib/account-roles";
import { isWorkerUnitMemberRole, type WorkerUnitMemberRole } from "@/lib/worker-unit-permissions";
import { resolveWorkerFeatureModuleState } from "@/lib/worker-modules";
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

type WorkerMembershipRow = {
  member_role?: string | null;
};

type WorkerNotification = {
  id: string;
  title: string;
  body: string;
  level: "info" | "success" | "warning";
  published_at: string;
  read_at?: string | null;
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
  role: "technician",
  specialties: [],
  data: { billgoHistory: false, billgoAccess: false },
  enabledFeatures: resolveWorkerFeatureModuleState({ role: "technician", specialties: [] }),
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

const activeRoleCookieMaxAge = 60 * 60 * 24 * 30;

function setActiveRoleCookie(role: "customer" | "worker") {
  document.cookie = `${ACTIVE_ROLE_COOKIE}=${role}; path=/; max-age=${activeRoleCookieMaxAge}; samesite=lax`;
}


export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userName, setUserName] = useState("Thợ");
  const [userAddress, setUserAddress] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [menuContext, setMenuContext] = useState(defaultMenuContext);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationUserId, setNotificationUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);

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
  const mobileItems = useMemo(() => {
    const allMobileItems = [...mobilePrimaryItems, ...mobileMoreItems];
    const findItem = (id: string) => allMobileItems.find((item) => item.id === id);
    const createItem = findItem("create_job");
    return [
      findItem("home"),
      findItem("jobs"),
      createItem,
      findItem("customers"),
      findItem("profile") || mobileMoreItem,
    ].filter(Boolean).map((item) => {
      if (!item) return item;
      if (item.id === "jobs") return { ...item, label: "Việc của tôi" };
      if (item.id === "profile") return { ...item, label: "Cá nhân" };
      return item;
    }) as WorkerFeatureDefinition[];
  }, [mobileMoreItems, mobilePrimaryItems]);
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
  const unreadNotificationCount = notifications.filter((notification) => !notification.read_at).length;
  const isProfilePage = pathname === "/worker/profile";
  const isWorkerHomePage = pathname === "/worker";

  const fetchWorkerNotifications = useCallback(async (userId: string) => {
    const { data: notificationRows, error: notificationError } = await supabase
      .from("admin_worker_notifications")
      .select("id, title, body, level, published_at")
      .eq("is_active", true)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(10);

    if (notificationError) {
      if (!notificationError.message.includes("admin_worker_notifications")) {
        console.warn("Could not load worker notifications:", notificationError.message);
      }
      setNotifications([]);
      return;
    }

    const ids = (notificationRows || []).map((notification) => notification.id);
    let readMap = new Map<string, string>();

    if (ids.length > 0) {
      const { data: readRows, error: readError } = await supabase
        .from("admin_worker_notification_reads")
        .select("notification_id, read_at")
        .eq("worker_user_id", userId)
        .in("notification_id", ids);

      if (!readError) {
        readMap = new Map((readRows || []).map((row) => [row.notification_id as string, row.read_at as string]));
      }
    }

    setNotifications(
      ((notificationRows || []) as WorkerNotification[]).map((notification) => ({
        ...notification,
        read_at: readMap.get(notification.id) || null,
      }))
    );
  }, [supabase]);

  const markNotificationsRead = useCallback(async () => {
    if (!notificationUserId) return;

    const unreadNotifications = notifications.filter((notification) => !notification.read_at);
    if (unreadNotifications.length === 0) return;

    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || readAt })));

    const { error } = await supabase
      .from("admin_worker_notification_reads")
      .upsert(
        unreadNotifications.map((notification) => ({
          notification_id: notification.id,
          worker_user_id: notificationUserId,
          read_at: readAt,
        })),
        { onConflict: "notification_id,worker_user_id" }
      );

    if (error) {
      console.warn("Could not mark worker notifications as read:", error.message);
    }
  }, [notificationUserId, notifications, supabase]);

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

    const loadMemberships = async (userId: string) => {
      const { data, error } = await supabase
        .from("worker_unit_members")
        .select("member_role")
        .eq("user_id", userId)
        .eq("status", "active");

      if (error) {
        console.warn("Could not load worker unit memberships:", error.message);
        return [];
      }

      return (data || []) as WorkerMembershipRow[];
    };

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      if (isMounted) setNotificationUserId(user.id);

      const [{ data: profile }, { data: worker }, memberships] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, role, phone, email, address")
          .eq("id", user.id)
          .single(),
        supabase
          .from("workers")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        loadMemberships(user.id),
      ]);

      if (!isMounted) return;

      if (profile?.full_name) setUserName(profile.full_name);
      setUserAddress(typeof profile?.address === "string" ? profile.address : "");
      setIsAvailable(worker?.is_available !== false);
      if (worker?.status === "active") {
        void fetchWorkerNotifications(user.id);
      } else {
        setNotifications([]);
      }

      const workerSpecialties = Array.isArray(worker?.specialties) ? worker.specialties as unknown[] : [];
      const specialties = workerSpecialties.length > 0
        ? workerSpecialties.filter((item): item is string => typeof item === "string")
        : [];
      const membershipRows = memberships || [];
      const membershipRoles = membershipRows
        .map((item) => item.member_role)
        .filter(isWorkerUnitMemberRole);
      const rolePriority: WorkerUnitMemberRole[] = ["owner", "manager", "technician", "bill_collector", "sales_inventory"];
      const unitRole = rolePriority.find((item) => membershipRoles.includes(item));
      const legacyRole = typeof profile?.role === "string" ? profile.role : "worker";
      const role: WorkerRole = unitRole || (legacyRole === "admin" ? "admin" : "technician");
      const enabledFeatures = resolveWorkerFeatureModuleState({
        role,
        specialties,
      });

      if (!isMounted) return;

      setMenuContext({
        role,
        specialties,
        data: {
          billgoHistory: false,
          billgoAccess: enabledFeatures.billgo,
        },
        enabledFeatures,
      });
    };

    void getUser();

    const handleAvailabilityChange = (event: Event) => {
      const detail = (event as CustomEvent<{ isAvailable?: boolean }>).detail;
      if (typeof detail?.isAvailable === "boolean") setIsAvailable(detail.isAvailable);
    };

    window.addEventListener("worker:availability-changed", handleAvailabilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener("worker:availability-changed", handleAvailabilityChange);
    };
  }, [fetchWorkerNotifications, supabase]);

  useEffect(() => {
    if (!notificationUserId) return;

    const channel = supabase
      .channel("worker-admin-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_worker_notifications" },
        () => {
          void fetchWorkerNotifications(notificationUserId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchWorkerNotifications, notificationUserId, supabase]);

  const handleLogout = async () => {
    document.cookie = `${ACTIVE_ROLE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    await supabase.auth.signOut();
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const handleSwitchToCustomerMode = () => {
    setActiveRoleCookie("customer");
    setMoreOpen(false);
    setNotificationOpen(false);
    window.location.assign("/customer/home");
  };

  const handleCreateJobNav = () => {
    setMoreOpen(false);
    if (pathname === "/worker") {
      window.dispatchEvent(new CustomEvent("worker:open-quick-job"));
      window.setTimeout(() => {
        document.getElementById("worker-quick-job")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
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

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {sidebarItems.map((item) => renderNavLink(item, true))}
        </nav>

        <div className="mt-auto border-t border-outline-variant/20 p-3">
          <button
            type="button"
            onClick={handleSwitchToCustomerMode}
            className="mb-2 flex w-full items-center justify-start gap-3 rounded-lg px-4 py-3 text-sm font-extrabold text-primary-container transition-colors hover:bg-primary-fixed"
          >
            <UserIcon size={20} />
            <span>Chế độ Khách hàng</span>
          </button>
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

      <div className={`flex min-h-dvh w-full flex-col md:pl-64 ${isWorkerHomePage ? "worker-home-layout" : ""}`}>
        <header className={`worker-app-header sticky top-0 z-40 ${isWorkerHomePage ? "worker-home-header bg-primary text-white md:glass md:bg-white/90 md:text-on-surface" : "glass"} flex ${isWorkerHomePage ? "min-h-44 items-start px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))] md:h-20 md:min-h-0 md:items-center md:px-8 md:py-0" : "h-16 items-center px-4 sm:px-6 lg:h-20 lg:px-8"} justify-between`}>
          <div className={`flex items-center gap-3 ${isWorkerHomePage ? "min-w-0 flex-1 md:flex-none" : ""}`}>
            <div className={`${isWorkerHomePage ? "hidden" : "flex"} h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm md:hidden`}>
              <LogoIcon size={24} />
            </div>
            {isWorkerHomePage && (
              <div className="relative mr-1 flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-white/80 bg-white shadow-lg md:hidden">
                <LogoIcon size={48} />
                <span className={`absolute bottom-1 right-0 h-5 w-5 rounded-full border-[3px] border-white ${isAvailable ? "bg-success" : "bg-outline-variant"}`} />
              </div>
            )}
            <div className="min-w-0">
              <span className={`block truncate font-bold leading-tight ${isWorkerHomePage ? "max-w-[9.5rem] text-xl text-white min-[390px]:max-w-[13rem] min-[390px]:text-2xl md:text-primary" : "max-w-[180px] text-base text-primary lg:max-w-none lg:text-lg"}`}>
                {isWorkerHomePage ? `Xin chào, ${userName}!` : "Trang thợ"}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isAvailable ? "animate-pulse bg-success" : "bg-outline-variant"}`} />
                <span className={`max-w-[180px] truncate text-[10px] font-bold uppercase sm:max-w-none ${isWorkerHomePage ? "text-white/90 md:text-success" : isAvailable ? "text-success" : "text-on-surface-variant"}`}>
                  {userName} {isAvailable ? "đang online" : "đang offline"}
                </span>
              </div>
              {isWorkerHomePage && userAddress && (
                <div className="mt-2 flex min-w-0 items-center gap-1.5 text-sm font-bold text-white/90 md:hidden">
                  <span className="text-white">•</span>
                  <span className="truncate">{userAddress}</span>
                </div>
              )}
            </div>
          </div>
          <div className={`flex items-center ${isWorkerHomePage ? "gap-3 md:gap-2" : "gap-2"}`}>
            <button
              type="button"
              onClick={handleSwitchToCustomerMode}
              className={`${isWorkerHomePage ? "hidden md:inline-flex" : "hidden sm:inline-flex"} items-center gap-2 rounded-lg border border-primary-container/20 bg-white px-3 py-2.5 text-xs font-extrabold text-primary-container shadow-sm transition-colors hover:bg-primary-fixed`}
            >
              <UserIcon size={16} />
              Chế độ Khách hàng
            </button>
            <button
              type="button"
              onClick={handleSwitchToCustomerMode}
              aria-label="Chế độ Khách hàng"
              title="Chế độ Khách hàng"
              className={`${isWorkerHomePage ? "hidden" : "flex"} h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-container/15 bg-white p-0 text-primary-container shadow-sm transition-colors hover:bg-primary-fixed sm:hidden`}
            >
              <UserIcon size={16} />
            </button>
            <div
              className="relative"
              onClick={() => {
                setNotificationOpen((open) => !open);
                setMoreOpen(false);
                void markNotificationsRead();
              }}
            >
            <button className={`relative flex shrink-0 items-center justify-center border bg-white p-0 shadow-sm transition-colors hover:bg-surface-container ${isWorkerHomePage ? "h-14 w-14 rounded-full border-white/40 text-on-surface md:h-9 md:w-9 md:rounded-lg md:border-primary-container/15" : "h-9 w-9 rounded-lg border-primary-container/15 text-on-surface-variant"}`} aria-label={"Th\u00f4ng b\u00e1o"}>
              <BellIcon size={isWorkerHomePage ? 23 : 16} />
              {unreadNotificationCount > 0 && (
                <span className={`absolute flex items-center justify-center rounded-full border-2 border-white bg-error px-1 font-extrabold leading-none text-white ${isWorkerHomePage ? "-right-0.5 -top-0.5 h-6 min-w-6 text-xs" : "right-0.5 top-0.5 h-4 min-w-4 text-[9px]"}`}>
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              )}
            </button>
            {notificationOpen && (
              <div
                className="fixed left-4 right-4 top-16 z-50 w-auto overflow-hidden rounded-xl border border-outline-variant/25 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[22rem]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-on-surface">Thông báo</h2>
                    <p className="text-[11px] font-bold text-on-surface-variant">Tin mới từ admin</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotificationOpen(false)}
                    className="rounded-lg px-2 py-1 text-xs font-extrabold text-on-surface-variant hover:bg-surface-container-low"
                  >
                    Đóng
                  </button>
                </div>

                <div className="max-h-[24rem] overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant">
                        <BellIcon size={20} />
                      </div>
                      <p className="mt-3 text-sm font-bold text-on-surface">Chưa có thông báo</p>
                      <p className="mt-1 text-xs text-on-surface-variant">Khi admin gửi tin, nội dung sẽ hiện ở đây.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notification) => (
                        <article
                          key={notification.id}
                          className={`rounded-lg border p-3 ${
                            notification.level === "warning"
                              ? "border-warning/25 bg-warning-container/60"
                              : notification.level === "success"
                                ? "border-success/25 bg-success-container/40"
                                : "border-info/20 bg-info/5"
                          } ${notification.read_at ? "opacity-75" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            {!notification.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-error" />}
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-extrabold text-on-surface">{notification.title}</h3>
                              <p className="mt-1 whitespace-pre-line text-xs leading-5 text-on-surface-variant">{notification.body}</p>
                              <p className="mt-2 text-[10px] font-bold uppercase text-on-surface-variant">
                                {new Date(notification.published_at).toLocaleString("vi-VN")}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
            {isWorkerHomePage && (
              <Link
                href="/worker/chat"
                aria-label="Tin nhắn"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white p-0 text-on-surface shadow-sm transition-colors hover:bg-surface-container md:hidden"
              >
                <MessageCircle size={24} />
              </Link>
            )}
            <button
              onClick={handleLogout}
              aria-label="Đăng xuất"
              className={`${isWorkerHomePage ? "hidden" : "flex"} h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-container/15 bg-white p-0 text-on-surface-variant shadow-sm transition-colors hover:border-error/20 hover:bg-error-container hover:text-error md:hidden`}
              title="Đăng xuất"
            >
              <LogOutIcon size={16} />
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

        <main className={`worker-app-main worker-mobile-content flex-1 overflow-y-auto bg-surface ${isProfilePage ? "worker-profile-shell" : ""}`}>
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
          className="worker-bottom-nav fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-t-xl border border-outline-variant/20 bg-white/95 px-3 pt-2 shadow-[0_-14px_38px_rgba(15,23,42,0.12)] backdrop-blur-xl md:hidden"
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
                  onClick={isCreateJob ? handleCreateJobNav : () => setMoreOpen(false)}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                    isCreateJob ? "h-20 -translate-y-2" : "h-16"
                  } ${
                    isActive ? "text-primary" : "text-on-surface-variant hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-xl ${
                      isCreateJob
                        ? "h-14 w-14 rounded-full bg-primary text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)]"
                        : `h-10 w-10 ${isActive ? "bg-primary-fixed shadow-sm" : ""}`
                    }`}
                  >
                    <Icon size={isCreateJob ? 28 : 21} className={isActive || isCreateJob ? "stroke-[2.5px]" : ""} />
                  </span>
                  <span
                    className={`max-w-full truncate text-[10px] font-extrabold leading-none min-[390px]:text-[11px] ${
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
