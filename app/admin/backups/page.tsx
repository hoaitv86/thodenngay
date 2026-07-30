"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  DatabaseBackup,
  History,
  Loader2,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

type BackupRecord = {
  id: string;
  label: string;
  status: "completed" | "failed";
  table_count: number;
  row_count: number;
  created_at: string;
  restored_at?: string | null;
  metadata?: Record<string, unknown> | null;
  creator?: { full_name?: string | null; email?: string | null } | null;
  restorer?: { full_name?: string | null; email?: string | null } | null;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Không xác định");

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleString("vi-VN");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value || 0);
}

function getActorName(actor?: { full_name?: string | null; email?: string | null } | null) {
  return actor?.full_name || actor?.email || "Super Admin";
}

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedBackup = useMemo(
    () => backups.find((backup) => backup.id === restoreConfirmId) || null,
    [backups, restoreConfirmId],
  );

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4000);
  };

  const loadBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/backups", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể tải danh sách backup.");
      setBackups(data.backups || []);
    } catch (error: unknown) {
      showMessage("error", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, []);

  const createBackup = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể tạo backup.");
      setLabel("");
      showMessage("success", "Đã tạo backup PostgreSQL trong database.");
      await loadBackups();
    } catch (error: unknown) {
      showMessage("error", getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async () => {
    if (!selectedBackup || confirmText !== "KHOI PHUC") return;

    setRestoringId(selectedBackup.id);
    try {
      const response = await fetch(`/api/admin/backups/${selectedBackup.id}/restore`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể khôi phục backup.");
      setRestoreConfirmId(null);
      setConfirmText("");
      showMessage("success", "Đã khôi phục dữ liệu từ backup PostgreSQL.");
      await loadBackups();
    } catch (error: unknown) {
      showMessage("error", getErrorMessage(error));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {message && (
        <div className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm font-bold shadow-elevated ${message.type === "success" ? "border-success/25 bg-success-container text-success" : "border-error/25 bg-error-container text-error"}`}>
          {message.type === "success" ? <CheckCircle className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">Sao lưu & Khôi phục</h1>
          <p className="mt-1 max-w-3xl text-body-sm leading-6 text-on-surface-variant">
            Tạo snapshot trực tiếp trong Supabase/PostgreSQL cho toàn bộ bảng public. Dữ liệu backup được lưu trong database,
            không tải ra file JSON hoặc CSV.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-container px-4 py-3 text-sm text-warning xl:max-w-md">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="font-bold leading-6">Chỉ Super Admin có quyền tạo backup và restore. Restore sẽ ghi đè dữ liệu hiện tại.</span>
        </div>
      </div>

      <form onSubmit={createBackup} className="rounded-lg border border-outline-variant/30 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-bold text-on-surface">Tên backup</label>
            <input
              className="input-field"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ví dụ: Trước khi cập nhật dịch vụ"
              maxLength={120}
            />
          </div>
          <button type="submit" disabled={creating} className="btn-primary !w-auto !px-5 !py-2.5">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
            {creating ? "Đang sao lưu..." : "Tạo backup PostgreSQL"}
          </button>
        </div>
      </form>

      <section className="rounded-lg border border-outline-variant/30 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 p-4">
          <div>
            <h2 className="text-lg font-extrabold text-on-surface">Lịch sử backup</h2>
            <p className="mt-1 text-xs text-on-surface-variant">30 bản backup gần nhất trong PostgreSQL.</p>
          </div>
          <button type="button" onClick={loadBackups} className="btn-outline !w-auto !px-4 !py-2" disabled={loading}>
            <History className="h-4 w-4" />
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm font-bold text-on-surface-variant">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải backup...
          </div>
        ) : backups.length === 0 ? (
          <div className="p-6 text-sm text-on-surface-variant">Chưa có backup nào.</div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {backups.map((backup) => (
              <div key={backup.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-extrabold text-on-surface">{backup.label}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${backup.status === "completed" ? "bg-success-container text-success" : "bg-error-container text-error"}`}>
                      {backup.status === "completed" ? "Hoàn tất" : "Lỗi"}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-on-surface-variant sm:grid-cols-2 xl:grid-cols-4">
                    <span>{formatNumber(backup.table_count)} bảng</span>
                    <span>{formatNumber(backup.row_count)} dòng</span>
                    <span>Tạo: {formatDate(backup.created_at)}</span>
                    <span>Bởi: {getActorName(backup.creator)}</span>
                  </div>
                  {backup.restored_at && (
                    <p className="mt-2 text-xs font-bold text-warning">
                      Khôi phục gần nhất: {formatDate(backup.restored_at)} bởi {getActorName(backup.restorer)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRestoreConfirmId(backup.id);
                    setConfirmText("");
                  }}
                  className="btn-outline !w-auto !border-warning/40 !px-4 !py-2 !text-warning"
                  disabled={backup.status !== "completed" || restoringId === backup.id}
                >
                  {restoringId === backup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Khôi phục
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-elevated">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-error-container text-error">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-on-surface">Xác nhận khôi phục</h2>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                  Backup <span className="font-bold text-on-surface">{selectedBackup.label}</span> sẽ thay thế dữ liệu hiện tại
                  trong các bảng public. Nhập <span className="font-extrabold text-error">KHOI PHUC</span> để tiếp tục.
                </p>
              </div>
            </div>
            <input
              className="input-field mt-4"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="KHOI PHUC"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-outline !w-auto !px-4 !py-2" onClick={() => setRestoreConfirmId(null)} disabled={Boolean(restoringId)}>
                Hủy
              </button>
              <button type="button" className="btn-primary !w-auto !bg-error !px-5 !py-2" onClick={restoreBackup} disabled={confirmText !== "KHOI PHUC" || Boolean(restoringId)}>
                {restoringId ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Khôi phục dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
