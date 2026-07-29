"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle, Crown, LockKeyhole, Mail, Plus, ShieldCheck, UserCog, XCircle } from "lucide-react";
import { ADMIN_MODULES, DEFAULT_ADMIN_PERMISSIONS, type AdminModule, type AdminPermission } from "@/lib/admin-roles";

type AdminAccount = {
  id: string;
  email: string;
  full_name: string;
  status?: string | null;
  is_super_admin?: boolean | null;
  requires_password_change?: boolean | null;
  permissions?: AdminPermission[];
};

type AdminForm = {
  userId: string;
  email: string;
  fullName: string;
  password: string;
  isSuperAdmin: boolean;
  status: "active" | "blocked";
  permissions: AdminPermission[];
};

type AuditLog = {
  id: string;
  action: string;
  summary: string;
  created_at?: string | null;
  actor?: { full_name?: string | null; email?: string | null } | null;
  target?: { full_name?: string | null; email?: string | null } | null;
};

const emptyForm: AdminForm = {
  userId: "",
  email: "",
  fullName: "",
  password: "",
  isSuperAdmin: false,
  status: "active",
  permissions: DEFAULT_ADMIN_PERMISSIONS,
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "KhÃ´ng xÃ¡c Ä‘á»‹nh");

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AdminForm>(emptyForm);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedAccount = useMemo(() => accounts.find((account) => account.id === form.userId) || null, [accounts, form.userId]);
  const currentAccount = accounts.find((account) => account.id === currentAdminId);
  const currentIsSuperAdmin = Boolean(currentAccount?.is_super_admin);
  const editing = Boolean(form.userId);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/accounts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch admin.");
      setAccounts(data.accounts || []);
      setCurrentAdminId(data.currentAdminId || "");

      const logResponse = await fetch("/api/admin/audit-logs", { cache: "no-store" });
      if (logResponse.ok) {
        const logData = await logResponse.json();
        setAuditLogs(logData.logs || []);
      }
    } catch (error: unknown) {
      showMessage("error", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const startCreate = () => setForm(emptyForm);

  const startEdit = (account: AdminAccount) => {
    setForm({
      userId: account.id,
      email: account.email || "",
      fullName: account.full_name || "",
      password: "",
      isSuperAdmin: Boolean(account.is_super_admin),
      status: account.status === "blocked" ? "blocked" : "active",
      permissions: account.permissions || DEFAULT_ADMIN_PERMISSIONS,
    });
  };

  const updatePermission = (module: AdminModule, next: Partial<AdminPermission>) => {
    setForm((prev) => ({
      ...prev,
      permissions: ADMIN_MODULES.map((item) => {
        const current = prev.permissions.find((saved) => saved.module === item.key) || {
          module: item.key,
          can_view: true,
          can_manage: true,
        };
        if (item.key !== module) return current;
        const updated = { ...current, ...next };
        return { ...updated, can_view: updated.can_view || updated.can_manage };
      }),
    }));
  };

  const saveAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.email.trim() || !form.fullName.trim()) {
      showMessage("error", "Vui lÃ²ng nháº­p email vÃ  tÃªn hiá»ƒn thá»‹.");
      return;
    }
    if (!editing && form.password.length < 6) {
      showMessage("error", "Admin má»›i cáº§n máº­t kháº©u tá»‘i thiá»ƒu 6 kÃ½ tá»±.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/accounts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "KhÃ´ng thá»ƒ lÆ°u tÃ i khoáº£n admin.");
      showMessage("success", editing ? "ÄÃ£ cáº­p nháº­t tÃ i khoáº£n admin." : "ÄÃ£ táº¡o tÃ i khoáº£n admin.");
      setForm(emptyForm);
      await loadAccounts();
    } catch (error: unknown) {
      showMessage("error", getErrorMessage(error));
    } finally {
      setSaving(false);
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">Super Admin</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Quáº£n lÃ½ tÃ i khoáº£n admin, phÃ¢n quyá»n module, khÃ³a/má»Ÿ vÃ  nháº­t kÃ½ báº£o máº­t.</p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary !w-auto !px-5 !py-2.5">
          <Plus className="h-4 w-4" />
          ThÃªm admin
        </button>
      </div>

      {currentAccount?.requires_password_change && (
        <div className="rounded-lg border border-warning/30 bg-warning-container p-4 text-sm font-bold leading-6 text-warning">
          Báº¡n cáº§n Ä‘á»•i máº­t kháº©u ban Ä‘áº§u trÆ°á»›c khi sá»­ dá»¥ng cÃ¡c module quáº£n trá»‹ khÃ¡c. Chá»n tÃ i khoáº£n cá»§a báº¡n, nháº­p máº­t kháº©u má»›i rá»“i báº¥m LÆ°u thay Ä‘á»•i.
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="rounded-lg border border-outline-variant/30 bg-white">
          <div className="border-b border-outline-variant/30 p-4">
            <h2 className="text-lg font-extrabold text-on-surface">TÃ i khoáº£n quáº£n trá»‹</h2>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-on-surface-variant">Äang táº£i danh sÃ¡ch admin...</div>
          ) : accounts.length === 0 ? (
            <div className="p-6 text-sm text-on-surface-variant">ChÆ°a cÃ³ tÃ i khoáº£n admin nÃ o.</div>
          ) : (
            <div className="divide-y divide-outline-variant/20">
              {accounts.map((account) => (
                <button key={account.id} type="button" onClick={() => startEdit(account)} className={`block w-full p-4 text-left transition-colors hover:bg-surface-container-low ${selectedAccount?.id === account.id ? "bg-primary-fixed/50" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-extrabold text-on-surface">{account.full_name || "Admin"}</p>
                        {account.is_super_admin && <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2 py-1 text-[10px] font-extrabold uppercase text-primary"><Crown className="h-3 w-3" />Super Admin</span>}
                        {account.id === currentAdminId && <span className="rounded-full bg-surface-container-high px-2 py-1 text-[10px] font-extrabold uppercase text-on-surface-variant">Báº¡n</span>}
                      </div>
                      <p className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant"><Mail className="h-4 w-4" />{account.email}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${account.status === "blocked" ? "bg-error-container text-error" : "bg-success-container text-success"}`}>
                      {account.status === "blocked" ? "ÄÃ£ khÃ³a" : "Hoáº¡t Ä‘á»™ng"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={saveAccount} className="rounded-lg border border-outline-variant/30 bg-white p-4">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-fixed text-primary">{editing ? <UserCog className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</div>
            <div>
              <h2 className="font-extrabold text-on-surface">{editing ? "Cáº­p nháº­t admin" : "Táº¡o admin má»›i"}</h2>
              <p className="text-xs text-on-surface-variant">Äá»•i email, tÃªn hiá»ƒn thá»‹, máº­t kháº©u, tráº¡ng thÃ¡i vÃ  phÃ¢n quyá»n.</p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-on-surface">Email Ä‘Äƒng nháº­p</label>
              <input required type="email" className="input-field" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-on-surface">TÃªn hiá»ƒn thá»‹</label>
              <input required className="input-field" value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-on-surface">{editing ? "Máº­t kháº©u má»›i (bá» trá»‘ng náº¿u giá»¯ nguyÃªn)" : "Máº­t kháº©u"}</label>
              <input type="password" className="input-field" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} minLength={editing ? undefined : 6} />
            </div>

            {editing && currentIsSuperAdmin && (
              <label className="flex items-start gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3 text-sm">
                <input type="checkbox" className="mt-1" checked={form.status !== "blocked"} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.checked ? "active" : "blocked" }))} disabled={form.userId === currentAdminId} />
                <span><span className="font-extrabold text-on-surface">TÃ i khoáº£n hoáº¡t Ä‘á»™ng</span><span className="mt-1 block text-xs leading-5 text-on-surface-variant">Táº¯t Ä‘á»ƒ khÃ³a Ä‘Äƒng nháº­p vÃ  cháº·n thao tÃ¡c quáº£n trá»‹ cá»§a admin nÃ y.</span></span>
              </label>
            )}

            <label className="flex items-start gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={form.isSuperAdmin} onChange={(event) => setForm((prev) => ({ ...prev, isSuperAdmin: event.target.checked }))} disabled={!currentIsSuperAdmin} />
              <span><span className="flex items-center gap-2 font-extrabold text-on-surface"><Crown className="h-4 w-4 text-primary" />Super Admin</span><span className="mt-1 block text-xs leading-5 text-on-surface-variant">Super Admin cÃ³ toÃ n quyá»n quáº£n lÃ½ admin khÃ¡c vÃ  cÃ¡c thiáº¿t láº­p báº£o máº­t.</span></span>
            </label>

            {currentIsSuperAdmin && (
              <div className="space-y-3 rounded-lg border border-outline-variant/30 p-3">
                <div><p className="text-sm font-extrabold text-on-surface">PhÃ¢n quyá»n module</p><p className="mt-1 text-xs leading-5 text-on-surface-variant">Quyá»n xem má»Ÿ menu/trang. Quyá»n sá»­a cho phÃ©p táº¡o, sá»­a, duyá»‡t hoáº·c ghi nháº­n dá»¯ liá»‡u.</p></div>
                <div className="space-y-2">
                  {ADMIN_MODULES.map((module) => {
                    const permission = form.permissions.find((item) => item.module === module.key) || { module: module.key, can_view: true, can_manage: true };
                    return (
                      <div key={module.key} className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
                        <div className="min-w-0"><p className="text-sm font-bold text-on-surface">{module.label}</p><p className="truncate text-xs text-on-surface-variant">{module.description}</p></div>
                        <label className="flex items-center justify-center gap-1 text-xs font-bold text-on-surface-variant"><input type="checkbox" checked={permission.can_view || permission.can_manage} onChange={(event) => updatePermission(module.key, { can_view: event.target.checked })} />Xem</label>
                        <label className="flex items-center justify-center gap-1 text-xs font-bold text-on-surface-variant"><input type="checkbox" checked={permission.can_manage} onChange={(event) => updatePermission(module.key, { can_manage: event.target.checked, can_view: event.target.checked ? true : permission.can_view })} />Sá»­a</label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-3 border-t border-outline-variant/30 pt-4">
            {editing && <button type="button" onClick={startCreate} className="btn-outline !w-auto !px-4 !py-2" disabled={saving}>Há»§y</button>}
            <button className="btn-primary !w-auto !px-5 !py-2" disabled={saving}>{saving ? "Äang lÆ°u..." : <><LockKeyhole className="h-4 w-4" />{editing ? "LÆ°u thay Ä‘á»•i" : "Táº¡o admin"}</>}</button>
          </div>
        </form>
      </div>

      <section className="rounded-lg border border-outline-variant/30 bg-white">
        <div className="border-b border-outline-variant/30 p-4"><h2 className="text-lg font-extrabold text-on-surface">Nháº­t kÃ½ thao tÃ¡c</h2><p className="mt-1 text-xs text-on-surface-variant">50 hÃ nh Ä‘á»™ng admin gáº§n nháº¥t liÃªn quan Ä‘áº¿n tÃ i khoáº£n, báº£o máº­t vÃ  phÃ¢n quyá»n.</p></div>
        <div className="divide-y divide-outline-variant/20">
          {auditLogs.length === 0 ? <div className="p-4 text-sm text-on-surface-variant">ChÆ°a cÃ³ nháº­t kÃ½ thao tÃ¡c.</div> : auditLogs.map((log) => (
            <div key={log.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-extrabold text-on-surface">{log.summary}</p><p className="mt-1 text-xs text-on-surface-variant">{log.actor?.full_name || log.actor?.email || "Admin"} â†’ {log.target?.full_name || log.target?.email || "Há»‡ thá»‘ng"}</p></div><span className="rounded-full bg-surface-container-high px-2 py-1 text-[10px] font-extrabold uppercase text-on-surface-variant">{log.action}</span></div>
              <p className="mt-2 text-xs text-on-surface-variant">{log.created_at ? new Date(log.created_at).toLocaleString("vi-VN") : "ChÆ°a cÃ³ thá»i gian"}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
