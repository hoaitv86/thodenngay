"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BellRing, BriefcaseBusiness, ChevronRight, GripVertical, Hammer, Lock, Moon, Save, Snowflake, Speaker, ToggleLeft, Vibrate, Wrench, Zap } from "lucide-react";
import { buildWorkerSpecialtyGroups } from "@/lib/worker-specialty-catalog";

type WorkerPreference = {
  audience: "worker";
  category: string;
  enabled: boolean;
  priority: number;
};

type SpecialtyItem = {
  category: string;
  label: string;
  enabled: boolean;
  priority: number;
};

const specialtyColors = [
  "bg-info/10 text-info",
  "bg-primary-fixed text-primary-container",
  "bg-warning-container text-warning",
  "bg-secondary-fixed text-secondary-container",
  "bg-success-container text-success",
  "bg-error-container text-error",
];

function getSpecialtyIcon(label: string) {
  const value = label.toLowerCase();
  if (value.includes("điện lạnh") || value.includes("dien lanh")) return Snowflake;
  if (value.includes("điện") || value.includes("dien")) return Zap;
  if (value.includes("sửa") || value.includes("sua")) return Hammer;
  if (value.includes("vệ sinh") || value.includes("ve sinh")) return Wrench;
  return BriefcaseBusiness;
}

export default function WorkerNotificationSettingsPage() {
  const baseSpecialties = useMemo(() => buildWorkerSpecialtyGroups().map((group, index) => ({
    category: group.label,
    label: group.label,
    enabled: true,
    priority: index + 1,
  })), []);
  const [items, setItems] = useState<SpecialtyItem[]>(baseSpecialties);
  const [nextJobEnabled, setNextJobEnabled] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/notifications/preferences", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!alive) return;
        const preferences = (payload.preferences || []) as WorkerPreference[];
        const map = new Map(preferences.filter((item) => item.audience === "worker").map((item) => [item.category, item]));
        setItems(baseSpecialties.map((item) => ({
          ...item,
          enabled: map.get(item.category)?.enabled ?? item.enabled,
          priority: map.get(item.category)?.priority ?? item.priority,
        })).sort((a, b) => a.priority - b.priority));
        setNextJobEnabled(map.get("next_job_reminder")?.enabled ?? true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [baseSpecialties]);

  const reorder = (fromCategory: string, toCategory: string) => {
    setItems((current) => {
      const fromIndex = current.findIndex((item) => item.category === fromCategory);
      const toIndex = current.findIndex((item) => item.category === toCategory);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const copy = [...current];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy.map((item, index) => ({ ...item, priority: index + 1 }));
    });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const preferences = [
      { audience: "worker", category: "system_assigned_job", enabled: true, priority: 0 },
      { audience: "worker", category: "next_job_reminder", enabled: nextJobEnabled, priority: 1 },
      ...items.map((item, index) => ({ audience: "worker", category: item.category, enabled: item.enabled, priority: index + 2 })),
    ];
    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences }),
    }).catch(() => undefined);
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };

  return (
    <div className="min-h-dvh bg-surface px-4 py-5 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-outline-variant/25">
          <Link href="/worker" className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/35 bg-white text-on-surface-variant" aria-label="Quay lại">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-bold uppercase text-primary-container">Thông báo thợ V1</p>
            <h1 className="text-xl font-extrabold text-on-surface">Cài đặt thông báo</h1>
          </div>
          <button type="button" onClick={save} disabled={saving} className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-60" aria-label="Lưu cài đặt">
            <Save size={18} />
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section className="overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-sm">
            <div className="border-b border-outline-variant/20 px-4 py-3">
              <h2 className="text-[11px] font-extrabold uppercase text-on-surface-variant">Ưu tiên thông báo</h2>
            </div>

            <div className="divide-y divide-outline-variant/20">
              <div className="flex items-center justify-between gap-3 px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-container text-warning"><BriefcaseBusiness size={19} /></span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-on-surface">Việc hệ thống giao</h3>
                    <p className="text-xs text-on-surface-variant">Ưu tiên cao nhất, luôn nhận</p>
                  </div>
                </div>
                <Lock className="h-4 w-4 text-on-surface-variant" />
              </div>

              <label className="flex items-center justify-between gap-3 px-4 py-4">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-container text-success"><BellRing size={18} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-on-surface">Nhắc việc tiếp theo</span>
                    <span className="block text-xs text-on-surface-variant">Thông báo việc tiếp theo sau khi hoàn thành</span>
                  </span>
                </span>
                <input type="checkbox" checked={nextJobEnabled} onChange={(event) => setNextJobEnabled(event.target.checked)} className="h-5 w-5 accent-primary" />
              </label>
            </div>

            <div className="border-y border-outline-variant/20 bg-surface-container-low px-4 py-3">
              <h2 className="text-[11px] font-extrabold uppercase text-on-surface-variant">Danh sách chuyên môn</h2>
              <p className="mt-1 text-xs text-on-surface-variant">Kéo thả để sắp xếp ưu tiên nhận việc.</p>
            </div>

            <div className="divide-y divide-outline-variant/20">
              {items.map((item, index) => {
                const Icon = getSpecialtyIcon(item.label);
                return (
                  <div
                    key={item.category}
                    draggable
                    onDragStart={() => setDragging(item.category)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragging) reorder(dragging, item.category);
                      setDragging(null);
                    }}
                    className="grid grid-cols-[auto_auto_auto_1fr_auto] items-center gap-3 px-4 py-3"
                  >
                    <GripVertical className="h-5 w-5 cursor-grab text-on-surface-variant" />
                    <span className="w-5 text-center text-xs font-extrabold text-on-surface-variant">{index + 1}</span>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${specialtyColors[index % specialtyColors.length]}`}><Icon size={17} /></span>
                    <span className="min-w-0 truncate text-sm font-bold text-on-surface">{item.label}</span>
                    <input type="checkbox" checked={item.enabled} onChange={(event) => setItems((current) => current.map((row) => row.category === item.category ? { ...row, enabled: event.target.checked } : row))} className="h-5 w-5 accent-primary" />
                  </div>
                );
              })}
            </div>

            <div className="border-t border-outline-variant/20 bg-surface-container-low px-4 py-3">
              <h2 className="text-[11px] font-extrabold uppercase text-on-surface-variant">Tùy chỉnh khác</h2>
            </div>
            <div className="divide-y divide-outline-variant/20">
              <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm">
                <span className="flex items-center gap-3 font-bold text-on-surface"><Speaker size={18} /> Âm thanh thông báo</span>
                <span className="flex items-center gap-1 text-on-surface-variant">Mặc định <ChevronRight size={16} /></span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm">
                <span className="flex items-center gap-3 font-bold text-on-surface"><Vibrate size={18} /> Rung</span>
                <input type="checkbox" defaultChecked className="h-5 w-5 accent-primary" />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm">
                <span className="flex items-center gap-3 font-bold text-on-surface"><Moon size={18} /> Không làm phiền</span>
                <span className="flex items-center gap-1 text-on-surface-variant">22:00 - 06:00 <ChevronRight size={16} /></span>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-outline-variant/25 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-primary-container"><GripVertical size={17} /><h2 className="text-sm font-extrabold">Kéo thả</h2></div>
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">Kéo lên/xuống để thay đổi thứ tự ưu tiên nhận việc.</p>
            </section>
            <section className="rounded-2xl border border-outline-variant/25 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-primary-container"><ToggleLeft size={17} /><h2 className="text-sm font-extrabold">Bật / Tắt</h2></div>
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">Chỉ nhận thông báo của chuyên môn đang bật.</p>
            </section>
            <section className="rounded-2xl border border-primary-container/20 bg-primary-fixed/40 p-4">
              <div className="flex items-center gap-2 text-primary-container"><BellRing size={17} /><h2 className="text-sm font-extrabold">Ưu tiên</h2></div>
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">Hệ thống chọn việc có lịch hẹn sớm nhất trong mỗi nhóm đang bật.</p>
            </section>
          </aside>
        </div>

        <button type="button" onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-extrabold text-white shadow-sm disabled:opacity-60">
          <Save size={17} />
          {saving ? "Đang lưu..." : saved ? "Đã lưu" : "Lưu cài đặt"}
        </button>
      </div>
    </div>
  );
}
