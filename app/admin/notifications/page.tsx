"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BriefcaseBusiness, CheckCircle2, Clock, EyeOff, FileCheck2, Filter, Megaphone, MoreVertical, Send, ShieldCheck, Star, Timer, TriangleAlert, UserPlus, Users, XCircle, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NotificationLevel = "info" | "success" | "warning";
type AdminStatusFilter = "all" | "open" | "in_progress" | "auto_resolved" | "resolved";

type AdminCoreNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  level: "info" | "success" | "warning" | "critical";
  priority: number;
  status: "open" | "in_progress" | "auto_resolved" | "resolved";
  job_id?: string | null;
  target_url?: string | null;
  resolution_reason?: string | null;
  created_at: string;
  handled_at?: string | null;
};

type WorkerNotification = {
  id: string;
  title: string;
  body: string;
  level: NotificationLevel;
  is_active: boolean;
  published_at: string;
};

const levelOptions: Array<{
  value: NotificationLevel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "info", label: "Thông tin", icon: Bell },
  { value: "success", label: "Tin tốt", icon: CheckCircle2 },
  { value: "warning", label: "Lưu ý", icon: TriangleAlert },
];

const levelClassName: Record<NotificationLevel, string> = {
  info: "border-info/20 bg-info/5",
  success: "border-success/20 bg-success-container/40",
  warning: "border-warning/25 bg-warning-container/60",
};

const adminPriorityCatalog = [
  { type: "job_unassigned_risk", label: "Không có thợ nhận", tone: "border-error/20 bg-error-container/45 text-error", icon: TriangleAlert },
  { type: "customer_job_created", label: "Khách đặt việc mới", tone: "border-warning/20 bg-warning-container/45 text-warning", icon: UserPlus },
  { type: "worker_cancel_requested", label: "Thợ hủy việc", tone: "border-warning/20 bg-warning-container/45 text-warning", icon: XCircle },
  { type: "job_late_risk", label: "Nguy cơ trễ lịch", tone: "border-secondary-container/20 bg-secondary-fixed/55 text-secondary-container", icon: Timer },
  { type: "worker_pending_profile", label: "Hồ sơ thợ chờ duyệt", tone: "border-info/20 bg-info/10 text-info", icon: FileCheck2 },
  { type: "customer_registered_with_worker", label: "KH đăng ký kèm thợ", tone: "border-primary/20 bg-primary-fixed/55 text-primary", icon: Users },
  { type: "complaint_low_rating", label: "Khiếu nại / đánh giá thấp", tone: "border-success/20 bg-success-container/45 text-success", icon: Star },
];

const statusTabs: Array<{ id: AdminStatusFilter; label: string; countKey?: keyof AdminStats }> = [
  { id: "all", label: "Tất cả" },
  { id: "open", label: "Cần xử lý", countKey: "open" },
  { id: "in_progress", label: "Đang xử lý", countKey: "in_progress" },
  { id: "auto_resolved", label: "Đã tự giải quyết", countKey: "auto_resolved" },
  { id: "resolved", label: "Đã xử lý", countKey: "resolved" },
];

type AdminStats = { open: number; in_progress: number; auto_resolved: number; resolved: number };

function getAdminIcon(type: string) {
  return adminPriorityCatalog.find((item) => item.type === type)?.icon || Bell;
}

function getAdminTone(alert: AdminCoreNotification) {
  if (alert.status === "auto_resolved") return "border-success/20 bg-success-container/35 text-success";
  if (alert.status === "resolved") return "border-primary-container/20 bg-primary-fixed/35 text-primary-container";
  if (alert.level === "critical") return "border-error/20 bg-error-container/45 text-error";
  if (alert.level === "warning") return "border-warning/20 bg-warning-container/45 text-warning";
  return "border-info/20 bg-info/10 text-info";
}

function getStatusLabel(status: AdminCoreNotification["status"]) {
  if (status === "open") return "Cần xử lý";
  if (status === "in_progress") return "Đang xử lý";
  if (status === "auto_resolved") return "Đã tự giải quyết";
  return "Đã xử lý";
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminNotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [adminAlerts, setAdminAlerts] = useState<AdminCoreNotification[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats>({ open: 0, in_progress: 0, auto_resolved: 0, resolved: 0 });
  const [activeWorkerCount, setActiveWorkerCount] = useState(0);
  const [activeStatus, setActiveStatus] = useState<AdminStatusFilter>("all");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null });
  const [form, setForm] = useState({
    title: "",
    body: "",
    level: "info" as NotificationLevel,
  });

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    window.setTimeout(() => setToast({ message: "", type: null }), 3200);
  };

  const fetchData = async () => {
    setLoading(true);

    const [notificationResult, workerResult, adminAlertResult] = await Promise.all([
      supabase
        .from("admin_worker_notifications")
        .select("id, title, body, level, is_active, published_at")
        .order("published_at", { ascending: false })
        .limit(30),
      supabase
        .from("workers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      fetch("/api/admin/notifications", { cache: "no-store" })
        .then((response) => response.json())
        .catch(() => null),
    ]);

    if (notificationResult.error) {
      showToast(
        notificationResult.error.message.includes("admin_worker_notifications")
          ? "Chưa có bảng thông báo. Hãy chạy supabase/migration_admin_worker_notifications.sql."
          : "Không thể tải thông báo: " + notificationResult.error.message,
        "error"
      );
    } else {
      setNotifications((notificationResult.data || []) as WorkerNotification[]);
    }

    if (adminAlertResult) {
      const nextAlerts = (adminAlertResult.notifications || []) as AdminCoreNotification[];
      setAdminAlerts(nextAlerts);
      setAdminStats(adminAlertResult.stats || { open: 0, in_progress: 0, auto_resolved: 0, resolved: 0 });
      setSelectedAlertId((current) => current || nextAlerts[0]?.id || null);
    }

    setActiveWorkerCount(workerResult.count || 0);
    setLoading(false);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAdminAlerts = adminAlerts.filter((alert) => activeStatus === "all" || alert.status === activeStatus);
  const selectedAlert = filteredAdminAlerts.find((alert) => alert.id === selectedAlertId) || filteredAdminAlerts[0] || adminAlerts[0] || null;
  const totalAdminAlerts = adminStats.open + adminStats.in_progress + adminStats.auto_resolved + adminStats.resolved;

  const updateAdminAlertStatus = async (alert: AdminCoreNotification, status: "open" | "in_progress" | "resolved") => {
    const reason = status === "resolved" ? "Admin đã xử lý thủ công" : status === "in_progress" ? "Admin đang xử lý" : "Mở lại thông báo";
    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: alert.id, status, reason }),
    });
    if (!response.ok) {
      showToast("Không thể cập nhật trạng thái thông báo.", "error");
      return;
    }
    showToast("Đã cập nhật trạng thái thông báo.", "success");
    void fetchData();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const title = form.title.trim();
    const body = form.body.trim();
    if (!title || !body) {
      showToast("Vui lòng nhập tiêu đề và nội dung.", "error");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("admin_worker_notifications").insert({
      title,
      body,
      level: form.level,
      created_by: user?.id || null,
    });

    setSaving(false);

    if (error) {
      showToast("Gửi thông báo thất bại: " + error.message, "error");
      return;
    }

    setForm({ title: "", body: "", level: "info" });
    showToast("Đã gửi thông báo đến toàn bộ thợ.", "success");
    void fetchData();
  };

  const handleHide = async (notification: WorkerNotification) => {
    const { error } = await supabase
      .from("admin_worker_notifications")
      .update({ is_active: false })
      .eq("id", notification.id);

    if (error) {
      showToast("Không thể ẩn thông báo: " + error.message, "error");
      return;
    }

    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_active: false } : item));
    showToast("Đã ẩn thông báo khỏi chuông của thợ.", "success");
  };

  return (
    <div className="relative space-y-6 animate-fade-in">
      {toast.type && (
        <div className={`fixed right-4 top-4 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm font-bold shadow-lg ${
          toast.type === "success"
            ? "border-success/30 bg-success-container text-on-success-container"
            : "border-error/30 bg-error-container text-on-error-container"
        }`}>
          {toast.message}
        </div>
      )}

      <header className="rounded-2xl border border-primary-container/15 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-sm"><Bell className="h-8 w-8" /></div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-normal text-primary-container">Trung tâm thông báo</h1>
              <p className="mt-1 text-sm font-medium text-on-surface-variant">Quản lý, xử lý và theo dõi các thông báo quan trọng của hệ thống.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-extrabold sm:grid-cols-4">
            <span className="inline-flex items-center gap-2 rounded-lg border border-primary-container/15 bg-white px-3 py-2 text-on-surface"><ShieldCheck className="h-4 w-4 text-primary" /> Ưu tiên quan trọng</span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-primary-container/15 bg-white px-3 py-2 text-on-surface"><Zap className="h-4 w-4 text-primary" /> Cập nhật thời gian thực</span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-primary-container/15 bg-white px-3 py-2 text-on-surface"><Filter className="h-4 w-4 text-primary" /> Lọc & tìm kiếm</span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-primary-container/15 bg-white px-3 py-2 text-on-surface"><BriefcaseBusiness className="h-4 w-4 text-primary" /> Điều phối nhanh</span>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-error/25 bg-error-container/40 p-4"><p className="text-sm font-extrabold text-error">Cần xử lý</p><p className="mt-1 text-3xl font-extrabold text-error">{adminStats.open}</p><p className="text-xs text-on-surface-variant">Ưu tiên cao</p></div>
        <div className="rounded-lg border border-warning/25 bg-warning-container/45 p-4"><p className="text-sm font-extrabold text-warning">Đang xử lý</p><p className="mt-1 text-3xl font-extrabold text-warning">{adminStats.in_progress}</p><p className="text-xs text-on-surface-variant">Đang được theo dõi</p></div>
        <div className="rounded-lg border border-success/25 bg-success-container/45 p-4"><p className="text-sm font-extrabold text-success">Đã tự giải quyết</p><p className="mt-1 text-3xl font-extrabold text-success">{adminStats.auto_resolved}</p><p className="text-xs text-on-surface-variant">Hệ thống đã xử lý</p></div>
        <div className="rounded-lg border border-primary-container/20 bg-primary-fixed/45 p-4"><p className="text-sm font-extrabold text-primary-container">Đã xử lý</p><p className="mt-1 text-3xl font-extrabold text-primary-container">{adminStats.resolved}</p><p className="text-xs text-on-surface-variant">Admin đã xử lý</p></div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {statusTabs.map((tab) => {
                  const count = tab.id === "all" ? totalAdminAlerts : adminStats[tab.countKey || "open"];
                  return (
                    <button key={tab.id} type="button" onClick={() => setActiveStatus(tab.id)} className={`rounded-lg px-3 py-2 text-xs font-extrabold ${activeStatus === tab.id ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant"}`}>
                      {tab.label} <span className="ml-1 rounded-full bg-white/70 px-1.5 text-[10px] text-primary-container">{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-on-surface-variant">
                <span className="rounded-lg border border-outline-variant/30 px-3 py-2">Loại thông báo: Tất cả</span>
                <span className="rounded-lg border border-outline-variant/30 px-3 py-2">Ưu tiên: Tất cả</span>
                <span className="rounded-lg border border-outline-variant/30 px-3 py-2">Sắp xếp: Mới nhất</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-outline-variant/25">
              <div className="grid grid-cols-[86px_minmax(0,1fr)_110px_120px_40px] bg-surface-container-low px-4 py-3 text-[11px] font-extrabold uppercase text-on-surface-variant max-lg:hidden">
                <span>Ưu tiên</span><span>Thông báo</span><span>Thời gian</span><span>Trạng thái</span><span />
              </div>
              {loading ? (
                <div className="flex h-44 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
              ) : filteredAdminAlerts.length === 0 ? (
                <div className="p-8 text-center text-sm font-bold text-on-surface-variant">Chưa có cảnh báo admin.</div>
              ) : (
                <div className="divide-y divide-outline-variant/20">
                  {filteredAdminAlerts.map((alert) => {
                    const Icon = getAdminIcon(alert.type);
                    const selected = selectedAlert?.id === alert.id;
                    return (
                      <button key={alert.id} type="button" onClick={() => setSelectedAlertId(alert.id)} className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-container-low lg:grid-cols-[86px_minmax(0,1fr)_110px_120px_40px] lg:items-center ${selected ? "bg-primary-fixed/45" : "bg-white"}`}>
                        <span className={`flex h-11 w-11 items-center justify-center rounded-lg border ${getAdminTone(alert)}`}><Icon className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-extrabold text-on-surface">{alert.title}</span>
                          <span className="mt-1 block truncate text-xs text-on-surface-variant">{alert.body}</span>
                          {alert.job_id && <span className="mt-1 block text-[10px] font-bold uppercase text-primary-container">Mã việc: {alert.job_id.slice(0, 8)}</span>}
                        </span>
                        <span className="hidden text-xs font-bold text-on-surface lg:block">{formatTime(alert.created_at)}</span>
                        <span className="hidden w-fit rounded-lg bg-white px-2 py-1 text-xs font-extrabold text-on-surface-variant ring-1 ring-outline-variant/30 lg:block">{getStatusLabel(alert.status)}</span>
                        <MoreVertical className="hidden h-4 w-4 text-on-surface-variant lg:block" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {adminPriorityCatalog.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.type} className={`flex items-center gap-3 rounded-lg border p-3 ${item.tone}`}>
                  <span className="text-lg font-extrabold">{String(index + 1).padStart(2, "0")}</span>
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-extrabold">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="card space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant/25 pb-3">
              <h2 className="text-sm font-extrabold uppercase text-primary-container">Chi tiết thông báo</h2>
              {selectedAlert && <span className="rounded-lg bg-error-container px-2 py-1 text-xs font-extrabold text-error">{getStatusLabel(selectedAlert.status)}</span>}
            </div>
            {!selectedAlert ? (
              <div className="py-12 text-center text-sm font-bold text-on-surface-variant">Chọn một thông báo để xem chi tiết.</div>
            ) : (
              <>
                <div className={`rounded-lg border p-4 ${getAdminTone(selectedAlert)}`}>
                  <div className="flex items-start gap-3">
                    {React.createElement(getAdminIcon(selectedAlert.type), { className: "mt-0.5 h-6 w-6 shrink-0" })}
                    <div className="min-w-0">
                      <h3 className="text-xl font-extrabold text-on-surface">{selectedAlert.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{selectedAlert.body}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs font-bold text-on-surface-variant sm:grid-cols-3">
                    <span>Thời gian tạo: {formatTime(selectedAlert.created_at)}</span>
                    <span>Trạng thái: {getStatusLabel(selectedAlert.status)}</span>
                    <span>Ưu tiên: {selectedAlert.priority}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/25 bg-white p-4">
                  <h3 className="text-xs font-extrabold uppercase text-primary-container">Lý do hệ thống thông báo</h3>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-on-surface-variant">
                    <li>Thông báo được tạo từ sự kiện vận hành hoặc điều phối.</li>
                    <li>Hệ thống tự đóng khi nguyên nhân hết hiệu lực, có lưu lý do và lịch sử.</li>
                    {selectedAlert.resolution_reason && <li>Lý do xử lý: {selectedAlert.resolution_reason}</li>}
                  </ul>
                </div>

                <div className="rounded-lg border border-outline-variant/25 bg-white p-4">
                  <h3 className="text-xs font-extrabold uppercase text-primary-container">Lịch sử xử lý</h3>
                  <div className="mt-3 flex gap-3 text-xs text-on-surface-variant">
                    <Clock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-bold text-on-surface">Hệ thống tạo thông báo</p>
                      <p>{formatTime(selectedAlert.created_at)}</p>
                      {selectedAlert.handled_at && <p className="mt-2">Cập nhật xử lý: {formatTime(selectedAlert.handled_at)}</p>}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <button type="button" onClick={() => updateAdminAlertStatus(selectedAlert, "in_progress")} className="rounded-lg border border-warning/30 bg-white px-3 py-3 text-xs font-extrabold text-warning">Đang xử lý</button>
                  <button type="button" onClick={() => updateAdminAlertStatus(selectedAlert, "resolved")} className="rounded-lg bg-primary px-3 py-3 text-xs font-extrabold text-white">Đã xử lý</button>
                  <Link href={selectedAlert.target_url || "/admin/jobs"} className="rounded-lg border border-primary/25 bg-white px-3 py-3 text-center text-xs font-extrabold text-primary">Xem chi tiết</Link>
                </div>
              </>
            )}
          </section>

          <section className="rounded-lg border border-primary-container/20 bg-primary-fixed/40 p-4">
            <h2 className="text-sm font-extrabold uppercase text-primary-container">Nguyên tắc thông báo</h2>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">Hệ thống chỉ thông báo khi cần con người can thiệp. Các tình huống tự động giải quyết sẽ không làm phiền Admin.</p>
          </section>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(360px,440px)_1fr]">
        <form onSubmit={handleSubmit} className="card space-y-5">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><Send className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Soạn thông báo thợ</h2>
              <p className="text-xs text-on-surface-variant">Gửi một lần, toàn bộ thợ active sẽ thấy trong chuông hiện có.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm">Tiêu đề</label>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="input-field" placeholder="VD: Lịch họp thợ cuối tuần" maxLength={120} />
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm">Nội dung</label>
            <textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} className="input-field min-h-36 resize-y" placeholder="Nhập nội dung thông báo..." maxLength={1200} />
          </div>

          <div className="space-y-2">
            <label className="text-label-sm">Mức độ</label>
            <div className="grid grid-cols-3 gap-2">
              {levelOptions.map((option) => {
                const Icon = option.icon;
                const selected = form.level === option.value;
                return (
                  <button key={option.value} type="button" onClick={() => setForm((current) => ({ ...current, level: option.value }))} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-extrabold transition-colors ${selected ? "border-primary bg-primary text-white" : "border-outline-variant/50 bg-white text-on-surface-variant hover:bg-surface-container-low"}`}>
                    <Icon className="h-4 w-4" /> {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full justify-center disabled:opacity-70">{saving ? "Đang gửi..." : "Gửi thông báo"}</button>
        </form>

        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Thông báo thợ đã gửi</h2>
              <p className="text-xs text-on-surface-variant">Có thể ẩn thông báo cũ khỏi chuông của thợ.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm font-bold text-on-surface shadow-sm"><Megaphone className="h-4 w-4 text-primary" /> {activeWorkerCount} thợ active</div>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" /></div>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low p-8 text-center"><Bell className="mx-auto h-8 w-8 text-on-surface-variant" /><p className="mt-3 text-sm font-bold text-on-surface">Chưa có thông báo nào</p></div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <article key={notification.id} className={`rounded-xl border p-4 ${levelClassName[notification.level]} ${notification.is_active ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-on-surface">{notification.title}</h3>
                        {!notification.is_active && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">Đã ẩn</span>}
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-on-surface-variant">{notification.body}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-on-surface-variant"><Clock className="h-3.5 w-3.5" />{new Date(notification.published_at).toLocaleString("vi-VN")}</div>
                    </div>
                    {notification.is_active && (
                      <button type="button" onClick={() => handleHide(notification)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white/85 px-3 py-2 text-xs font-extrabold text-on-surface-variant shadow-sm hover:bg-white"><EyeOff className="h-4 w-4" />Ẩn</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
