"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Clock, EyeOff, Megaphone, Send, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NotificationLevel = "info" | "success" | "warning";

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

export default function AdminNotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [activeWorkerCount, setActiveWorkerCount] = useState(0);
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

    const [notificationResult, workerResult] = await Promise.all([
      supabase
        .from("admin_worker_notifications")
        .select("id, title, body, level, is_active, published_at")
        .order("published_at", { ascending: false })
        .limit(30),
      supabase
        .from("workers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
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

    setNotifications((items) =>
      items.map((item) => item.id === notification.id ? { ...item, is_active: false } : item)
    );
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

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Thông báo thợ</h1>
          <p className="text-body-sm text-on-surface-variant">
            Gửi thông báo xuất hiện trong nút chuông trên trang thợ.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm font-bold text-on-surface shadow-sm">
          <Megaphone className="h-4 w-4 text-primary" />
          {activeWorkerCount} thợ đang hoạt động
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(360px,440px)_1fr]">
        <form onSubmit={handleSubmit} className="card space-y-5">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Soạn thông báo</h2>
              <p className="text-xs text-on-surface-variant">Gửi một lần, toàn bộ thợ active sẽ thấy.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm">Tiêu đề</label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="input-field"
              placeholder="VD: Lịch họp thợ cuối tuần"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm">Nội dung</label>
            <textarea
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              className="input-field min-h-36 resize-y"
              placeholder="Nhập nội dung thông báo..."
              maxLength={1200}
            />
          </div>

          <div className="space-y-2">
            <label className="text-label-sm">Mức độ</label>
            <div className="grid grid-cols-3 gap-2">
              {levelOptions.map((option) => {
                const Icon = option.icon;
                const selected = form.level === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, level: option.value }))}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-extrabold transition-colors ${
                      selected
                        ? "border-primary bg-primary text-white"
                        : "border-outline-variant/50 bg-white text-on-surface-variant hover:bg-surface-container-low"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full justify-center disabled:opacity-70">
            {saving ? "Đang gửi..." : "Gửi thông báo"}
          </button>
        </form>

        <section className="card space-y-4">
          <div className="border-b border-outline-variant/30 pb-4">
            <h2 className="text-lg font-semibold text-on-surface">Thông báo đã gửi</h2>
            <p className="text-xs text-on-surface-variant">Có thể ẩn thông báo cũ khỏi chuông của thợ.</p>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low p-8 text-center">
              <Bell className="mx-auto h-8 w-8 text-on-surface-variant" />
              <p className="mt-3 text-sm font-bold text-on-surface">Chưa có thông báo nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`rounded-xl border p-4 ${levelClassName[notification.level]} ${notification.is_active ? "" : "opacity-60"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-on-surface">{notification.title}</h3>
                        {!notification.is_active && (
                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
                            Đã ẩn
                          </span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-on-surface-variant">{notification.body}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(notification.published_at).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    {notification.is_active && (
                      <button
                        type="button"
                        onClick={() => handleHide(notification)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white/85 px-3 py-2 text-xs font-extrabold text-on-surface-variant shadow-sm hover:bg-white"
                      >
                        <EyeOff className="h-4 w-4" />
                        Ẩn
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
