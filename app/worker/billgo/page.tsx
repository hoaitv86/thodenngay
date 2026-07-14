"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Eye,
  MoreVertical,
  PauseCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  BILLGO_ACCOUNT_SUGGESTIONS,
  BILLGO_ALL_TAB,
  BILLGO_CYCLE_OPTIONS,
  BillGoCycle,
  formatBillGoCurrency,
  getBillGoBillingPeriod,
  getBillGoCollectableAmount,
  getBillGoCycleOption,
  getBillGoReceivableSummary,
  toBillGoDateInput,
  toMoneyNumber,
} from "@/lib/billgo";

type Payment = {
  id: string;
  amount: number | string;
  method: string;
  status: string;
  paid_at?: string | null;
  note?: string | null;
};

type Receivable = {
  id: string;
  total_amount?: number | string | null;
  due_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  collection_month?: string | null;
  usage_month?: string | null;
  billing_months?: number | null;
  bonus_months?: number | null;
  paid_amount?: number | string | null;
  paid_at?: string | null;
  payment_method?: string | null;
  status?: string | null;
  note?: string | null;
  subscription?: Subscription | null;
  payments?: Payment[] | null;
};

type Subscription = {
  id: string;
  customer_name?: string | null;
  phone?: string | null;
  internet_account?: string | null;
  customer_address?: string | null;
  area_id?: string | null;
  sub_area_id?: string | null;
  address_detail?: string | null;
  legacy_address?: string | null;
  provider?: string | null;
  package_name?: string | null;
  cycle?: string | null;
  current_cycle?: string | null;
  amount_per_cycle?: number | string | null;
  monthly_fee?: number | string | null;
  next_period_start?: string | null;
  covered_until?: string | null;
  status?: string | null;
  note?: string | null;
  created_at?: string | null;
  billgo_cycle_changes?: Array<{
    id: string;
    old_cycle?: string | null;
    new_cycle?: string | null;
    effective_period_start?: string | null;
    note?: string | null;
    created_at?: string | null;
  }> | null;
  billgo_status_events?: Array<{
    id: string;
    event_type?: string | null;
    effective_period_start?: string | null;
    note?: string | null;
    created_at?: string | null;
  }> | null;
};

type AreaOption = {
  id: string;
  name: string;
  is_active?: boolean;
  sub_areas?: SubAreaOption[] | null;
};

type SubAreaOption = {
  id: string;
  area_id: string;
  name: string;
  is_active?: boolean;
  sort_order?: number | null;
};

type RowView = {
  item: Receivable;
  summary: ReturnType<typeof getBillGoReceivableSummary>;
  cycle: BillGoCycle;
  customerName: string;
  account: string;
};

type ActionMode = "edit" | "cycle" | "status" | "detail" | "delete";

const currentDate = new Date();
const todayInput = () => toBillGoDateInput(new Date());
const previousMonthFirstInput = () => {
  const today = new Date();
  return toBillGoDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1));
};
const monthInput = (date = currentDate) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const parseDateInput = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};
const monthLabel = (value: string) => {
  const date = parseDateInput(value);
  if (!date) return "tháng cước";
  return `tháng ${date.month}/${date.year}`;
};
const dateLabel = (value: string) => {
  const date = parseDateInput(value);
  if (!date) return value;
  return `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}`;
};
const BILLGO_VIEW_STATE_KEY = "billgo.collection.view";

const methodLabels: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  other: "Khác",
};

const providerSuggestions = ["Viettel", "VNPT", "FPT"];

const statusOptions = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "unpaid", label: "Chưa thu" },
  { value: "paid", label: "Đã thu" },
  { value: "partial", label: "Thu thiếu" },
  { value: "overdue", label: "Quá hạn" },
  { value: "promo", label: "Khuyến mại" },
];

const initialForm = () => ({
  customerName: "",
  phone: "",
  account: "",
  address: "",
  areaId: "",
  areaName: "",
  subAreaId: "",
  subAreaName: "",
  addressDetail: "",
  provider: "Viettel",
  packageName: "",
  monthlyFee: "",
  cycle: "monthly" as BillGoCycle,
  startDate: previousMonthFirstInput(),
  dueDate: "",
  note: "",
  initialPaidAmount: "",
  initialPaidAt: todayInput(),
  initialPaymentMethod: "cash",
});

const firstRelation = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] || null : value || null;

const normalizeRows = (items: unknown[]): Receivable[] =>
  items.map(item => {
    const row = item as Receivable & { subscription?: Subscription | Subscription[] | null; payments?: Payment[] | null };
    return {
      ...row,
      subscription: firstRelation(row.subscription),
      payments: row.payments || [],
    };
  });

const getNumericPackageAmount = (value: string) => {
  const normalized = value.replace(/[^\d]/g, "");
  return normalized ? String(Number(normalized)) : "";
};

const normalizeLocationText = (value: string | null | undefined) =>
  String(value || "").trim().toLocaleLowerCase("vi");

export default function WorkerBillGoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Receivable[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cycle" | "area">("cycle");
  const [activeTab, setActiveTab] = useState<BillGoCycle | typeof BILLGO_ALL_TAB>("monthly");
  const [monthFilter, setMonthFilter] = useState(monthInput());
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaStatusFilter, setAreaStatusFilter] = useState("all");
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [selectedSubAreaId, setSelectedSubAreaId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [collecting, setCollecting] = useState<Receivable | null>(null);
  const [actionTarget, setActionTarget] = useState<Receivable | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [collectForm, setCollectForm] = useState({
    amount: "",
    paidAt: todayInput(),
    method: "cash",
    note: "",
  });
  const [editForm, setEditForm] = useState({
    customerName: "",
    phone: "",
    account: "",
    address: "",
    provider: "",
    areaId: "",
    areaName: "",
    subAreaId: "",
    subAreaName: "",
    addressDetail: "",
    packageName: "",
    monthlyFee: "",
    note: "",
    cycle: "monthly" as BillGoCycle,
    effectivePeriodStart: todayInput(),
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(BILLGO_VIEW_STATE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<{
          viewMode: "cycle" | "area";
          activeTab: BillGoCycle | typeof BILLGO_ALL_TAB;
          monthFilter: string;
          statusFilter: string;
          areaStatusFilter: string;
          selectedAreaId: string;
          selectedSubAreaId: string;
          query: string;
        }>;
        if (saved.viewMode) setViewMode(saved.viewMode);
        if (saved.activeTab) setActiveTab(saved.activeTab);
        if (saved.monthFilter) setMonthFilter(saved.monthFilter);
        if (saved.statusFilter) setStatusFilter(saved.statusFilter);
        if (saved.areaStatusFilter) setAreaStatusFilter(saved.areaStatusFilter);
        if (typeof saved.selectedAreaId === "string") setSelectedAreaId(saved.selectedAreaId);
        if (typeof saved.selectedSubAreaId === "string") setSelectedSubAreaId(saved.selectedSubAreaId);
        if (typeof saved.query === "string") setQuery(saved.query);
      } catch {
        window.localStorage.removeItem(BILLGO_VIEW_STATE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(BILLGO_VIEW_STATE_KEY, JSON.stringify({
      viewMode,
      activeTab,
      monthFilter,
      statusFilter,
      areaStatusFilter,
      selectedAreaId,
      selectedSubAreaId,
      query,
    }));
  }, [activeTab, areaStatusFilter, monthFilter, query, selectedAreaId, selectedSubAreaId, statusFilter, viewMode]);

  const fetchAreas = useCallback(async () => {
    const response = await fetch("/api/worker/areas");
    if (!response.ok) {
      setAreas([]);
      return;
    }
    const result = await response.json();
    setAreas((result.areas || []) as AreaOption[]);
  }, []);

  const fetchBillGo = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: worker } = await supabase.from("workers").select("id").eq("user_id", user.id).single();
    if (!worker) {
      setMessage("Không tìm thấy hồ sơ thợ.");
      setLoading(false);
      return;
    }

    const start = `${monthFilter}-01`;
    const endDate = new Date(`${start}T00:00:00`);
    endDate.setMonth(endDate.getMonth() + 1);
    const end = toBillGoDateInput(endDate);

    const { data, error } = await supabase
      .from("billgo_receivables")
      .select("id, total_amount, due_date, period_start, period_end, collection_month, usage_month, billing_months, bonus_months, paid_amount, paid_at, payment_method, status, note, subscription:billgo_subscriptions(id, customer_name, phone, internet_account, customer_address, area_id, sub_area_id, address_detail, legacy_address, provider, package_name, cycle, current_cycle, amount_per_cycle, monthly_fee, next_period_start, covered_until, status, note, created_at, billgo_cycle_changes(id, old_cycle, new_cycle, effective_period_start, note, created_at), billgo_status_events(id, event_type, effective_period_start, note, created_at)), payments(id, amount, method, status, paid_at, note)")
      .eq("worker_id", worker.id)
      .not("subscription_id", "is", null)
      .is("deleted_at", null)
      .gte("collection_month", start)
      .lt("collection_month", end)
      .order("due_date", { ascending: true });

    if (error) {
      setMessage("Không thể tải BillGo: " + error.message);
      setRows([]);
    } else {
      setRows(normalizeRows(data || []));
    }
    setLoading(false);
  }, [monthFilter, supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchBillGo(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchBillGo]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchAreas(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAreas]);

  const rowViews = useMemo<RowView[]>(() => rows.map(item => {
    const cycle = (item.subscription?.current_cycle || item.subscription?.cycle || "monthly") as BillGoCycle;
    return {
      item,
      cycle,
      summary: getBillGoReceivableSummary(item),
      customerName: item.subscription?.customer_name || "Khách BillGo",
      account: item.subscription?.internet_account || "Chưa có account",
    };
  }), [rows]);

  const matchesSearch = useCallback((row: RowView) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    if (!normalizedQuery) return true;
    return [
        row.customerName,
        row.account,
        row.item.subscription?.phone,
        row.item.subscription?.address_detail,
        row.item.subscription?.customer_address,
        row.item.subscription?.provider,
        row.item.subscription?.package_name,
      ].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(normalizedQuery);
  }, [query]);

  const filteredRows = useMemo(() => rowViews.filter(row => {
    if (activeTab !== BILLGO_ALL_TAB && row.cycle !== activeTab) return false;
    if (statusFilter !== "all" && row.summary.status !== statusFilter) return false;
    return matchesSearch(row);
  }), [activeTab, matchesSearch, rowViews, statusFilter]);

  const selectedArea = useMemo(
    () => areas.find(area => area.id === selectedAreaId),
    [areas, selectedAreaId],
  );
  const selectedAreaSubAreas = useMemo(
    () => selectedArea?.sub_areas?.filter(subArea => subArea.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name)) || [],
    [selectedArea],
  );
  useEffect(() => {
    if (viewMode !== "area") return;
    if (!selectedAreaId) {
      if (selectedSubAreaId) setSelectedSubAreaId("");
      return;
    }
    if (selectedAreaSubAreas.length === 0) {
      if (selectedSubAreaId) setSelectedSubAreaId("");
      return;
    }
    if (!selectedAreaSubAreas.some(subArea => subArea.id === selectedSubAreaId)) {
      setSelectedSubAreaId(selectedAreaSubAreas[0].id);
    }
  }, [selectedAreaId, selectedAreaSubAreas, selectedSubAreaId, viewMode]);

  const areaRows = useMemo(() => rowViews.filter(row => {
    const subscription = row.item.subscription;
    const locationText = normalizeLocationText([
      subscription?.address_detail,
      subscription?.customer_address,
      subscription?.legacy_address,
    ].filter(Boolean).join(" "));
    if (selectedAreaId) {
      const areaName = normalizeLocationText(selectedArea?.name);
      const matchesAreaId = subscription?.area_id === selectedAreaId;
      const matchesLegacyAreaName = !subscription?.area_id && !!areaName && locationText.includes(areaName);
      if (!matchesAreaId && !matchesLegacyAreaName) return false;
    }
    if (selectedSubAreaId) {
      const subArea = selectedAreaSubAreas.find(item => item.id === selectedSubAreaId);
      const subAreaName = normalizeLocationText(subArea?.name);
      const matchesSubAreaId = subscription?.sub_area_id === selectedSubAreaId;
      const matchesLegacySubAreaName = !subscription?.sub_area_id && !!subAreaName && locationText.includes(subAreaName);
      if (!matchesSubAreaId && !matchesLegacySubAreaName) return false;
    }
    if (areaStatusFilter !== "all" && row.summary.status !== areaStatusFilter) return false;
    return matchesSearch(row);
  }).sort((a, b) => {
    const order: Record<string, number> = { unpaid: 0, partial: 1, overdue: 2, paid: 3, promo: 4 };
    return (order[a.summary.status] ?? 9) - (order[b.summary.status] ?? 9) || a.customerName.localeCompare(b.customerName);
  }), [areaStatusFilter, matchesSearch, rowViews, selectedArea, selectedAreaId, selectedAreaSubAreas, selectedSubAreaId]);

  const getAreaStats = useCallback((items: RowView[]) => items.reduce((acc, row) => {
    acc.total += 1;
    acc.receivable += row.summary.receivable;
    acc.paidAmount += row.summary.paid;
    acc.debt += row.summary.debt;
    if (row.summary.status === "paid") acc.paid += 1;
    if (row.summary.status === "partial") acc.partial += 1;
    if (row.summary.status === "overdue") acc.overdue += 1;
    if (row.summary.status === "unpaid") acc.unpaid += 1;
    return acc;
  }, { total: 0, unpaid: 0, paid: 0, partial: 0, overdue: 0, receivable: 0, paidAmount: 0, debt: 0 }), []);

  const areaStats = useMemo(() => getAreaStats(areaRows), [areaRows, getAreaStats]);
  const processedCount = areaStats.paid;
  const remainingCount = areaStats.unpaid + areaStats.partial + areaStats.overdue;

  const totals = useMemo(() => filteredRows.reduce((acc, row) => {
    acc.totalCustomers += 1;
    acc.totalReceivable += row.summary.receivable;
    acc.totalPaid += row.summary.paid;
    acc.totalDebt += row.summary.debt;
    if (row.summary.status === "paid") acc.paid += 1;
    if (row.summary.status === "partial") acc.partial += 1;
    if (row.summary.status === "unpaid" || row.summary.status === "overdue") acc.unpaid += 1;
    return acc;
  }, { totalCustomers: 0, unpaid: 0, paid: 0, partial: 0, totalReceivable: 0, totalPaid: 0, totalDebt: 0 }), [filteredRows]);

  const selectedSubAreaIndex = selectedAreaSubAreas.findIndex(subArea => subArea.id === selectedSubAreaId);
  const previousSubArea = selectedSubAreaIndex > 0 ? selectedAreaSubAreas[selectedSubAreaIndex - 1] : null;
  const nextSubArea = selectedSubAreaIndex >= 0 && selectedSubAreaIndex < selectedAreaSubAreas.length - 1 ? selectedAreaSubAreas[selectedSubAreaIndex + 1] : null;

  const formBilling = useMemo(() => getBillGoBillingPeriod(form.startDate, form.cycle), [form.cycle, form.startDate]);
  const formTotal = useMemo(() => getBillGoCollectableAmount(form.monthlyFee, form.cycle), [form.cycle, form.monthlyFee]);
  const selectedSummary = collecting ? getBillGoReceivableSummary(collecting) : null;
  const formSubAreas = useMemo(
    () => areas.find(area => area.id === form.areaId)?.sub_areas?.filter(subArea => subArea.is_active !== false) || [],
    [areas, form.areaId],
  );
  const editSubAreas = useMemo(
    () => areas.find(area => area.id === editForm.areaId)?.sub_areas?.filter(subArea => subArea.is_active !== false) || [],
    [areas, editForm.areaId],
  );
  const updateForm = (key: keyof ReturnType<typeof initialForm>, value: string) => {
    setForm(prev => {
      if (key === "areaId") {
        const area = areas.find(item => item.id === value);
        return { ...prev, areaId: value, areaName: area?.name || "", subAreaId: "", subAreaName: "" };
      }
      if (key === "areaName") {
        const area = areas.find(item => item.name.toLowerCase() === value.trim().toLowerCase());
        return { ...prev, areaName: value, areaId: area?.id || "", subAreaId: "", subAreaName: "" };
      }
      if (key === "subAreaName") {
        const subArea = areas
          .find(item => item.id === prev.areaId)
          ?.sub_areas?.find(item => item.name.toLowerCase() === value.trim().toLowerCase());
        return { ...prev, subAreaName: value, subAreaId: subArea?.id || "" };
      }
      if (key === "cycle" && value === "monthly") return { ...prev, cycle: value as BillGoCycle, startDate: previousMonthFirstInput(), dueDate: "" };
      if (key !== "packageName") return { ...prev, [key]: value };
      const packageAmount = getNumericPackageAmount(value);
      return { ...prev, packageName: value, monthlyFee: packageAmount || prev.monthlyFee };
    });
  };

  const updateEditAreaName = (value: string) => {
    const area = areas.find(item => item.name.toLowerCase() === value.trim().toLowerCase());
    setEditForm(prev => ({ ...prev, areaName: value, areaId: area?.id || "", subAreaId: "", subAreaName: "" }));
  };

  const updateEditSubAreaName = (value: string) => {
    setEditForm(prev => {
      const subArea = areas
        .find(item => item.id === prev.areaId)
        ?.sub_areas?.find(item => item.name.toLowerCase() === value.trim().toLowerCase());
      return { ...prev, subAreaName: value, subAreaId: subArea?.id || "" };
    });
  };

  const refreshBillGoKeepingScroll = async () => {
    const scrollY = window.scrollY;
    await fetchBillGo();
    window.requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
  };

  const submitCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/billgo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, dueDate: form.dueDate || formBilling.dueDate }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể thêm khách hàng BillGo.");
      setForm(initialForm());
      setShowForm(false);
      setMessage("Đã thêm khách hàng BillGo.");
      await fetchAreas();
      await refreshBillGoKeepingScroll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể thêm khách hàng BillGo.");
    } finally {
      setSaving(false);
    }
  };

  const openCollect = (item: Receivable) => {
    const summary = getBillGoReceivableSummary(item);
    setCollecting(item);
    setCollectForm({
      amount: String(summary.debt || summary.receivable),
      paidAt: todayInput(),
      method: "cash",
      note: "",
    });
  };

  const openAction = (mode: ActionMode, item: Receivable) => {
    const subscription = item.subscription;
    setActionTarget(item);
    setActionMode(mode);
    setEditForm({
      customerName: subscription?.customer_name || "",
      phone: subscription?.phone || "",
      account: subscription?.internet_account || "",
      address: subscription?.customer_address || "",
      areaId: subscription?.area_id || "",
      areaName: areas.find(area => area.id === subscription?.area_id)?.name || "",
      subAreaId: subscription?.sub_area_id || "",
      subAreaName: areas.flatMap(area => area.sub_areas || []).find(subArea => subArea.id === subscription?.sub_area_id)?.name || "",
      addressDetail: subscription?.address_detail || "",
      provider: subscription?.provider || "Viettel",
      packageName: subscription?.package_name || "",
      monthlyFee: String(subscription?.monthly_fee ?? subscription?.amount_per_cycle ?? ""),
      note: subscription?.note || "",
      cycle: (subscription?.current_cycle || subscription?.cycle || "monthly") as BillGoCycle,
      effectivePeriodStart: subscription?.next_period_start || item.period_start || todayInput(),
    });
  };

  const submitCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!collecting) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/billgo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "collect", receivableId: collecting.id, ...collectForm }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể xác nhận thu tiền.");
      setCollecting(null);
      setMessage("Đã xác nhận thu tiền.");
      await refreshBillGoKeepingScroll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xác nhận thu tiền.");
    } finally {
      setSaving(false);
    }
  };

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!actionTarget?.subscription?.id || !actionMode) return;
    setSaving(true);
    setMessage("");
    try {
      const action = actionMode === "edit"
        ? "update_customer"
        : actionMode === "cycle"
          ? "change_cycle"
          : actionMode === "delete"
            ? "soft_delete"
            : actionTarget.subscription.status === "paused"
              ? "reactivate"
              : "pause";
      const payload = actionMode === "edit"
        ? {
            action,
            subscriptionId: actionTarget.subscription.id,
            customerName: editForm.customerName,
            phone: editForm.phone,
            account: editForm.account,
            address: editForm.address,
            areaId: editForm.areaId,
            areaName: editForm.areaName,
            subAreaId: editForm.subAreaId,
            subAreaName: editForm.subAreaName,
            addressDetail: editForm.addressDetail,
            provider: editForm.provider,
            packageName: editForm.packageName,
            monthlyFee: editForm.monthlyFee,
            note: editForm.note,
          }
        : actionMode === "cycle"
          ? {
              action,
              subscriptionId: actionTarget.subscription.id,
              cycle: editForm.cycle,
              effectivePeriodStart: editForm.effectivePeriodStart,
              note: editForm.note,
            }
          : actionMode === "delete"
            ? {
                action,
                subscriptionId: actionTarget.subscription.id,
                note: editForm.note,
              }
            : {
              action,
              subscriptionId: actionTarget.subscription.id,
              effectivePeriodStart: editForm.effectivePeriodStart,
              note: editForm.note,
            };

      const response = await fetch("/api/worker/billgo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể lưu thay đổi BillGo.");
      setActionTarget(null);
      setActionMode(null);
      setMessage("Đã lưu thay đổi BillGo.");
      if (actionMode === "edit") await fetchAreas();
      await refreshBillGoKeepingScroll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu thay đổi BillGo.");
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (row: RowView) => {
    const { item, summary } = row;
    const cycle = getBillGoCycleOption(row.cycle);
    const canCollect = summary.status !== "paid" && summary.status !== "promo";

    return (
      <article key={item.id} className="grid gap-3 rounded-lg border border-outline-variant/40 bg-white p-3 shadow-sm lg:grid-cols-[minmax(190px,1.5fr)_120px_190px_130px_130px_110px] lg:items-center">
        <div className="flex items-start justify-between gap-3 lg:contents">
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold text-on-surface">{row.customerName}</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{row.account}</p>
            <p className="text-sm text-on-surface-variant">{item.subscription?.phone || "Chưa có số điện thoại"}</p>
          </div>
          <div className="relative flex shrink-0 items-center justify-end gap-2 text-right">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${summary.status === "paid" ? "bg-success-container text-success" : summary.status === "partial" ? "bg-warning-container text-warning" : summary.status === "overdue" ? "bg-error-container text-error" : summary.status === "promo" ? "bg-primary-fixed text-primary" : "bg-surface-container text-on-surface-variant"}`}>
              {summary.statusLabel}
            </span>
            {canCollect && (
              <button type="button" title="Xác nhận thu tiền" onClick={() => openCollect(item)} className="hidden rounded-lg bg-primary p-2 text-white lg:inline-flex">
                <CheckCircle2 size={16} />
              </button>
            )}
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg border border-outline-variant/60 bg-white p-2 text-on-surface-variant">
                <MoreVertical size={16} />
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-lg border border-outline-variant/40 bg-white py-1 text-left text-sm shadow-lg">
                <button type="button" disabled={!canCollect} onClick={() => openCollect(item)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-container-low disabled:opacity-45">
                  <CircleDollarSign size={16} /> Thu tiền
                </button>
                <button type="button" onClick={() => openAction("detail", item)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-container-low">
                  <Eye size={16} /> Xem chi tiết
                </button>
                <button type="button" onClick={() => openAction("edit", item)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-container-low">
                  <Pencil size={16} /> Sửa thông tin
                </button>
                <button type="button" onClick={() => openAction("cycle", item)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-container-low">
                  <RotateCcw size={16} /> Chuyển hình thức đóng
                </button>
                <button type="button" onClick={() => openAction("status", item)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-container-low">
                  <PauseCircle size={16} /> {item.subscription?.status === "paused" ? "Kích hoạt lại" : "Ngừng sử dụng"}
                </button>
                <button type="button" onClick={() => openAction("delete", item)} className="flex w-full items-center gap-2 px-3 py-2 text-error hover:bg-error-container/40">
                  <Trash2 size={16} /> Xóa khách hàng
                </button>
              </div>
            </details>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm lg:contents">
          <div className="rounded-lg bg-surface-container-low p-3 lg:rounded-none lg:bg-transparent lg:p-0">Gói tháng<br /><strong>{formatBillGoCurrency(item.subscription?.monthly_fee ?? item.subscription?.amount_per_cycle)}</strong></div>
          <div className="rounded-lg bg-surface-container-low p-3 lg:rounded-none lg:bg-transparent lg:p-0">Cần thu<br /><strong>{formatBillGoCurrency(summary.receivable)}</strong></div>
          <div className="rounded-lg bg-surface-container-low p-3 lg:hidden">Đã thu<br /><strong className="text-success">{formatBillGoCurrency(summary.paid)}</strong></div>
          <div className="rounded-lg bg-surface-container-low p-3 lg:rounded-none lg:bg-transparent lg:p-0">Còn lại<br /><strong className="text-error">{formatBillGoCurrency(summary.debt)}</strong><p className="text-xs text-on-surface-variant">Đã thu {formatBillGoCurrency(summary.paid)}</p></div>
        </div>

        <div className="mt-3 grid gap-1 text-xs text-on-surface-variant lg:mt-0">
          <p>Hình thức: {cycle.label}</p>
          <p>Kỳ cước: {item.period_start || "Chưa có"} - {item.period_end || "Chưa có"}</p>
          <p>Hạn thanh toán: {item.due_date ? new Date(item.due_date).toLocaleDateString("vi-VN") : "Chưa có"}</p>
          <p>{item.subscription?.customer_address || "Chưa có địa chỉ"}</p>
        </div>

        {canCollect && (
          <button type="button" onClick={() => openCollect(item)} className="btn-primary mt-4 !w-full lg:hidden">
            <CheckCircle2 size={18} /> Xác nhận thu tiền
          </button>
        )}
      </article>
    );
  };

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-surface p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Thu cước định kỳ</p>
          <h1 className="text-2xl font-extrabold text-on-surface">BillGo</h1>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button type="button" title="Tải lại" onClick={() => void fetchBillGo()} className="btn-outline !w-auto !p-3">
            <RefreshCw size={18} />
          </button>
          <button type="button" onClick={() => setShowForm(value => !value)} className="btn-primary !w-auto flex-1 sm:flex-none">
            <Plus size={18} /> Thêm khách hàng
          </button>
        </div>
      </header>

      {message && <div className="mt-4 rounded-lg bg-primary-fixed p-3 text-sm font-bold text-primary">{message}</div>}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {[
          { value: "cycle", label: "Thu theo chu kỳ" },
          { value: "area", label: "Thu theo địa bàn" },
        ].map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => setViewMode(option.value as "cycle" | "area")}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-bold ${viewMode === option.value ? "border-primary bg-primary text-white" : "border-outline-variant bg-white text-on-surface-variant"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={submitCustomer} className="mt-4 rounded-lg border border-outline-variant/50 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-base font-extrabold">Thêm khách hàng</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input required className="input-field" placeholder="Tên khách hàng" value={form.customerName} onChange={e => updateForm("customerName", e.target.value)} />
            <input className="input-field" placeholder="Số điện thoại" value={form.phone} onChange={e => updateForm("phone", e.target.value)} />
            <input required list="billgo-account-suggestions" className="input-field" placeholder="Account" value={form.account} onChange={e => updateForm("account", e.target.value)} />
            <datalist id="billgo-account-suggestions">
              {BILLGO_ACCOUNT_SUGGESTIONS.map(account => <option key={account} value={account} />)}
            </datalist>
            <select className="input-field" value={form.provider} onChange={e => updateForm("provider", e.target.value)}>
              {providerSuggestions.map(provider => <option key={provider} value={provider}>{provider}</option>)}
            </select>
            <input list="billgo-area-suggestions" className="input-field" placeholder="Xã/phường" value={form.areaName} onChange={e => updateForm("areaName", e.target.value)} />
            <datalist id="billgo-area-suggestions">
              {areas.filter(area => area.is_active !== false).map(area => <option key={area.id} value={area.name} />)}
            </datalist>
            <input list="billgo-sub-area-suggestions" className="input-field" placeholder="Xóm/thôn/khối" value={form.subAreaName} onChange={e => updateForm("subAreaName", e.target.value)} disabled={!form.areaName.trim()} />
            <datalist id="billgo-sub-area-suggestions">
              {formSubAreas.map(subArea => <option key={subArea.id} value={subArea.name} />)}
            </datalist>
            <input className="input-field" placeholder="Địa chỉ chi tiết" value={form.addressDetail} onChange={e => updateForm("addressDetail", e.target.value)} />
            <input required className="input-field" placeholder="Địa chỉ cũ / hiển thị dự phòng" value={form.address} onChange={e => updateForm("address", e.target.value)} />
            <input required className="input-field" placeholder="Gói cước hàng tháng" value={form.packageName} onChange={e => updateForm("packageName", e.target.value)} />
            <input required type="number" min="0" inputMode="numeric" className="input-field" placeholder="Số tiền cước một tháng" value={form.monthlyFee} onChange={e => updateForm("monthlyFee", e.target.value)} />
            <select className="input-field" value={form.cycle} onChange={e => updateForm("cycle", e.target.value)}>
              {BILLGO_CYCLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input readOnly className="input-field bg-surface-container-low font-bold" value={formatBillGoCurrency(formTotal)} aria-label="Số tiền cần thu" />
            <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
              Kỳ cước {monthLabel(form.startDate)}
              <input required type="date" className="input-field" value={form.startDate} onChange={e => updateForm("startDate", e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
              Hạn nộp tiền
              <input type="date" className="input-field" value={form.dueDate || formBilling.dueDate} onChange={e => updateForm("dueDate", e.target.value)} />
            </label>
            <input type="number" min="0" inputMode="numeric" className="input-field" placeholder="Tổng tiền đã thu ban đầu" value={form.initialPaidAmount} onChange={e => updateForm("initialPaidAmount", e.target.value)} />
            <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
              Ngày nhập khách hàng
              <input type="date" className="input-field" value={form.initialPaidAt} onChange={e => updateForm("initialPaidAt", e.target.value)} />
            </label>
            <select className="input-field" value={form.initialPaymentMethod} onChange={e => updateForm("initialPaymentMethod", e.target.value)}>
              {Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <textarea className="input-field min-h-20 sm:col-span-2" placeholder="Ghi chú" value={form.note} onChange={e => updateForm("note", e.target.value)} />
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">
            Kỳ cước {monthLabel(form.startDate)}: {dateLabel(formBilling.periodStart)} - {dateLabel(formBilling.periodEnd)}. Hạn nộp tiền: {dateLabel(form.dueDate || formBilling.dueDate)}. {form.cycle === "yearly" ? "Khách trả 12 tháng và được dùng 13 tháng." : ""}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-outline !w-auto">Hủy</button>
            <button disabled={saving || formTotal < 0 || toMoneyNumber(form.monthlyFee) < 0} className="btn-primary !w-auto">{saving ? "Đang lưu..." : "Thêm vào BillGo"}</button>
          </div>
        </form>
      )}

      {viewMode === "cycle" ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {[...BILLGO_CYCLE_OPTIONS, { value: BILLGO_ALL_TAB, label: "Tất cả khách hàng", shortLabel: "Tất cả", paidMonths: 0, bonusMonths: 0 }].map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setActiveTab(option.value as BillGoCycle | typeof BILLGO_ALL_TAB)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-bold ${activeTab === option.value ? "border-primary bg-primary text-white" : "border-outline-variant bg-white text-on-surface-variant"}`}
            >
              {option.shortLabel}
            </button>
          ))}
        </div>
      ) : (
        <section className="mt-4 rounded-lg border border-outline-variant/40 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="input-field" value={selectedAreaId} onChange={e => { setSelectedAreaId(e.target.value); setSelectedSubAreaId(""); }}>
              <option value="">Tất cả xã</option>
              {areas.filter(area => area.is_active !== false).map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
            <select className="input-field" value={selectedSubAreaId} onChange={e => setSelectedSubAreaId(e.target.value)} disabled={!selectedAreaId || selectedAreaSubAreas.length === 0}>
              <option value="">{selectedAreaId ? "Tất cả xóm" : "Chọn xã trước"}</option>
              {selectedAreaSubAreas.map(subArea => <option key={subArea.id} value={subArea.id}>{subArea.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!previousSubArea} onClick={() => previousSubArea && setSelectedSubAreaId(previousSubArea.id)} className="btn-outline !w-full !px-3 disabled:opacity-40">Xóm trước</button>
              <button type="button" disabled={!nextSubArea} onClick={() => nextSubArea && setSelectedSubAreaId(nextSubArea.id)} className={`${remainingCount === 0 && nextSubArea ? "btn-primary" : "btn-outline"} !w-full !px-3 disabled:opacity-40`}>Xóm tiếp</button>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-primary-fixed p-3 text-sm font-bold text-primary">
            {remainingCount === 0 && areaStats.total > 0
              ? "Đã hoàn thành xóm"
              : `Đã xử lý ${processedCount}/${areaStats.total} khách - còn ${remainingCount} khách chưa xử lý`}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
            {[
              ["Tổng khách", String(areaStats.total)],
              ["Đã thu", String(areaStats.paid)],
              ["Chưa thu", String(areaStats.unpaid)],
              ["Thu thiếu", String(areaStats.partial)],
              ["Còn lại", formatBillGoCurrency(areaStats.debt)],
              ["Hoàn thành", `${areaStats.total ? Math.round((areaStats.paid / areaStats.total) * 100) : 0}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-surface-container-low p-3">
                <p className="text-[11px] font-bold uppercase text-on-surface-variant">{label}</p>
                <p className="mt-1 font-extrabold text-on-surface">{value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input className="input-field !pl-10" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, account, địa chỉ, gói cước..." />
        </label>
        <input type="month" className="input-field" value={monthFilter} onChange={e => setMonthFilter(e.target.value || monthInput())} />
        <label className="relative block">
          <select className="input-field appearance-none pr-10" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        </label>
      </div>

      {viewMode === "area" && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {statusOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setAreaStatusFilter(option.value)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-bold ${areaStatusFilter === option.value ? "border-primary bg-primary text-white" : "border-outline-variant bg-white text-on-surface-variant"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {viewMode === "cycle" && <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ["Tổng khách", String(totals.totalCustomers)],
          ["Chưa thu", String(totals.unpaid)],
          ["Đã thu", String(totals.paid)],
          ["Thu thiếu", String(totals.partial)],
          ["Cần thu", formatBillGoCurrency(totals.totalReceivable)],
          ["Còn phải thu", formatBillGoCurrency(totals.totalDebt)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-outline-variant/40 bg-white p-4">
            <p className="text-xs font-bold uppercase text-on-surface-variant">{label}</p>
            <p className="mt-1 text-lg font-extrabold text-on-surface">{value}</p>
          </div>
        ))}
      </div>}

      {loading ? (
        <div className="py-16 text-center text-sm text-on-surface-variant">Đang tải BillGo...</div>
      ) : (viewMode === "area" ? areaRows : filteredRows).length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-outline-variant bg-white p-8 text-center text-sm text-on-surface-variant">
          Chưa có khách hàng phù hợp bộ lọc tháng, trạng thái hoặc địa bàn.
        </div>
      ) : (
        <section className="mt-5 space-y-2">
          <div className="hidden rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs font-bold uppercase text-on-surface-variant lg:grid lg:grid-cols-[minmax(190px,1.5fr)_120px_190px_130px_130px_110px]">
            <span>Khách hàng</span>
            <span>Trạng thái</span>
            <span>Gói tháng</span>
            <span>Cần thu</span>
            <span>Còn lại</span>
            <span>Kỳ cước</span>
          </div>
          {(viewMode === "area" ? areaRows : filteredRows).map(renderRow)}
        </section>
      )}

      {collecting && selectedSummary && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
          <form onSubmit={submitCollection} className="modal-panel w-full max-w-lg overflow-y-auto p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-primary">Xác nhận thu tiền</p>
                <h2 className="text-lg font-extrabold">{collecting.subscription?.customer_name || "Khách BillGo"}</h2>
              </div>
              <button type="button" onClick={() => setCollecting(null)} className="btn-outline !w-auto !px-3 !py-2">Đóng</button>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="rounded-lg bg-surface-container-low p-3">Kỳ cước: <strong>{collecting.period_start} - {collecting.period_end}</strong></div>
              <div className="rounded-lg bg-surface-container-low p-3">Gói cước hàng tháng: <strong>{formatBillGoCurrency(collecting.subscription?.monthly_fee ?? collecting.subscription?.amount_per_cycle)}</strong></div>
              <div className="rounded-lg bg-surface-container-low p-3">Hình thức đóng: <strong>{getBillGoCycleOption(collecting.subscription?.current_cycle || collecting.subscription?.cycle || "monthly").label}</strong></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface-container-low p-3">Số tháng tính tiền<br /><strong>{collecting.billing_months || 0}</strong></div>
                <div className="rounded-lg bg-surface-container-low p-3">Số tháng tặng<br /><strong>{collecting.bonus_months || 0}</strong></div>
              </div>
              <div className="rounded-lg bg-surface-container-low p-3">Tổng tiền cần thu: <strong>{formatBillGoCurrency(selectedSummary.receivable)}</strong></div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input required type="number" min="0" inputMode="numeric" className="input-field" placeholder="Số tiền thực thu" value={collectForm.amount} onChange={e => setCollectForm(prev => ({ ...prev, amount: e.target.value }))} />
              <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
                Ngày thu
                <input required type="date" className="input-field" value={collectForm.paidAt} onChange={e => setCollectForm(prev => ({ ...prev, paidAt: e.target.value }))} />
              </label>
              <select className="input-field" value={collectForm.method} onChange={e => setCollectForm(prev => ({ ...prev, method: e.target.value }))}>
                {Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <textarea className="input-field min-h-20 sm:col-span-2" placeholder="Ghi chú" value={collectForm.note} onChange={e => setCollectForm(prev => ({ ...prev, note: e.target.value }))} />
            </div>
            <button disabled={saving || toMoneyNumber(collectForm.amount) <= 0} className="btn-primary mt-4 !w-full">
              {saving ? "Đang xác nhận..." : "Xác nhận thu tiền"}
            </button>
          </form>
        </div>
      )}

      {actionTarget && actionMode && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
          <form onSubmit={submitAction} className="modal-panel w-full max-w-lg overflow-y-auto p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-primary">BillGo</p>
                <h2 className="text-lg font-extrabold">
                  {actionMode === "edit" ? "Sửa thông tin" : actionMode === "cycle" ? "Chuyển hình thức đóng" : actionMode === "status" ? (actionTarget.subscription?.status === "paused" ? "Kích hoạt lại" : "Ngừng sử dụng") : actionMode === "delete" ? "Xóa khách hàng" : "Chi tiết khách hàng"}
                </h2>
              </div>
              <button type="button" onClick={() => { setActionTarget(null); setActionMode(null); }} className="btn-outline !w-auto !px-3 !py-2">Đóng</button>
            </div>

            {actionMode === "detail" ? (
              <div className="mt-4 grid gap-2 text-sm">
                {[
                  ["Tên khách hàng", actionTarget.subscription?.customer_name || "Chưa có"],
                  ["Số điện thoại", actionTarget.subscription?.phone || "Chưa có"],
                  ["Account", actionTarget.subscription?.internet_account || "Chưa có"],
                  ["Địa chỉ", actionTarget.subscription?.customer_address || "Chưa có"],
                  ["Nhà mạng", actionTarget.subscription?.provider || "Chưa có"],
                  ["Hình thức hiện tại", getBillGoCycleOption(actionTarget.subscription?.current_cycle || actionTarget.subscription?.cycle || "monthly").label],
                  ["Đã thanh toán đến", actionTarget.subscription?.covered_until || "Chưa có"],
                  ["Kỳ thu tiếp theo", actionTarget.subscription?.next_period_start || "Chưa có"],
                  ["Ghi chú", actionTarget.subscription?.note || actionTarget.note || "Chưa có"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-surface-container-low p-3">
                    <span className="text-on-surface-variant">{label}</span><br />
                    <strong>{value}</strong>
                  </div>
                ))}
                <div className="rounded-lg bg-surface-container-low p-3">
                  <span className="text-on-surface-variant">Lịch sử giao dịch</span>
                  {(actionTarget.payments || []).length === 0 ? (
                    <p className="mt-1 font-bold">Chưa có giao dịch</p>
                  ) : (actionTarget.payments || []).map(payment => (
                    <p key={payment.id} className="mt-1">
                      <strong>{formatBillGoCurrency(payment.amount)}</strong> · {methodLabels[payment.method] || payment.method} · {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("vi-VN") : "Chưa có ngày"}
                    </p>
                  ))}
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">
                  <span className="text-on-surface-variant">Lịch sử thay đổi hình thức đóng</span>
                  {(actionTarget.subscription?.billgo_cycle_changes || []).length === 0 ? (
                    <p className="mt-1 font-bold">Chưa có thay đổi</p>
                  ) : (actionTarget.subscription?.billgo_cycle_changes || []).map(change => (
                    <p key={change.id} className="mt-1">
                      <strong>{getBillGoCycleOption(change.old_cycle || "monthly").label}</strong> sang <strong>{getBillGoCycleOption(change.new_cycle || "monthly").label}</strong> từ {change.effective_period_start || "chưa có kỳ"}
                    </p>
                  ))}
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">
                  <span className="text-on-surface-variant">Lịch sử ngừng và kích hoạt lại</span>
                  {(actionTarget.subscription?.billgo_status_events || []).length === 0 ? (
                    <p className="mt-1 font-bold">Chưa có sự kiện</p>
                  ) : (actionTarget.subscription?.billgo_status_events || []).map(event => (
                    <p key={event.id} className="mt-1">
                      <strong>{event.event_type}</strong> {event.effective_period_start ? `từ ${event.effective_period_start}` : ""} {event.note ? `· ${event.note}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ) : actionMode === "edit" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input required className="input-field" placeholder="Tên khách hàng" value={editForm.customerName} onChange={e => setEditForm(prev => ({ ...prev, customerName: e.target.value }))} />
                <input className="input-field" placeholder="Số điện thoại" value={editForm.phone} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))} />
                <input required list="billgo-account-suggestions" className="input-field" placeholder="Account" value={editForm.account} onChange={e => setEditForm(prev => ({ ...prev, account: e.target.value }))} />
                <select className="input-field" value={editForm.provider} onChange={e => setEditForm(prev => ({ ...prev, provider: e.target.value }))}>
                  {providerSuggestions.map(provider => <option key={provider} value={provider}>{provider}</option>)}
                </select>
                <input list="billgo-edit-area-suggestions" className="input-field" placeholder="Xã/phường" value={editForm.areaName} onChange={e => updateEditAreaName(e.target.value)} />
                <datalist id="billgo-edit-area-suggestions">
                  {areas.filter(area => area.is_active !== false).map(area => <option key={area.id} value={area.name} />)}
                </datalist>
                <input list="billgo-edit-sub-area-suggestions" className="input-field" placeholder="Xóm/thôn/khối" value={editForm.subAreaName} onChange={e => updateEditSubAreaName(e.target.value)} disabled={!editForm.areaName.trim()} />
                <datalist id="billgo-edit-sub-area-suggestions">
                  {editSubAreas.map(subArea => <option key={subArea.id} value={subArea.name} />)}
                </datalist>
                <input className="input-field" placeholder="Địa chỉ chi tiết" value={editForm.addressDetail} onChange={e => setEditForm(prev => ({ ...prev, addressDetail: e.target.value }))} />
                <input required className="input-field" placeholder="Địa chỉ cũ / hiển thị dự phòng" value={editForm.address} onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))} />
                <input required className="input-field" placeholder="Gói cước hàng tháng" value={editForm.packageName} onChange={e => setEditForm(prev => {
                  const packageAmount = getNumericPackageAmount(e.target.value);
                  return { ...prev, packageName: e.target.value, monthlyFee: packageAmount || prev.monthlyFee };
                })} />
                <input required type="number" min="0" inputMode="numeric" className="input-field" placeholder="Số tiền cước một tháng" value={editForm.monthlyFee} onChange={e => setEditForm(prev => ({ ...prev, monthlyFee: e.target.value }))} />
                <textarea className="input-field min-h-20 sm:col-span-2" placeholder="Ghi chú" value={editForm.note} onChange={e => setEditForm(prev => ({ ...prev, note: e.target.value }))} />
              </div>
            ) : actionMode === "cycle" ? (
              <div className="mt-4 grid gap-3">
                <select className="input-field" value={editForm.cycle} onChange={e => setEditForm(prev => ({ ...prev, cycle: e.target.value as BillGoCycle }))}>
                  {BILLGO_CYCLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <input type="date" className="input-field" value={editForm.effectivePeriodStart} onChange={e => setEditForm(prev => ({ ...prev, effectivePeriodStart: e.target.value }))} />
                <textarea className="input-field min-h-20" placeholder="Ghi chú thay đổi" value={editForm.note} onChange={e => setEditForm(prev => ({ ...prev, note: e.target.value }))} />
                <p className="text-xs text-on-surface-variant">Hình thức mới chỉ áp dụng từ kỳ đầu tiên chưa được thanh toán hoặc khuyến mại.</p>
              </div>
            ) : actionMode === "delete" ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-lg bg-error-container/40 p-3 text-sm text-error">
                  Khách hàng sẽ bị xóa mềm khỏi danh sách thường dùng. Lịch sử giao dịch và báo cáo cũ vẫn được giữ.
                </div>
                <textarea className="input-field min-h-20" placeholder="Lý do hoặc ghi chú xóa" value={editForm.note} onChange={e => setEditForm(prev => ({ ...prev, note: e.target.value }))} />
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <input type="date" className="input-field" value={editForm.effectivePeriodStart} onChange={e => setEditForm(prev => ({ ...prev, effectivePeriodStart: e.target.value }))} />
                <textarea className="input-field min-h-20" placeholder="Ghi chú" value={editForm.note} onChange={e => setEditForm(prev => ({ ...prev, note: e.target.value }))} />
                <p className="text-xs text-on-surface-variant">
                  {actionTarget.subscription?.status === "paused" ? "Khi kích hoạt lại, hệ thống tạo kỳ mới từ kỳ bắt đầu đã chọn." : "Khi ngừng sử dụng, hệ thống giữ lịch sử và không tạo kỳ cước mới."}
                </p>
              </div>
            )}

            {actionMode !== "detail" && (
              <button disabled={saving || (actionMode === "edit" && toMoneyNumber(editForm.monthlyFee) < 0)} className="btn-primary mt-4 !w-full">
                {saving ? "Đang lưu..." : actionMode === "delete" ? "Xác nhận xóa mềm" : "Lưu thay đổi"}
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
