"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BILLGO_CYCLE_OPTIONS,
  BillGoCycle,
  formatBillGoCurrency,
  getBillGoCycleOption,
  getBillGoNextDueDate,
  getBillGoPeriodEndDate,
  getBillGoReceivableSummary,
  toBillGoDateInput,
  toMoneyNumber,
} from "@/lib/billgo";

type PaymentRow = {
  id: string;
  amount: number | string;
  method: string;
  status: string;
  paid_at?: string | null;
  collected_by?: string | null;
  note?: string | null;
};

type CustomerOption = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
};

type WorkerOption = {
  id: string;
  profiles?: { full_name?: string | null } | null;
};

type ServiceOption = {
  id: string;
  name?: string | null;
};

type BillGoSubscription = {
  id: string;
  package_name?: string | null;
  cycle?: string | null;
  amount_per_cycle?: number | string | null;
  next_due_date?: string | null;
  status?: string | null;
};

type BillGoReceivable = {
  id: string;
  customer_id: string;
  worker_id?: string | null;
  job_id?: string | null;
  subscription_id?: string | null;
  type?: string | null;
  title?: string | null;
  total_amount?: number | string | null;
  due_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  billing_months?: number | null;
  bonus_months?: number | null;
  status?: string | null;
  note?: string | null;
  customer?: CustomerOption | null;
  worker?: WorkerOption | null;
  subscription?: BillGoSubscription | null;
  payments?: PaymentRow[] | null;
};

const methodLabels: Record<string, string> = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
  card: "Thẻ",
  momo: "MoMo",
  zalopay: "ZaloPay",
  other: "Khác",
};

const typeLabels: Record<string, string> = {
  installation_fee: "Phí lắp đặt",
  subscription_fee: "Cước Internet",
  service_fee: "Dịch vụ",
  other: "Khác",
};

const getTodayInput = () => toBillGoDateInput(new Date());

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Không xác định";

const firstRelation = <T,>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? value[0] || null : value || null;

const normalizeReceivableRows = (rows: unknown[]): BillGoReceivable[] =>
  rows.map((row) => {
    const item = row as BillGoReceivable & {
      customer?: CustomerOption | CustomerOption[] | null;
      worker?: WorkerOption | WorkerOption[] | null;
      subscription?: BillGoSubscription | BillGoSubscription[] | null;
    };

    return {
      ...item,
      customer: firstRelation(item.customer),
      worker: firstRelation(item.worker),
      subscription: firstRelation(item.subscription),
    };
  });

const getReceivableNextStatus = (total: number, paid: number, dueDate?: string | null) => {
  const debt = Math.max(total - paid, 0);
  const dueTime = dueDate ? new Date(dueDate).getTime() : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (total > 0 && debt <= 0) return "paid";
  if (paid > 0 && debt > 0) return "partial";
  if (dueTime !== null && dueTime < today.getTime() && debt > 0) return "overdue";
  return "unpaid";
};

export default function AdminPayments() {
  const supabase = useMemo(() => createClient(), []);
  const [receivables, setReceivables] = useState<BillGoReceivable[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedReceivableId, setSelectedReceivableId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("debt");

  const [newBill, setNewBill] = useState({
    customerId: "",
    workerId: "",
    serviceId: "",
    packageName: "Cước Internet",
    monthlyFee: "",
    setupFee: "",
    cycle: "monthly" as BillGoCycle,
    startDate: getTodayInput(),
    paidAmount: "",
    note: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    cycle: "monthly" as BillGoCycle,
    note: "",
  });

  const fetchBillGo = async () => {
    setLoading(true);
    setMessage("");

    const [receivableRes, customerRes, workerRes, serviceRes] = await Promise.all([
      supabase
        .from("billgo_receivables")
        .select("id, customer_id, worker_id, job_id, subscription_id, type, title, total_amount, due_date, period_start, period_end, billing_months, bonus_months, status, note, customer:profiles!customer_id(id, full_name, phone, address), worker:workers(id, profiles(full_name)), subscription:billgo_subscriptions(id, package_name, cycle, amount_per_cycle, next_due_date, status), payments(id, amount, method, status, paid_at, collected_by, note)")
        .order("due_date", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name, phone, address")
        .eq("role", "customer")
        .order("full_name", { ascending: true }),
      supabase
        .from("workers")
        .select("id, profiles(full_name)")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    if (receivableRes.error) {
      setMessage("Không thể tải BillGo. Nếu chưa chạy DB migration, hãy chạy supabase/migration_billgo_subscriptions.sql. Chi tiết: " + receivableRes.error.message);
      setReceivables([]);
    } else {
      setReceivables(normalizeReceivableRows(receivableRes.data || []));
    }

    if (!customerRes.error) setCustomers((customerRes.data || []) as CustomerOption[]);
    if (!workerRes.error) setWorkers((workerRes.data || []) as WorkerOption[]);
    if (!serviceRes.error) setServices((serviceRes.data || []) as ServiceOption[]);
    setLoading(false);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchBillGo();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const receivableRows = useMemo(() => receivables.map(item => ({
    item,
    summary: getBillGoReceivableSummary(item),
  })), [receivables]);

  const totals = useMemo(() => receivableRows.reduce(
    (acc, row) => {
      acc.receivable += row.summary.receivable;
      acc.paid += row.summary.paid;
      acc.debt += row.summary.debt;
      if (row.summary.debt > 0) acc.customerIds.add(row.item.customer_id);
      if (row.summary.status === "overdue") acc.overdue += 1;

      const dueTime = row.item.due_date ? new Date(row.item.due_date).getTime() : null;
      if (row.summary.debt > 0 && dueTime !== null) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDays = today.getTime() + 7 * 24 * 60 * 60 * 1000;
        if (dueTime >= today.getTime() && dueTime <= sevenDays) acc.upcoming += 1;
      }

      return acc;
    },
    { receivable: 0, paid: 0, debt: 0, overdue: 0, upcoming: 0, customerIds: new Set<string>() }
  ), [receivableRows]);

  const filteredRows = useMemo(() => {
    return receivableRows.filter(row => {
      const dueTime = row.item.due_date ? new Date(row.item.due_date).getTime() : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDays = today.getTime() + 7 * 24 * 60 * 60 * 1000;

      if (statusFilter === "overdue") return row.summary.status === "overdue";
      if (statusFilter === "upcoming") return row.summary.debt > 0 && dueTime !== null && dueTime >= today.getTime() && dueTime <= sevenDays;
      if (statusFilter === "paid") return row.summary.status === "paid";
      if (statusFilter === "debt") return row.summary.debt > 0;
      return true;
    });
  }, [receivableRows, statusFilter]);

  const selectedReceivable = receivables.find(item => item.id === selectedReceivableId) || null;
  const selectedSummary = selectedReceivable ? getBillGoReceivableSummary(selectedReceivable) : null;

  const updateNewBill = (field: keyof typeof newBill, value: string) => {
    setNewBill(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateInternetBill = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!newBill.customerId) {
      setMessage("Vui lòng chọn khách hàng có sẵn trong hệ thống.");
      return;
    }

    const monthlyFee = toMoneyNumber(newBill.monthlyFee);
    const setupFee = toMoneyNumber(newBill.setupFee);
    const paidAmount = toMoneyNumber(newBill.paidAmount);
    if (monthlyFee <= 0 && setupFee <= 0) {
      setMessage("Vui lòng nhập cước Internet hoặc phí lắp đặt.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cycle = getBillGoCycleOption(newBill.cycle);
      const periodEnd = getBillGoPeriodEndDate(newBill.startDate, newBill.cycle);
      const nextDueDate = getBillGoNextDueDate(newBill.startDate, newBill.cycle);
      const subscriptionAmount = monthlyFee * cycle.paidMonths;
      const totalAmount = setupFee + subscriptionAmount;
      const status = getReceivableNextStatus(totalAmount, paidAmount, nextDueDate);

      const { data: subscription, error: subscriptionError } = await supabase
        .from("billgo_subscriptions")
        .insert({
          customer_id: newBill.customerId,
          worker_id: newBill.workerId || null,
          service_id: newBill.serviceId || null,
          package_name: newBill.packageName.trim() || "Cước Internet",
          service_type: "internet",
          cycle: newBill.cycle,
          amount_per_cycle: monthlyFee,
          start_date: newBill.startDate,
          next_due_date: nextDueDate,
          status: "active",
          note: newBill.note.trim() || null,
          created_by: user?.id || null,
        })
        .select("id")
        .single();

      if (subscriptionError) throw subscriptionError;

      const { data: receivable, error: receivableError } = await supabase
        .from("billgo_receivables")
        .insert({
          customer_id: newBill.customerId,
          worker_id: newBill.workerId || null,
          subscription_id: subscription.id,
          type: "subscription_fee",
          title: `${newBill.packageName.trim() || "Cước Internet"} - ${cycle.label}`,
          total_amount: totalAmount,
          due_date: nextDueDate,
          period_start: newBill.startDate,
          period_end: periodEnd,
          billing_months: cycle.paidMonths,
          bonus_months: cycle.bonusMonths,
          status,
          note: [
            setupFee > 0 ? `Phí lắp đặt: ${formatBillGoCurrency(setupFee)}` : "",
            monthlyFee > 0 ? `Cước: ${formatBillGoCurrency(monthlyFee)}/tháng` : "",
            newBill.note.trim(),
          ].filter(Boolean).join(" · ") || null,
          created_by: user?.id || null,
        })
        .select("id")
        .single();

      if (receivableError) throw receivableError;

      if (paidAmount > 0) {
        const { error: paymentError } = await supabase.from("payments").insert({
          receivable_id: receivable.id,
          amount: paidAmount,
          method: "cash",
          status: "paid",
          paid_at: new Date().toISOString(),
          collected_by: user?.id || null,
          note: "Thanh toán ban đầu khi tạo BillGo",
        });
        if (paymentError) throw paymentError;
      }

      setNewBill({
        customerId: "",
        workerId: "",
        serviceId: "",
        packageName: "Cước Internet",
        monthlyFee: "",
        setupFee: "",
        cycle: "monthly",
        startDate: getTodayInput(),
        paidAmount: "",
        note: "",
      });
      setMessage("Đã tạo khoản thu cước Internet trong BillGo.");
      await fetchBillGo();
    } catch (error: unknown) {
      setMessage("Không thể tạo BillGo: " + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!selectedReceivable) {
      setMessage("Vui lòng chọn khoản cần thu.");
      return;
    }

    const paidAmount = toMoneyNumber(paymentForm.amount);
    if (paidAmount <= 0) {
      setMessage("Số tiền thu phải lớn hơn 0.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cycle = getBillGoCycleOption(paymentForm.cycle);
      const baseDate = selectedReceivable.period_start || selectedReceivable.due_date || getTodayInput();
      const periodEnd = getBillGoPeriodEndDate(baseDate, paymentForm.cycle);
      const nextDueDate = getBillGoNextDueDate(baseDate, paymentForm.cycle);
      const currentPaid = getBillGoReceivableSummary(selectedReceivable).paid;
      const nextPaid = currentPaid + paidAmount;
      const totalAmount = toMoneyNumber(selectedReceivable.total_amount);
      const nextStatus = getReceivableNextStatus(totalAmount, nextPaid, selectedReceivable.due_date);

      const { error: paymentError } = await supabase.from("payments").insert({
        receivable_id: selectedReceivable.id,
        job_id: selectedReceivable.job_id || null,
        amount: paidAmount,
        method: paymentForm.method,
        status: "paid",
        paid_at: new Date().toISOString(),
        collected_by: user?.id || null,
        note: [
          `Thu ${cycle.label}`,
          paymentForm.note.trim(),
        ].filter(Boolean).join(" · ") || null,
      });

      if (paymentError) throw paymentError;

      const { error: receivableError } = await supabase
        .from("billgo_receivables")
        .update({
          status: nextStatus,
          billing_months: cycle.paidMonths,
          bonus_months: cycle.bonusMonths,
          period_end: periodEnd,
        })
        .eq("id", selectedReceivable.id);

      if (receivableError) throw receivableError;

      if (selectedReceivable.subscription_id) {
        const { error: subscriptionError } = await supabase
          .from("billgo_subscriptions")
          .update({
            cycle: paymentForm.cycle,
            next_due_date: nextDueDate,
          })
          .eq("id", selectedReceivable.subscription_id);
        if (subscriptionError) throw subscriptionError;
      }

      setPaymentForm({ amount: "", method: "cash", cycle: "monthly", note: "" });
      setMessage("Đã ghi nhận thanh toán BillGo.");
      await fetchBillGo();
    } catch (error: unknown) {
      setMessage("Không thể ghi nhận thanh toán: " + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">BillGo</p>
          <h1 className="text-headline-md text-on-surface">Công nợ & Thu cước</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Quản lý khoản phải thu, thu cước Internet định kỳ và lịch nhắc đóng tiền.
          </p>
        </div>
        <button type="button" onClick={() => void fetchBillGo()} className="btn-secondary !w-auto !py-2.5 text-sm">
          Tải lại
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-primary/15 bg-primary-fixed/50 p-3 text-sm font-bold text-primary">
          {message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Khách cần thu</p>
          <p className="mt-2 text-xl font-extrabold text-on-surface">{totals.customerIds.size}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Tổng cần thu</p>
          <p className="mt-2 text-lg font-extrabold text-on-surface">{formatBillGoCurrency(totals.receivable)}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Đã thu</p>
          <p className="mt-2 text-lg font-extrabold text-success">{formatBillGoCurrency(totals.paid)}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Còn lại</p>
          <p className="mt-2 text-lg font-extrabold text-error">{formatBillGoCurrency(totals.debt)}</p>
        </div>
        <div className="rounded-lg border border-error/20 bg-error-container p-4">
          <p className="text-[10px] font-bold uppercase text-error/75">Quá hạn</p>
          <p className="mt-2 text-xl font-extrabold text-error">{totals.overdue}</p>
        </div>
        <div className="rounded-lg border border-warning/20 bg-warning-container p-4">
          <p className="text-[10px] font-bold uppercase text-warning/75">Sắp đến hạn</p>
          <p className="mt-2 text-xl font-extrabold text-warning">{totals.upcoming}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <form onSubmit={handleCreateInternetBill} className="rounded-lg border border-outline-variant/30 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-on-surface">Thêm khách thu cước Internet</h2>
              <span className="text-xs font-bold text-on-surface-variant">Không tạo khách trùng, chỉ chọn khách đã có.</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select className="input-field" value={newBill.customerId} onChange={event => updateNewBill("customerId", event.target.value)} disabled={saving}>
                <option value="">Chọn khách hàng</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name || "Khách hàng"} {customer.phone ? `- ${customer.phone}` : ""}
                  </option>
                ))}
              </select>
              <select className="input-field" value={newBill.workerId} onChange={event => updateNewBill("workerId", event.target.value)} disabled={saving}>
                <option value="">Chưa phân công thợ/nhân viên</option>
                {workers.map(worker => (
                  <option key={worker.id} value={worker.id}>{worker.profiles?.full_name || worker.id.slice(0, 8)}</option>
                ))}
              </select>
              <select className="input-field" value={newBill.serviceId} onChange={event => updateNewBill("serviceId", event.target.value)} disabled={saving}>
                <option value="">Dịch vụ BillGo</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>{service.name || "Dịch vụ"}</option>
                ))}
              </select>
              <input className="input-field" value={newBill.packageName} onChange={event => updateNewBill("packageName", event.target.value)} placeholder="Tên gói cước" disabled={saving} />
              <input className="input-field" type="number" min="0" value={newBill.monthlyFee} onChange={event => updateNewBill("monthlyFee", event.target.value)} placeholder="Cước Internet / tháng" disabled={saving} />
              <input className="input-field" type="number" min="0" value={newBill.setupFee} onChange={event => updateNewBill("setupFee", event.target.value)} placeholder="Phí lắp đặt nếu có" disabled={saving} />
              <select className="input-field" value={newBill.cycle} onChange={event => updateNewBill("cycle", event.target.value)} disabled={saving}>
                {BILLGO_CYCLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input className="input-field" type="date" value={newBill.startDate} onChange={event => updateNewBill("startDate", event.target.value)} disabled={saving} />
              <input className="input-field" type="number" min="0" value={newBill.paidAmount} onChange={event => updateNewBill("paidAmount", event.target.value)} placeholder="Số tiền đã thu ban đầu" disabled={saving} />
              <input className="input-field" value={newBill.note} onChange={event => updateNewBill("note", event.target.value)} placeholder="Ghi chú" disabled={saving} />
            </div>
            <div className="mt-3 rounded-lg bg-surface-container-low p-3 text-xs text-on-surface-variant">
              Ngày nhắc tiếp theo: <strong>{getBillGoNextDueDate(newBill.startDate, newBill.cycle)}</strong>
              {newBill.cycle === "yearly" && <span className="ml-2 font-bold text-success">Đã cộng 1 tháng tặng.</span>}
            </div>
            <button className="btn-primary mt-4 w-full md:w-auto" disabled={saving}>{saving ? "Đang lưu..." : "Thêm khách thu"}</button>
          </form>

          <div className="rounded-lg border border-outline-variant/30 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 p-4">
              <h2 className="text-lg font-extrabold text-on-surface">Danh sách công nợ</h2>
              <div className="flex flex-wrap gap-1 rounded-lg bg-surface-container-low p-1 text-xs font-bold">
                {[
                  ["debt", "Còn nợ"],
                  ["upcoming", "Sắp đến hạn"],
                  ["overdue", "Quá hạn"],
                  ["paid", "Đã thu đủ"],
                  ["all", "Tất cả"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    className={`rounded-md px-3 py-2 ${statusFilter === value ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-outline-variant/20">
              {loading ? (
                <div className="p-6 text-sm text-on-surface-variant">Đang tải BillGo...</div>
              ) : filteredRows.length === 0 ? (
                <div className="p-6 text-sm text-on-surface-variant">Không có khoản phù hợp.</div>
              ) : filteredRows.map(({ item, summary }) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedReceivableId(item.id)}
                  className={`block w-full p-4 text-left transition-colors hover:bg-surface-container-lowest ${selectedReceivableId === item.id ? "bg-primary-fixed/50" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-on-surface">{item.customer?.full_name || "Khách hàng"} · {item.title || "Khoản thu"}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{item.customer?.phone || "Chưa có SĐT"} · {typeLabels[item.type || "other"] || "Khoản thu"}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">Hạn tiếp theo: {item.due_date || item.subscription?.next_due_date || "Chưa có"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${summary.status === "overdue" ? "bg-error-container text-error" : summary.status === "paid" ? "bg-success-container text-success" : "bg-warning-container text-warning"}`}>
                        {summary.statusLabel}
                      </span>
                      <p className="mt-2 text-sm font-bold text-on-surface">Còn: {formatBillGoCurrency(summary.debt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <span>Phải thu<br /><strong>{formatBillGoCurrency(summary.receivable)}</strong></span>
                    <span>Đã thu<br /><strong className="text-success">{formatBillGoCurrency(summary.paid)}</strong></span>
                    <span>Lần thu<br /><strong>{item.payments?.filter(payment => payment.status === "paid").length || 0}</strong></span>
                  </div>
                  {item.note && <p className="mt-2 line-clamp-2 text-xs text-on-surface-variant">{item.note}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <form onSubmit={handleSavePayment} className="rounded-lg border border-outline-variant/30 bg-white p-4">
            <h2 className="text-lg font-extrabold text-on-surface">Ghi nhận thanh toán</h2>
            {selectedReceivable && selectedSummary ? (
              <div className="mt-3 rounded-lg bg-surface-container-low p-3 text-xs">
                <p className="font-bold text-on-surface">{selectedReceivable.customer?.full_name || "Khách hàng"}</p>
                <p className="mt-1 text-on-surface-variant">Còn lại: <strong className="text-error">{formatBillGoCurrency(selectedSummary.debt)}</strong></p>
                <p className="mt-1 text-on-surface-variant">Ngày nhắc: {selectedReceivable.due_date || "Chưa có"}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-on-surface-variant">Chọn một khoản thu để ghi nhận thanh toán.</p>
            )}

            <div className="mt-4 space-y-3">
              <select className="input-field" value={paymentForm.cycle} onChange={event => setPaymentForm(prev => ({ ...prev, cycle: event.target.value as BillGoCycle }))} disabled={!selectedReceivable || saving}>
                {BILLGO_CYCLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input className="input-field" type="number" min="0" value={paymentForm.amount} onChange={event => setPaymentForm(prev => ({ ...prev, amount: event.target.value }))} placeholder="Số tiền đã thu" disabled={!selectedReceivable || saving} />
              <select className="input-field" value={paymentForm.method} onChange={event => setPaymentForm(prev => ({ ...prev, method: event.target.value }))} disabled={!selectedReceivable || saving}>
                {Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <textarea className="input-field min-h-20" value={paymentForm.note} onChange={event => setPaymentForm(prev => ({ ...prev, note: event.target.value }))} placeholder="Ghi chú" disabled={!selectedReceivable || saving} />
              {selectedReceivable && (
                <div className="rounded-lg bg-surface-container-low p-3 text-xs text-on-surface-variant">
                  Sau khi thu kỳ này, ngày nhắc dự kiến: <strong>{getBillGoNextDueDate(selectedReceivable.period_start || selectedReceivable.due_date || getTodayInput(), paymentForm.cycle)}</strong>
                </div>
              )}
              <button className="btn-primary w-full" disabled={!selectedReceivable || saving}>{saving ? "Đang lưu..." : "Ghi nhận thanh toán"}</button>
            </div>
          </form>

          <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
            <h2 className="text-lg font-extrabold text-on-surface">Lịch sử thanh toán</h2>
            <div className="mt-3 space-y-2">
              {!selectedReceivable ? (
                <p className="text-sm text-on-surface-variant">Chọn khoản thu để xem lịch sử.</p>
              ) : (selectedReceivable.payments || []).filter(payment => payment.status === "paid").length === 0 ? (
                <p className="text-sm text-on-surface-variant">Chưa có lần thu nào.</p>
              ) : (
                (selectedReceivable.payments || []).filter(payment => payment.status === "paid").map(payment => (
                  <div key={payment.id} className="rounded-lg bg-surface-container-low p-3 text-xs">
                    <div className="flex justify-between gap-3">
                      <strong>{formatBillGoCurrency(payment.amount)}</strong>
                      <span>{methodLabels[payment.method] || payment.method}</span>
                    </div>
                    <p className="mt-1 text-on-surface-variant">{payment.paid_at ? new Date(payment.paid_at).toLocaleString("vi-VN") : "Chưa có ngày"}</p>
                    {payment.note && <p className="mt-1 text-on-surface">{payment.note}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
