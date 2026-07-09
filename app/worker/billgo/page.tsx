"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Plus, RefreshCw, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  BILLGO_CYCLE_OPTIONS,
  BillGoCycle,
  formatBillGoCurrency,
  getBillGoNextDueDate,
  getBillGoReceivableSummary,
} from "@/lib/billgo";

type Payment = {
  id: string;
  amount: number | string;
  method: string;
  status: string;
  paid_at?: string | null;
};

type Receivable = {
  id: string;
  customer_id?: string | null;
  title?: string | null;
  total_amount?: number | string | null;
  due_date?: string | null;
  period_start?: string | null;
  status?: string | null;
  customer?: { full_name?: string | null; address?: string | null } | null;
  subscription?: {
    id?: string;
    customer_name?: string | null;
    internet_account?: string | null;
    customer_address?: string | null;
    package_name?: string | null;
    cycle?: string | null;
  } | null;
  payments?: Payment[] | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function WorkerBillGoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    customerName: "",
    account: "",
    address: "",
    packageName: "",
    amount: "",
    cycle: "monthly" as BillGoCycle,
    startDate: today(),
    collectionStatus: "unpaid" as "unpaid" | "paid",
  });

  const fetchBillGo = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: worker } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!worker) {
      setMessage("Không tìm thấy hồ sơ thợ.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("billgo_receivables")
      .select("id, customer_id, title, total_amount, due_date, period_start, status, customer:profiles!customer_id(full_name, address), subscription:billgo_subscriptions(id, customer_name, internet_account, customer_address, package_name, cycle), payments(id, amount, method, status, paid_at)")
      .eq("worker_id", worker.id)
      .not("subscription_id", "is", null)
      .neq("status", "cancelled")
      .order("due_date", { ascending: true });

    if (error) {
      setMessage("Không thể tải BillGo: " + error.message);
      setRows([]);
    } else {
      setRows((data || []) as Receivable[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchBillGo(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchBillGo]);

  const computedRows = useMemo(
    () => rows.map(item => ({ item, summary: getBillGoReceivableSummary(item) })),
    [rows]
  );
  const totals = useMemo(
    () => computedRows.reduce((acc, row) => {
      acc.receivable += row.summary.receivable;
      acc.paid += row.summary.paid;
      acc.debt += row.summary.debt;
      if (row.summary.debt > 0) acc.customersToCollect += 1;
      return acc;
    }, { customersToCollect: 0, receivable: 0, paid: 0, debt: 0 }),
    [computedRows]
  );
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    if (!normalized) return computedRows;
    return computedRows.filter(({ item }) => [
      item.subscription?.customer_name,
      item.customer?.full_name,
      item.subscription?.internet_account,
      item.subscription?.customer_address,
      item.customer?.address,
      item.subscription?.package_name,
    ].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(normalized));
  }, [computedRows, query]);
  const unpaidRows = filteredRows.filter(row => row.summary.debt > 0);
  const paidRows = filteredRows.filter(row => row.summary.debt <= 0);

  const submitCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/billgo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể tạo khách thu cước.");
      setForm({
        customerName: "",
        account: "",
        address: "",
        packageName: "",
        amount: "",
        cycle: "monthly",
        startDate: today(),
        collectionStatus: "unpaid",
      });
      setShowForm(false);
      setMessage("Đã thêm khách thu cước vào BillGo.");
      await fetchBillGo();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo khách thu cước.");
    } finally {
      setSaving(false);
    }
  };

  const renderList = (title: string, list: typeof filteredRows, paid: boolean) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-on-surface">{title}</h2>
        <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-bold">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant bg-white p-8 text-center text-sm text-on-surface-variant">
          Chưa có khách trong danh sách này.
        </div>
      ) : list.map(({ item, summary }) => (
        <article key={item.id} className="rounded-lg border border-outline-variant/50 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-extrabold text-on-surface">
                {item.subscription?.customer_name || item.customer?.full_name || "Khách thu cước"}
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Account: {item.subscription?.internet_account || "Chưa có"}
              </p>
              <p className="text-sm text-on-surface-variant">{item.subscription?.package_name || item.title}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${paid ? "bg-success-container text-success" : "bg-error-container text-error"}`}>
              {paid ? "Đã thu" : "Chưa thu"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-surface-container-low p-3">Cần thu<br /><strong>{formatBillGoCurrency(summary.receivable)}</strong></div>
            <div className="rounded-lg bg-surface-container-low p-3">Còn lại<br /><strong className="text-error">{formatBillGoCurrency(summary.debt)}</strong></div>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">
            Ngày thu: {item.due_date ? new Date(item.due_date).toLocaleDateString("vi-VN") : "Chưa có"}
            {" · "}{item.subscription?.customer_address || item.customer?.address || "Chưa có địa chỉ"}
          </p>
        </article>
      ))}
    </section>
  );

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-surface p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Thu cước định kỳ</p>
          <h1 className="text-2xl font-extrabold text-on-surface">BillGo</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" title="Tải lại" onClick={() => void fetchBillGo()} className="btn-outline !w-auto !p-3">
            <RefreshCw size={18} />
          </button>
          <button type="button" onClick={() => setShowForm(value => !value)} className="btn-primary !w-auto inline-flex items-center gap-2 !px-4">
            <Plus size={18} /> Thêm khách thu cước
          </button>
        </div>
      </header>

      {message && <div className="mt-4 rounded-lg bg-primary-fixed p-3 text-sm font-bold text-primary">{message}</div>}

      {showForm && (
        <form onSubmit={submitCustomer} className="mt-4 rounded-lg border border-outline-variant/50 bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-extrabold">Thêm khách thu cước</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input required className="input-field" placeholder="Tên khách hàng" value={form.customerName} onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))} />
            <input required className="input-field" placeholder="Account" value={form.account} onChange={e => setForm(prev => ({ ...prev, account: e.target.value }))} />
            <input required className="input-field sm:col-span-2" placeholder="Địa chỉ" value={form.address} onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} />
            <input required className="input-field" placeholder="Gói cước" value={form.packageName} onChange={e => setForm(prev => ({ ...prev, packageName: e.target.value }))} />
            <input required type="number" min="0" className="input-field" placeholder="Số tiền cần thu" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} />
            <select className="input-field" value={form.cycle} onChange={e => setForm(prev => ({ ...prev, cycle: e.target.value as BillGoCycle }))}>
              {BILLGO_CYCLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input required type="date" className="input-field" value={form.startDate} onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))} />
            <select className="input-field" value={form.collectionStatus} onChange={e => setForm(prev => ({ ...prev, collectionStatus: e.target.value as "unpaid" | "paid" }))}>
              <option value="unpaid">Chưa thu</option>
              <option value="paid">Đã thu</option>
            </select>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">
            Kỳ tiếp theo dự kiến: {getBillGoNextDueDate(form.startDate, form.cycle)}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-outline !w-auto">Hủy</button>
            <button disabled={saving} className="btn-primary !w-auto">{saving ? "Đang lưu..." : "Thêm vào BillGo"}</button>
          </div>
        </form>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Khách cần thu", String(totals.customersToCollect), CircleDollarSign],
          ["Số tiền cần thu", formatBillGoCurrency(totals.receivable), CircleDollarSign],
          ["Đã thu", formatBillGoCurrency(totals.paid), CheckCircle2],
          ["Còn lại", formatBillGoCurrency(totals.debt), CircleDollarSign],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-lg border border-outline-variant/40 bg-white p-4">
            <Icon size={18} className="text-primary" />
            <p className="mt-3 text-xs font-bold uppercase text-on-surface-variant">{label as string}</p>
            <p className="mt-1 text-lg font-extrabold text-on-surface">{value as string}</p>
          </div>
        ))}
      </div>

      <label className="relative mt-4 block">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input className="input-field !pl-10" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, account, địa chỉ, gói cước..." />
      </label>

      {loading ? (
        <div className="py-16 text-center text-sm text-on-surface-variant">Đang tải BillGo...</div>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          {renderList("Khách chưa thu", unpaidRows, false)}
          {renderList("Khách đã thu", paidRows, true)}
        </div>
      )}
    </div>
  );
}
