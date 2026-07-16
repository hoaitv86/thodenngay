"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BILLGO_CYCLE_OPTIONS,
  BillGoCycle,
  buildBillGoCoverageMonths,
  formatBillGoCurrency,
  getBillGoBillingParts,
  getBillGoBillingPeriod,
  getBillGoCycleOption,
  getBillGoNextDueDate,
  getBillGoNextPeriodStartDate,
  getBillGoReceivableSummary,
  getBillGoStoredStatus,
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
  customer_id?: string | null;
  deleted_at?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  internet_account?: string | null;
  customer_address?: string | null;
  package_name?: string | null;
  cycle?: string | null;
  current_cycle?: string | null;
  amount_per_cycle?: number | string | null;
  monthly_fee?: number | string | null;
  next_due_date?: string | null;
  next_period_start?: string | null;
  covered_until?: string | null;
  status?: string | null;
};

type BillGoCustomerSource = BillGoSubscription & {
  customer?: CustomerOption | CustomerOption[] | null;
};

type BillGoReceivable = {
  id: string;
  customer_id?: string | null;
  worker_id?: string | null;
  job_id?: string | null;
  subscription_id?: string | null;
  type?: string | null;
  title?: string | null;
  total_amount?: number | string | null;
  due_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  collection_month?: string | null;
  usage_month?: string | null;
  billing_month?: number | null;
  billing_year?: number | null;
  cycle_at_collection?: string | null;
  billing_months?: number | null;
  bonus_months?: number | null;
  service_months?: number | null;
  paid_amount?: number | string | null;
  monthly_fee_at_collection?: number | string | null;
  next_period_start?: string | null;
  next_due_date?: string | null;
  status?: string | null;
  deleted_at?: string | null;
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

const normalizeBillGoCustomerOptions = (rows: BillGoCustomerSource[]): CustomerOption[] => {
  const customerMap = new Map<string, CustomerOption>();
  rows.forEach((row) => {
    const profile = firstRelation(row.customer);
    const id = row.customer_id;
    if (!id || customerMap.has(id)) return;
    customerMap.set(id, {
      id,
      full_name: row.customer_name || profile?.full_name || row.internet_account || row.package_name || "Khách BillGo",
      phone: row.phone || profile?.phone || null,
      address: row.customer_address || profile?.address || null,
    });
  });
  return [...customerMap.values()].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "vi"));
};

const getBillGoCustomerName = (item: BillGoReceivable) =>
  item.subscription?.customer_name || item.customer?.full_name || item.subscription?.internet_account || "Khách BillGo";

const getBillGoCustomerPhone = (item: BillGoReceivable) =>
  item.subscription?.phone || item.customer?.phone || "Chưa có SĐT";

const isPausedBillGoCustomer = (item: BillGoReceivable) => item.subscription?.status === "paused";

const getBillGoDisplayStatus = (item: BillGoReceivable, summary: ReturnType<typeof getBillGoReceivableSummary>) =>
  isPausedBillGoCustomer(item) ? "Ngừng thu" : summary.statusLabel;

const getBillGoStatusClassName = (item: BillGoReceivable, summary: ReturnType<typeof getBillGoReceivableSummary>) => {
  if (isPausedBillGoCustomer(item)) return "bg-surface-container-high text-on-surface-variant";
  if (summary.status === "overdue") return "bg-error-container text-error";
  if (summary.status === "paid") return "bg-success-container text-success";
  return "bg-warning-container text-warning";
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
      provider: "",
      internetAccount: "",
      internetPassword: "",
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

    const [receivableRes, billGoCustomerRes, workerRes, serviceRes] = await Promise.all([
      supabase
        .from("billgo_receivables")
        .select("id, customer_id, worker_id, job_id, subscription_id, type, title, total_amount, due_date, period_start, period_end, collection_month, usage_month, billing_month, billing_year, cycle_at_collection, billing_months, bonus_months, service_months, paid_amount, monthly_fee_at_collection, next_period_start, next_due_date, status, deleted_at, note, customer:profiles!customer_id(id, full_name, phone, address), worker:workers(id, profiles(full_name)), subscription:billgo_subscriptions!inner(id, customer_id, customer_name, phone, internet_account, customer_address, package_name, cycle, current_cycle, amount_per_cycle, monthly_fee, next_due_date, next_period_start, covered_until, status, deleted_at), payments(id, amount, method, status, paid_at, collected_by, note)")
        .not("subscription_id", "is", null)
        .is("deleted_at", null)
        .is("subscription.deleted_at", null)
        .not("subscription.status", "in", "(cancelled,deleted)")
        .not("status", "in", "(cancelled,deleted)")
        .order("due_date", { ascending: true }),
      supabase
        .from("billgo_subscriptions")
        .select("id, customer_id, customer_name, phone, internet_account, customer_address, package_name, customer:profiles!customer_id(id, full_name, phone, address)")
        .is("deleted_at", null)
        .not("status", "in", "(cancelled,deleted)")
        .order("created_at", { ascending: false }),
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

    if (billGoCustomerRes.error) {
      setCustomers([]);
      setMessage((current) => current || "Không thể tải danh sách khách BillGo: " + billGoCustomerRes.error.message);
    } else {
      setCustomers(normalizeBillGoCustomerOptions((billGoCustomerRes.data || []) as BillGoCustomerSource[]));
    }
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
      if (row.item.subscription_id) acc.subscriptionIds.add(row.item.subscription_id);
      if (row.item.customer_id) acc.customerIds.add(row.item.customer_id);
      if (row.summary.status === "overdue") acc.overdue += 1;
      if (row.summary.debt > 0) acc.uncollected += 1;

      return acc;
    },
    { receivable: 0, paid: 0, debt: 0, overdue: 0, uncollected: 0, customerIds: new Set<string>(), subscriptionIds: new Set<string>() }
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
      if (statusFilter === "paused") return isPausedBillGoCustomer(row.item);
      if (statusFilter === "debt") return row.summary.debt > 0;
      return true;
    });
  }, [receivableRows, statusFilter]);

  const selectedReceivable = receivables.find(item => item.id === selectedReceivableId) || null;
  const selectedSummary = selectedReceivable ? getBillGoReceivableSummary(selectedReceivable) : null;

  const updateNewBill = (field: keyof typeof newBill, value: string) => {
    setNewBill(prev => ({ ...prev, [field]: value }));
  };

  const selectReceivable = (item: BillGoReceivable) => {
    const selectedCycle = getBillGoCycleOption(
      item.subscription?.current_cycle || item.subscription?.cycle || item.cycle_at_collection || "monthly",
    ).value;
    setSelectedReceivableId(item.id);
    setPaymentForm(prev => ({ ...prev, cycle: selectedCycle }));
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
      const billingPeriod = getBillGoBillingPeriod(newBill.startDate, newBill.cycle);
      const billingParts = getBillGoBillingParts(billingPeriod.collectionMonth);
      const nextPeriodStart = getBillGoNextPeriodStartDate(billingPeriod.periodEnd);
      const nextBillingPeriod = getBillGoBillingPeriod(nextPeriodStart, newBill.cycle);
      const selectedCustomer = customers.find(customer => customer.id === newBill.customerId);
      const subscriptionAmount = monthlyFee * cycle.paidMonths;
      const totalAmount = setupFee + subscriptionAmount;
      const initialPaidAmount = Math.min(Math.max(paidAmount, 0), totalAmount);
      const status = getBillGoStoredStatus(totalAmount, initialPaidAmount, billingPeriod.dueDate);

      const { data: subscription, error: subscriptionError } = await supabase
        .from("billgo_subscriptions")
        .insert({
          customer_id: newBill.customerId,
          worker_id: newBill.workerId || null,
          service_id: newBill.serviceId || null,
          customer_name: selectedCustomer?.full_name || null,
          phone: selectedCustomer?.phone || null,
          internet_account: newBill.internetAccount.trim() || null,
          customer_address: selectedCustomer?.address || null,
          provider: newBill.provider.trim() || null,
          package_name: newBill.packageName.trim() || "Cước Internet",
          service_type: "internet",
          cycle: newBill.cycle,
          current_cycle: newBill.cycle,
          amount_per_cycle: monthlyFee,
          monthly_fee: monthlyFee,
          start_date: billingPeriod.periodStart,
          next_due_date: billingPeriod.dueDate,
          next_period_start: billingPeriod.periodStart,
          status: "active",
          note: newBill.note.trim() || null,
          created_by: user?.id || null,
          last_changed_by: user?.id || null,
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
          due_date: billingPeriod.dueDate,
          period_start: billingPeriod.periodStart,
          period_end: billingPeriod.periodEnd,
          collection_month: billingPeriod.collectionMonth,
          usage_month: billingPeriod.usageMonth,
          billing_month: billingParts.billingMonth,
          billing_year: billingParts.billingYear,
          cycle_at_collection: newBill.cycle,
          billing_months: billingPeriod.billingMonths,
          bonus_months: billingPeriod.bonusMonths,
          service_months: billingPeriod.totalServiceMonths,
          paid_amount: initialPaidAmount,
          monthly_fee_at_collection: monthlyFee,
          paid_at: initialPaidAmount > 0 ? new Date().toISOString() : null,
          payment_method: initialPaidAmount > 0 ? "cash" : null,
          collected_by: initialPaidAmount > 0 ? user?.id || null : null,
          next_period_start: nextPeriodStart,
          next_due_date: nextBillingPeriod.dueDate,
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

      if (initialPaidAmount > 0) {
        const { data: payment, error: paymentError } = await supabase.from("payments").insert({
          receivable_id: receivable.id,
          amount: initialPaidAmount,
          method: "cash",
          status: "paid",
          paid_at: new Date().toISOString(),
          collected_by: user?.id || null,
          note: "Thanh toán ban đầu khi tạo BillGo",
        }).select("id").single();
        if (paymentError) throw paymentError;

        if (initialPaidAmount >= totalAmount) {
          const { error: coverageError } = await supabase.from("billgo_payment_coverages").insert(
            buildBillGoCoverageMonths(billingPeriod.periodStart, billingPeriod.billingMonths, billingPeriod.bonusMonths).map(month => ({
              ...month,
              payment_id: payment?.id || null,
              receivable_id: receivable.id,
              subscription_id: subscription.id,
            })),
          );
          if (coverageError) throw coverageError;

          const { error: subscriptionCoverageError } = await supabase
            .from("billgo_subscriptions")
            .update({
              covered_until: billingPeriod.periodEnd,
              next_period_start: nextPeriodStart,
              next_due_date: nextBillingPeriod.dueDate,
              last_changed_by: user?.id || null,
            })
            .eq("id", subscription.id);
          if (subscriptionCoverageError) throw subscriptionCoverageError;
        }
      }

      setNewBill({
        customerId: "",
        workerId: "",
        serviceId: "",
        provider: "",
        internetAccount: "",
        internetPassword: "",
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
      const coveragePeriod = getBillGoBillingPeriod(selectedReceivable.period_start || getTodayInput(), paymentForm.cycle);
      const nextPeriodStart = getBillGoNextPeriodStartDate(coveragePeriod.periodEnd);
      const nextBillingPeriod = getBillGoBillingPeriod(nextPeriodStart, paymentForm.cycle);
      const currentPaid = getBillGoReceivableSummary(selectedReceivable).paid;
      const nextPaid = currentPaid + paidAmount;
      const totalAmount = toMoneyNumber(selectedReceivable.total_amount);
      const nextStatus = getBillGoStoredStatus(totalAmount, nextPaid, selectedReceivable.due_date);
      const paidAt = new Date().toISOString();

      const { data: payment, error: paymentError } = await supabase.from("payments").insert({
        receivable_id: selectedReceivable.id,
        job_id: selectedReceivable.job_id || null,
        amount: paidAmount,
        method: paymentForm.method,
        status: "paid",
        paid_at: paidAt,
        collected_by: user?.id || null,
        note: [
          `Thu ${cycle.label}`,
          paymentForm.note.trim(),
        ].filter(Boolean).join(" · ") || null,
      }).select("id").single();

      if (paymentError) throw paymentError;

      const { error: receivableError } = await supabase
        .from("billgo_receivables")
        .update({
          status: nextStatus,
          paid_amount: nextPaid,
          paid_at: paidAt,
          payment_method: paymentForm.method,
          collected_by: user?.id || null,
          cycle_at_collection: paymentForm.cycle,
          period_end: coveragePeriod.periodEnd,
          billing_months: cycle.paidMonths,
          bonus_months: cycle.bonusMonths,
          service_months: cycle.paidMonths + cycle.bonusMonths,
          next_period_start: nextPeriodStart,
          next_due_date: nextBillingPeriod.dueDate,
        })
        .eq("id", selectedReceivable.id);

      if (receivableError) throw receivableError;

      if (selectedReceivable.subscription_id) {
        if (nextPaid >= totalAmount) {
          const { error: coverageError } = await supabase.from("billgo_payment_coverages").insert(
            buildBillGoCoverageMonths(coveragePeriod.periodStart, cycle.paidMonths, cycle.bonusMonths).map(month => ({
              ...month,
              payment_id: payment?.id || null,
              receivable_id: selectedReceivable.id,
              subscription_id: selectedReceivable.subscription_id,
            })),
          );
          if (coverageError) throw coverageError;
        }

        const { error: subscriptionError } = await supabase
          .from("billgo_subscriptions")
          .update({
            cycle: paymentForm.cycle,
            current_cycle: paymentForm.cycle,
            ...(nextPaid >= totalAmount ? {
              covered_until: coveragePeriod.periodEnd,
              next_period_start: nextPeriodStart,
              next_due_date: nextBillingPeriod.dueDate,
            } : {}),
            last_changed_by: user?.id || null,
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
          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Tổng khách BillGo</p>
          <p className="mt-2 text-xl font-extrabold text-on-surface">{totals.subscriptionIds.size}</p>
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
          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Công nợ</p>
          <p className="mt-2 text-lg font-extrabold text-error">{formatBillGoCurrency(totals.debt)}</p>
        </div>
        <div className="rounded-lg border border-error/20 bg-error-container p-4">
          <p className="text-[10px] font-bold uppercase text-error/75">Quá hạn</p>
          <p className="mt-2 text-xl font-extrabold text-error">{totals.overdue}</p>
        </div>
        <div className="rounded-lg border border-warning/20 bg-warning-container p-4">
          <p className="text-[10px] font-bold uppercase text-warning/75">Chưa thu</p>
          <p className="mt-2 text-xl font-extrabold text-warning">{totals.uncollected}</p>
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

              <select
  className="input-field"
  value={newBill.provider}
  onChange={event => updateNewBill("provider", event.target.value)}
  disabled={saving}
>
  <option value="">Chọn nhà mạng</option>
  <option value="VNPT">VNPT</option>
  <option value="FPT">FPT</option>
  <option value="Viettel">Viettel</option>
  <option value="CMC">CMC</option>
  <option value="Khác">Khác</option>
</select>

<input
  className="input-field"
  value={newBill.internetAccount}
  onChange={event => updateNewBill("internetAccount", event.target.value)}
  placeholder="Account Internet"
  disabled={saving}
/>

<input
  className="input-field"
  value={newBill.internetPassword}
  onChange={event => updateNewBill("internetPassword", event.target.value)}
  placeholder="Mật khẩu Internet"
  disabled={saving}
/>
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
              Han thanh toan: <strong>{getBillGoNextDueDate(newBill.startDate, newBill.cycle)}</strong>
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
                  ["paused", "Ngừng thu"],
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
                  onClick={() => selectReceivable(item)}
                  className={`block w-full p-4 text-left transition-colors hover:bg-surface-container-lowest ${selectedReceivableId === item.id ? "bg-primary-fixed/50" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-on-surface">{getBillGoCustomerName(item)} · {item.title || "Khoản thu"}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{getBillGoCustomerPhone(item)} · {typeLabels[item.type || "other"] || "Khoản thu"}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">Ky su dung: {item.period_start || "Chua co"} - {item.period_end || "Chua co"}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">Han thanh toan: {item.due_date || item.subscription?.next_due_date || "Chua co"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${getBillGoStatusClassName(item, summary)}`}>
                        {getBillGoDisplayStatus(item, summary)}
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
                <p className="font-bold text-on-surface">{getBillGoCustomerName(selectedReceivable)}</p>
                <p className="mt-1 text-on-surface-variant">Còn lại: <strong className="text-error">{formatBillGoCurrency(selectedSummary.debt)}</strong></p>
                <p className="mt-1 text-on-surface-variant">Han thanh toan: {selectedReceivable.due_date || "Chua co"}</p>
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
                  Sau khi thu ky nay, han thanh toan ky tiep theo: <strong>{getBillGoNextDueDate(selectedReceivable.period_end ? getBillGoNextPeriodStartDate(selectedReceivable.period_end) : selectedReceivable.period_start || getTodayInput(), paymentForm.cycle)}</strong>
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
