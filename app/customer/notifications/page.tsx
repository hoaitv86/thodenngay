"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, BellRing, CalendarCheck, CheckCircle2, Filter, Heart, MapPin, MessageCircle, Settings, Star, Sun, UserCheck } from "lucide-react";

type CustomerNotification = {
  id: string;
  title: string;
  body: string;
  level: "info" | "success" | "warning" | "critical";
  type: string;
  target_url?: string | null;
  created_at: string;
  read_at?: string | null;
  audience?: "worker" | "customer" | "admin";
};

type CustomerPreference = {
  audience: "customer";
  category: string;
  enabled: boolean;
  priority: number;
};

const filters = [
  { id: "all", label: "Tất cả" },
  { id: "unread", label: "Chưa đọc" },
  { id: "job", label: "Công việc" },
  { id: "system", label: "Hệ thống" },
  { id: "promo", label: "Ưu đãi" },
] as const;

const customerPreferenceRows = [
  { category: "worker_assigned", label: "Thợ đã nhận việc", icon: UserCheck, color: "bg-success-container text-success" },
  { category: "worker_changed", label: "Công việc được giao cho thợ khác", icon: MessageCircle, color: "bg-secondary-fixed text-secondary-container" },
  { category: "worker_en_route", label: "Thợ đang đến", icon: BellRing, color: "bg-warning-container text-warning" },
  { category: "worker_arrived", label: "Thợ đã đến", icon: MapPin, color: "bg-info/10 text-info" },
  { category: "job_completed_review", label: "Công việc hoàn thành & mời đánh giá", icon: CheckCircle2, color: "bg-primary-fixed text-primary" },
  { category: "customer_thanks", label: "Cảm ơn khách hàng", icon: Heart, color: "bg-error-container text-error" },
  { category: "customer_morning_reminder", label: "Nhắc hằng ngày buổi sáng", icon: Sun, color: "bg-warning-container text-warning" },
];

function getIcon(type: string) {
  if (type.includes("changed")) return MessageCircle;
  if (type.includes("assigned")) return UserCheck;
  if (type.includes("route")) return BellRing;
  if (type.includes("arrived")) return MapPin;
  if (type.includes("completed")) return CheckCircle2;
  if (type.includes("thanks")) return Heart;
  if (type.includes("review")) return Star;
  if (type.includes("morning")) return CalendarCheck;
  return Bell;
}

function getIconClass(type: string) {
  if (type.includes("assigned")) return "bg-success-container text-success";
  if (type.includes("changed")) return "bg-secondary-fixed text-secondary-container";
  if (type.includes("route")) return "bg-warning-container text-warning";
  if (type.includes("arrived")) return "bg-info/10 text-info";
  if (type.includes("completed")) return "bg-primary-fixed text-primary";
  if (type.includes("thanks")) return "bg-error-container text-error";
  if (type.includes("morning")) return "bg-primary-fixed text-primary-container";
  return "bg-surface-container-low text-on-surface-variant";
}

function isJobNotification(item: CustomerNotification) {
  return Boolean(item.target_url?.startsWith("/customer/jobs") || ["worker_assigned", "worker_changed", "worker_en_route", "worker_arrived", "job_completed_review", "customer_thanks"].includes(item.type));
}

function getDayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hôm nay";
  if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return date.toLocaleDateString("vi-VN");
}

export default function CustomerNotificationsPage() {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [preferences, setPreferences] = useState<CustomerPreference[]>([]);
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/notifications", { cache: "no-store" }).then((response) => response.json()).catch(() => ({ notifications: [] })),
      fetch("/api/notifications/preferences", { cache: "no-store" }).then((response) => response.json()).catch(() => ({ preferences: [] })),
    ]).then(([notificationPayload, preferencePayload]) => {
      if (!alive) return;
      setNotifications(((notificationPayload.notifications || []) as CustomerNotification[]).filter((item) => item.audience === "customer" || item.target_url?.startsWith("/customer") || !item.target_url));
      setPreferences((preferencePayload.preferences || []).filter((item: CustomerPreference) => item.audience === "customer"));
    }).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const unread = notifications.filter((item) => !item.read_at).map((item) => item.id);
    if (unread.length === 0) return;
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds: unread }),
    }).catch(() => undefined);
  }, [notifications]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const filteredNotifications = useMemo(() => notifications.filter((item) => {
    if (activeFilter === "unread") return !item.read_at;
    if (activeFilter === "job") return isJobNotification(item);
    if (activeFilter === "system") return !isJobNotification(item) || item.type.includes("morning");
    if (activeFilter === "promo") return item.type.includes("promo") || item.type.includes("offer");
    return true;
  }), [activeFilter, notifications]);

  const groupedNotifications = useMemo(() => filteredNotifications.reduce<Array<{ label: string; items: CustomerNotification[] }>>((groups, item) => {
    const label = getDayLabel(item.created_at);
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.items.push(item);
    else groups.push({ label, items: [item] });
    return groups;
  }, []), [filteredNotifications]);

  const preferenceMap = new Map(preferences.map((item) => [item.category, item]));
  const setPreferenceEnabled = (category: string, enabled: boolean) => {
    setPreferences((current) => {
      const existing = current.find((item) => item.category === category);
      if (existing) return current.map((item) => item.category === category ? { ...item, enabled } : item);
      return [...current, { audience: "customer", category, enabled, priority: customerPreferenceRows.findIndex((item) => item.category === category) + 1 }];
    });
  };

  const savePreferences = async () => {
    setSaving(true);
    const rows = customerPreferenceRows.map((row, index) => ({
      audience: "customer",
      category: row.category,
      enabled: preferenceMap.get(row.category)?.enabled ?? true,
      priority: index + 1,
    }));
    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: rows }),
    }).catch(() => undefined);
    setSaving(false);
  };

  return (
    <div className="min-h-dvh bg-surface px-4 py-5 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl bg-primary px-4 py-5 text-white shadow-sm sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link href="/customer/home" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/12" aria-label="Quay lại">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[11px] font-bold uppercase text-white/70">Trung tâm thông báo</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight">Thông báo</h1>
            </div>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-white/12">
              <Bell size={19} />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-extrabold">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </div>
          </div>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-white/82">Đúng lúc - đúng việc - quan tâm từng khách hàng.</p>
        </header>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-xs font-extrabold transition-colors ${activeFilter === filter.id ? "bg-primary text-white shadow-sm" : "bg-white text-on-surface-variant ring-1 ring-outline-variant/30"}`}
            >
              {filter.label}
              {filter.id === "unread" && unreadCount > 0 ? <span className="ml-1 rounded-full bg-error px-1.5 py-0.5 text-[10px] text-white">{unreadCount}</span> : null}
            </button>
          ))}
          <span className="ml-auto hidden items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-on-surface-variant ring-1 ring-outline-variant/30 sm:flex"><Filter size={14} /> Lọc</span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            {loading ? (
              <div className="flex h-48 items-center justify-center rounded-lg bg-white shadow-sm"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : groupedNotifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant/50 bg-white py-16 text-center shadow-sm">
                <Bell className="mx-auto h-9 w-9 text-on-surface-variant/50" />
                <p className="mt-3 text-sm font-bold text-on-surface">Chưa có thông báo</p>
              </div>
            ) : groupedNotifications.map((group) => (
              <div key={group.label} className="rounded-lg border border-outline-variant/25 bg-white shadow-sm">
                <h2 className="border-b border-outline-variant/20 px-4 py-3 text-[11px] font-extrabold uppercase text-on-surface-variant">{group.label}</h2>
                <div className="divide-y divide-outline-variant/20">
                  {group.items.map((notification) => {
                    const Icon = getIcon(notification.type);
                    return (
                      <Link key={notification.id} href={notification.target_url || "/customer/jobs"} className="block px-4 py-4 transition-colors hover:bg-surface-container-low">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${getIconClass(notification.type)}`}><Icon size={21} /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-sm font-extrabold text-on-surface">{notification.title}</h3>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs font-medium text-on-surface-variant">{new Date(notification.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                                {!notification.read_at && <span className="h-2.5 w-2.5 rounded-full bg-error" />}
                              </div>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-on-surface-variant">{notification.body}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-outline-variant/25 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-primary-container">
                <Settings size={17} />
                <h2 className="text-sm font-extrabold uppercase">Cài đặt thông báo</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">Khách được quyền tắt thông báo mặc định hằng ngày và tuỳ chỉnh âm thanh, rung, khung giờ không làm phiền.</p>
              <div className="mt-4 divide-y divide-outline-variant/20">
                {customerPreferenceRows.map((row) => {
                  const Icon = row.icon;
                  const enabled = preferenceMap.get(row.category)?.enabled ?? true;
                  return (
                    <label key={row.category} className="flex items-center justify-between gap-3 py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${row.color}`}><Icon size={17} /></span>
                        <span className="min-w-0 text-sm font-bold text-on-surface">{row.label}</span>
                      </span>
                      <input type="checkbox" checked={enabled} onChange={(event) => setPreferenceEnabled(row.category, event.target.checked)} className="h-5 w-5 accent-primary" />
                    </label>
                  );
                })}
              </div>
              <button type="button" onClick={savePreferences} disabled={saving} className="mt-3 w-full rounded-lg bg-primary px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">
                {saving ? "Đang lưu..." : "Lưu cài đặt"}
              </button>
            </section>

            <section className="rounded-lg border border-primary-container/20 bg-primary-fixed/40 p-4">
              <h2 className="text-sm font-extrabold uppercase text-primary-container">Nguyên tắc gửi</h2>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-on-surface-variant">
                <li>Push ngay cả khi app không mở nếu có Internet và thiết bị đã đăng ký nhận push.</li>
                <li>Mỗi giai đoạn công việc chỉ gửi một thông báo tương ứng.</li>
                <li>Thông báo chăm sóc buổi sáng chỉ gửi khi khách không có việc đang hoạt động.</li>
                <li>Bấm thông báo mở thẳng công việc hoặc chi tiết liên quan.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
