import { NextResponse } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACTION_BLOCK_MESSAGE, isDemoAccount } from "@/lib/demo-accounts";
import {
  BILLGO_ALL_TAB,
  BILLGO_CYCLE_OPTIONS,
  BillGoCycle,
  buildBillGoCoverageMonths,
  buildBillGoReceiptCode,
  buildBillGoReceiptLookupCode,
  getBillGoBillingPeriod,
  getBillGoCollectableAmount,
  getBillGoCycleOption,
  getBillGoNextPeriodStartDate,
  getBillGoStoredStatus,
  toBillGoDateInput,
  toMoneyNumber,
} from "@/lib/billgo";
import type { BillGoPackage } from "@/lib/billgo-packages";
import { BILLGO_SIGNUP_CYCLES } from "@/lib/billgo-packages";
import { canCollectBillGo, canManageBillGo } from "@/lib/worker-unit-permissions";
import { getAssignedBillGoAreaFilters, isBillGoSubscriptionInAssignedArea, resolveWorkerUnitScope, type WorkerUnitScope } from "@/lib/worker-unit-server";

const allowedCycles = new Set(BILLGO_CYCLE_OPTIONS.map(option => option.value));
const allowedPaymentMethods = new Set(["cash", "bank_transfer", "other"]);
const DEFAULT_BILLGO_PAGE_SIZE = 10;
const MAX_BILLGO_PAGE_SIZE = 50;
const allowedListStatuses = new Set(["all", "pending_cycle", "not_due", "unpaid", "paid", "partial", "overdue", "promo"]);
const allowedDueFilters = new Set(["all", "due_this_month", "not_due"]);

type WorkerContext = {
  admin: SupabaseClient;
  userId: string;
  workerId: string;
  isDemo: boolean;
  scope: WorkerUnitScope;
};

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const getAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const getWorkerContext = async (): Promise<WorkerContext | NextResponse> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Bạn chưa đăng nhập.", 401);

  const [{ data: profile }, { data: worker }] = await Promise.all([
    supabase.from("profiles").select("phone, email").eq("id", user.id).single(),
    supabase.from("workers").select("id").eq("user_id", user.id).single(),
  ]);
  if (!worker) return jsonError("Không tìm thấy hồ sơ thợ.", 403);

  const admin = getAdmin() || supabase;
  const scope = await resolveWorkerUnitScope(admin, user.id, worker.id);

  return { admin, userId: user.id, workerId: scope.scopedWorkerId, isDemo: isDemoAccount(profile), scope };
};

function canUseBillGoScope(scope: WorkerUnitScope) {
  return scope.enabledFeatures.billgo;
}

function canManageBillGoScope(scope: WorkerUnitScope) {
  return scope.enabledFeatures.billgo && (canManageBillGo(scope.role) || scope.unitOwnerId === scope.userId);
}

function canCollectBillGoScope(scope: WorkerUnitScope) {
  return scope.enabledFeatures.billgo && (canCollectBillGo(scope.role) || scope.unitOwnerId === scope.userId);
}

const asText = (value: unknown) => String(value || "").trim();

const getCollectionMonthFromDueDate = (dueDate: string) => {
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return toBillGoDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  return toBillGoDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
};

const resolveBillGoArea = async (
  db: SupabaseClient,
  userId: string,
  areaId: string | null,
  areaName: string,
  subAreaId: string | null,
  subAreaName: string,
) => {
  let resolvedAreaId = areaId;
  let resolvedSubAreaId = subAreaId;

  if (!resolvedAreaId && areaName) {
    const { data: existingArea } = await db
      .from("areas")
      .select("id")
      .eq("owner_id", userId)
      .ilike("name", areaName)
      .maybeSingle();

    if (existingArea?.id) {
      resolvedAreaId = existingArea.id;
    } else {
      const { data: createdArea, error: areaError } = await db
        .from("areas")
        .insert({
          name: areaName,
          area_type: "commune",
          owner_id: userId,
          created_by: userId,
        })
        .select("id")
        .single();
      if (areaError) return { error: areaError.message };
      resolvedAreaId = createdArea.id;
    }
  }

  if (resolvedAreaId && !resolvedSubAreaId && subAreaName) {
    const { data: existingSubArea } = await db
      .from("sub_areas")
      .select("id")
      .eq("area_id", resolvedAreaId)
      .ilike("name", subAreaName)
      .maybeSingle();

    if (existingSubArea?.id) {
      resolvedSubAreaId = existingSubArea.id;
    } else {
      const { data: createdSubArea, error: subAreaError } = await db
        .from("sub_areas")
        .insert({
          area_id: resolvedAreaId,
          name: subAreaName,
          sub_area_type: "village",
          created_by: userId,
        })
        .select("id")
        .single();
      if (subAreaError) return { error: subAreaError.message };
      resolvedSubAreaId = createdSubArea.id;
    }
  }

  return { areaId: resolvedAreaId, subAreaId: resolvedSubAreaId };
};

const todayInputForServer = () => toBillGoDateInput(new Date());

const parseMonthFilter = (value: string) => {
  const [rawYear, rawMonth] = value.split("-").map(Number);
  const today = new Date();
  const year = rawYear || today.getFullYear();
  const month = rawMonth && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : today.getMonth() + 1;
  return { year, month };
};

const monthStartInput = (year: number, month: number) =>
  toBillGoDateInput(new Date(year, month - 1, 1));

const getBillingParts = (collectionMonth: string) => {
  const date = new Date(collectionMonth);
  return {
    billingMonth: date.getMonth() + 1,
    billingYear: date.getFullYear(),
  };
};

const firstOfMonth = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return toBillGoDateInput(new Date());
  return toBillGoDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
};

const compareBillGoMonth = (left: string, right: string) =>
  firstOfMonth(left).localeCompare(firstOfMonth(right));

const addMonths = (value: string | Date, months: number) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  date.setMonth(date.getMonth() + months);
  return date;
};

const endOfMonth = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return toBillGoDateInput(new Date());
  return toBillGoDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

const withEffectiveNextPeriodStart = <T extends { covered_until?: string | null; next_period_start?: string | null }>(subscription: T) => ({
  ...subscription,
  next_period_start: subscription.covered_until
    ? getBillGoNextPeriodStartDate(subscription.covered_until)
    : subscription.next_period_start,
});

const getComputedListStatus = (row: {
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_date?: string | null;
  status?: string | null;
}) => {
  const total = toMoneyNumber(row.total_amount);
  const paid = toMoneyNumber(row.paid_amount);
  const debt = Math.max(total - paid, 0);
  const dueTime = row.due_date ? new Date(row.due_date).getTime() : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (row.status === "pending_cycle") return "pending_cycle";
  if (total > 0 && debt <= 0) return "paid";
  if (paid > 0 && debt > 0) return "partial";
  if (dueTime !== null && dueTime < today.getTime() && debt > 0) return "overdue";
  if (row.status === "paid" || row.status === "not_due" || row.status === "promo") return row.status;
  return "unpaid";
};

const matchesBillGoStatusFilter = (status: string, filter: string) => {
  if (filter === "all") return true;
  if (filter === "unpaid") return status === "unpaid" || status === "partial" || status === "overdue";
  return status === filter;
};

const previousUnpaidReceivableSelect = "id, subscription_id, total_amount, paid_amount, due_date, period_start, period_end, collection_month, billing_month, billing_year, status";

const getRowSearchText = (row: {
  subscription?: {
    customer_name?: string | null;
    phone?: string | null;
    internet_account?: string | null;
    customer_address?: string | null;
    address_detail?: string | null;
    legacy_address?: string | null;
    provider?: string | null;
    package_name?: string | null;
  } | null;
}) => [
  row.subscription?.customer_name,
  row.subscription?.phone,
  row.subscription?.internet_account,
  row.subscription?.customer_address,
  row.subscription?.address_detail,
  row.subscription?.legacy_address,
  row.subscription?.provider,
  row.subscription?.package_name,
].filter(Boolean).join(" ").toLocaleLowerCase("vi");

const isFutureBillGoDate = (value?: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(date.getTime()) && date.getTime() > today.getTime();
};

const normalizeMonthInput = (value: string) => /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : "";
const buildReceivableDraft = (
  subscription: {
    id: string;
    customer_id?: string | null;
    worker_id?: string | null;
    package_id?: string | null;
    package_name?: string | null;
    current_cycle?: string | null;
    cycle?: string | null;
    monthly_fee?: number | string | null;
    amount_per_cycle?: number | string | null;
  },
  userId: string,
  periodStart: string,
) => {
  const cycle = String(subscription.current_cycle || subscription.cycle || "monthly") as BillGoCycle;
  const option = getBillGoCycleOption(cycle);
  const monthlyFee = toMoneyNumber(subscription.monthly_fee ?? subscription.amount_per_cycle);
  const billing = getBillGoBillingPeriod(periodStart, cycle);
  const billingParts = getBillingParts(billing.collectionMonth);
  const nextPeriodStart = getBillGoNextPeriodStartDate(billing.periodEnd);
  const nextBilling = getBillGoBillingPeriod(nextPeriodStart, cycle);

  return {
    customer_id: subscription.customer_id,
    worker_id: subscription.worker_id,
    subscription_id: subscription.id,
    type: "subscription_fee",
    package_id: subscription.package_id,
    package_name_at_collection: subscription.package_name || "Internet",
    title: `Thu cước ${subscription.package_name || "Internet"}`,
    total_amount: getBillGoCollectableAmount(monthlyFee, cycle),
    due_date: billing.dueDate,
    period_start: billing.periodStart,
    period_end: billing.periodEnd,
    collection_month: billing.collectionMonth,
    usage_month: billing.usageMonth,
    billing_month: billingParts.billingMonth,
    billing_year: billingParts.billingYear,
    cycle_at_collection: cycle,
    billing_months: option.paidMonths,
    bonus_months: option.bonusMonths,
    service_months: option.paidMonths + option.bonusMonths,
    paid_amount: 0,
    monthly_fee_at_collection: monthlyFee,
    next_period_start: nextPeriodStart,
    next_due_date: nextBilling.dueDate,
    status: "unpaid",
    created_by: userId,
  };
};

type BillGoImportRow = {
  rowNumber?: number;
  customerName?: string;
  phone?: string;
  account?: string;
  address?: string;
  areaName?: string;
  subAreaName?: string;
  addressDetail?: string;
  provider?: string;
  packageName?: string;
  monthlyFee?: number | string | null;
  cycle?: string;
  startDate?: string;
  dueDate?: string;
  note?: string;
};

type BillGoImportSubscription = {
  id: string;
  customer_name?: string | null;
  phone?: string | null;
  internet_account?: string | null;
  customer_address?: string | null;
  area_id?: string | null;
  sub_area_id?: string | null;
  address_detail?: string | null;
  provider?: string | null;
  package_name?: string | null;
  current_cycle?: string | null;
  cycle?: string | null;
  monthly_fee?: number | string | null;
  amount_per_cycle?: number | string | null;
  covered_until?: string | null;
  next_period_start?: string | null;
};

type BillGoPackageSelection = Pick<BillGoPackage, "id" | "name" | "type" | "provider" | "monthly_price" | "setup_price" | "allowed_cycles">;

const normalizeImportText = (value: unknown) => String(value || "").trim();
const normalizeImportKey = (value: unknown) => normalizeImportText(value).toLocaleLowerCase("vi");
const normalizeImportPhone = (value: unknown) => normalizeImportText(value).replace(/\D/g, "");

const isSameImportValue = (left: unknown, right: unknown) =>
  normalizeImportText(left) === normalizeImportText(right);

const buildImportRowKey = (row: BillGoImportRow) => {
  const account = normalizeImportKey(row.account);
  if (account) return `account:${account}`;
  const phone = normalizeImportPhone(row.phone);
  return phone ? `phone:${phone}` : "";
};

const getDefaultImportStartDate = (monthFilter: string) => {
  if (/^\d{4}-\d{2}$/.test(monthFilter)) return `${monthFilter}-01`;
  const today = new Date();
  return toBillGoDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
};

const buildBillGoImportPlan = async (
  admin: SupabaseClient,
  workerId: string,
  rows: BillGoImportRow[],
) => {
  const { data: subscriptions, error } = await admin
    .from("billgo_subscriptions")
    .select("id, customer_name, phone, internet_account, customer_address, area_id, sub_area_id, address_detail, provider, package_name, current_cycle, cycle, monthly_fee, amount_per_cycle, covered_until, next_period_start")
    .eq("worker_id", workerId)
    .is("deleted_at", null)
    .not("status", "in", "(cancelled,deleted)")
    .limit(10000);
  if (error) return { error: error.message };

  const existingByAccount = new Map<string, BillGoImportSubscription>();
  const existingByPhone = new Map<string, BillGoImportSubscription>();
  const { data: areas } = await admin
    .from("areas")
    .select("id, name, sub_areas(id, name)")
    .limit(10000);
  const areaNameById = new Map<string, string>();
  const subAreaNameById = new Map<string, string>();
  for (const area of areas || []) {
    areaNameById.set(area.id, normalizeImportText(area.name));
    for (const subArea of area.sub_areas || []) subAreaNameById.set(subArea.id, normalizeImportText(subArea.name));
  }
  for (const subscription of (subscriptions || []) as BillGoImportSubscription[]) {
    const accountKey = normalizeImportKey(subscription.internet_account);
    const phoneKey = normalizeImportPhone(subscription.phone);
    if (accountKey) existingByAccount.set(accountKey, subscription);
    if (phoneKey) existingByPhone.set(phoneKey, subscription);
  }

  const seenKeys = new Set<string>();
  const seenAccounts = new Set<string>();
  const seenPhones = new Set<string>();
  const importedKeys = new Set<string>();
  const items = rows.map((rawRow, index) => {
    const row: BillGoImportRow = {
      ...rawRow,
      rowNumber: Number(rawRow.rowNumber || index + 2),
      customerName: normalizeImportText(rawRow.customerName),
      phone: normalizeImportText(rawRow.phone),
      account: normalizeImportText(rawRow.account),
      address: normalizeImportText(rawRow.address),
      areaName: normalizeImportText(rawRow.areaName),
      subAreaName: normalizeImportText(rawRow.subAreaName),
      addressDetail: normalizeImportText(rawRow.addressDetail),
      provider: normalizeImportText(rawRow.provider),
      packageName: normalizeImportText(rawRow.packageName) || "Cước Internet",
      cycle: normalizeImportText(rawRow.cycle),
      startDate: normalizeImportText(rawRow.startDate),
      dueDate: normalizeImportText(rawRow.dueDate),
      note: normalizeImportText(rawRow.note),
    };
    const rowKey = buildImportRowKey(row);
    const accountKey = normalizeImportKey(row.account);
    const phoneKey = normalizeImportPhone(row.phone);
    const monthlyFee = toMoneyNumber(rawRow.monthlyFee);
    const reasons: string[] = [];
    const changes: string[] = [];

    if (!row.customerName) reasons.push("Thiếu tên khách hàng");
    if (!row.account && !row.phone) reasons.push("Thiếu Account và SĐT");
    if (row.cycle && !allowedCycles.has(row.cycle as BillGoCycle)) reasons.push("Chu kỳ không hợp lệ");
    if (monthlyFee < 0) reasons.push("Số tiền cước không hợp lệ");
    if (accountKey && seenAccounts.has(accountKey)) reasons.push("Trùng tài khoản Internet trong danh sách");
    if (phoneKey && seenPhones.has(phoneKey)) reasons.push("Trùng SĐT trong danh sách");
    if (accountKey) seenAccounts.add(accountKey);
    if (phoneKey) seenPhones.add(phoneKey);
    if (rowKey && seenKeys.has(rowKey)) reasons.push("Trùng Account/SĐT trong file");
    if (rowKey) seenKeys.add(rowKey);
    if (rowKey) importedKeys.add(rowKey);

    const existing = (accountKey ? existingByAccount.get(accountKey) : null) || (phoneKey ? existingByPhone.get(phoneKey) : null);
    if (reasons.length > 0) return { row, status: "error", reasons, changes, subscriptionId: existing?.id || null };

    if (!existing) return { row: { ...row, monthlyFee }, status: "new", reasons, changes: ["Thêm mới khách BillGo"], subscriptionId: null };

    if (!isSameImportValue(existing.customer_name, row.customerName)) changes.push("Tên khách hàng");
    if (!isSameImportValue(existing.phone, row.phone)) changes.push("SĐT");
    if (!isSameImportValue(existing.internet_account, row.account)) changes.push("Account");
    if (!isSameImportValue(existing.customer_address, row.address)) changes.push("Địa chỉ");
    if (row.areaName && !isSameImportValue(areaNameById.get(existing.area_id || ""), row.areaName)) changes.push("Xã/phường");
    if (row.subAreaName && !isSameImportValue(subAreaNameById.get(existing.sub_area_id || ""), row.subAreaName)) changes.push("Xóm/thôn/khối");
    if (!isSameImportValue(existing.address_detail, row.addressDetail)) changes.push("Địa chỉ chi tiết");
    if (!isSameImportValue(existing.provider, row.provider)) changes.push("Nhà mạng");
    if (!isSameImportValue(existing.package_name, row.packageName)) changes.push("Gói cước");
    if (toMoneyNumber(existing.monthly_fee ?? existing.amount_per_cycle) !== monthlyFee) changes.push("Số tiền cước");
    if (String(existing.current_cycle || existing.cycle || "monthly") !== row.cycle) changes.push("Chu kỳ");

    return {
      row: { ...row, monthlyFee },
      status: changes.length > 0 ? "update" : "skip",
      reasons,
      changes,
      subscriptionId: existing.id,
      existing,
    };
  });

  const fileKeys = new Set(items.map(item => buildImportRowKey(item.row)).filter(Boolean));
  const missingFromFile = ((subscriptions || []) as BillGoImportSubscription[])
    .filter(subscription => {
      const key = subscription.internet_account
        ? `account:${normalizeImportKey(subscription.internet_account)}`
        : subscription.phone
          ? `phone:${normalizeImportPhone(subscription.phone)}`
          : "";
      return key && !fileKeys.has(key);
    })
    .slice(0, 200)
    .map(subscription => ({
      subscriptionId: subscription.id,
      customerName: subscription.customer_name,
      account: subscription.internet_account,
      phone: subscription.phone,
    }));

  const summary = items.reduce((acc, item) => {
    if (item.status === "new") acc.created += 1;
    if (item.status === "update") acc.updated += 1;
    if (item.status === "skip") acc.skipped += 1;
    if (item.status === "error") acc.errors += 1;
    return acc;
  }, { created: 0, updated: 0, skipped: 0, errors: 0 });

  return { items, summary, missingFromFile, importedKeys: Array.from(importedKeys) };
};

const buildPendingCycleRow = (subscription: {
  id: string;
  customer_id?: string | null;
  worker_id?: string | null;
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
  current_cycle?: string | null;
  cycle?: string | null;
  monthly_fee?: number | string | null;
  amount_per_cycle?: number | string | null;
  next_period_start?: string | null;
  next_due_date?: string | null;
  start_date?: string | null;
}) => ({
  id: `pending_cycle_${subscription.id}`,
  customer_id: subscription.customer_id,
  worker_id: subscription.worker_id,
  subscription_id: subscription.id,
  total_amount: 0,
  due_date: null,
  period_start: null,
  period_end: null,
  collection_month: null,
  usage_month: null,
  billing_month: null,
  billing_year: null,
  cycle_at_collection: null,
  billing_months: 0,
  bonus_months: 0,
  service_months: 0,
  next_due_date: null,
  paid_amount: 0,
  paid_at: null,
  payment_method: null,
  status: "pending_cycle",
  note: subscription.next_period_start ? "Chờ thiết lập lại chu kỳ" : "Chưa thiết lập chu kỳ",
  subscription,
  payments: [],
});

const buildNotDueRow = (
  subscription: {
    id: string;
    customer_id?: string | null;
    worker_id?: string | null;
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
    current_cycle?: string | null;
    cycle?: string | null;
    monthly_fee?: number | string | null;
    amount_per_cycle?: number | string | null;
    next_period_start?: string | null;
    next_due_date?: string | null;
    start_date?: string | null;
  },
  coverageType?: string | null,
  coveredMonth?: string | null,
) => {
  const cycle = String(subscription.current_cycle || subscription.cycle || "monthly") as BillGoCycle;
  const option = getBillGoCycleOption(cycle);
  const coverageStatus = coverageType === "paid" ? "paid" : coverageType === "promo" ? "promo" : "not_due";

  return {
    id: `not_due_${subscription.id}`,
    customer_id: subscription.customer_id,
    worker_id: subscription.worker_id,
    subscription_id: subscription.id,
    total_amount: 0,
    due_date: subscription.next_due_date,
    period_start: coveredMonth || subscription.next_period_start || subscription.start_date,
    period_end: coveredMonth ? endOfMonth(coveredMonth) : null,
    collection_month: coveredMonth || null,
    usage_month: coveredMonth || null,
    billing_month: null,
    billing_year: null,
    cycle_at_collection: cycle,
    billing_months: option.paidMonths,
    bonus_months: option.bonusMonths,
    service_months: option.paidMonths + option.bonusMonths,
    next_due_date: subscription.next_due_date,
    paid_amount: 0,
    paid_at: null,
    payment_method: null,
    status: coverageStatus,
    note: null,
    subscription,
    payments: [],
  };
};

const getBillGoRowCycle = (row: {
  id?: string | null;
  cycle_at_collection?: string | null;
  subscription?: { current_cycle?: string | null; cycle?: string | null } | null;
}) => {
  const isNotDueRow = String(row.id || "").startsWith("not_due_");
  return String(
    isNotDueRow
      ? row.subscription?.current_cycle || row.subscription?.cycle || row.cycle_at_collection || "monthly"
      : row.cycle_at_collection || row.subscription?.current_cycle || row.subscription?.cycle || "monthly"
  );
};

const ensureDueReceivables = async (
  admin: SupabaseClient,
  workerId: string,
  userId: string,
  monthFilter: string,
) => {
  const { year, month } = parseMonthFilter(monthFilter);
  const collectionMonth = monthStartInput(year, month);
  const todayInput = todayInputForServer();
  const todayMonth = firstOfMonth(todayInput);
  const targetCollectionMonth = compareBillGoMonth(collectionMonth, todayMonth) < 0 ? collectionMonth : todayMonth;

  await admin
    .from("billgo_receivables")
    .update({ status: "overdue" })
    .eq("worker_id", workerId)
    .lt("due_date", todayInput)
    .is("deleted_at", null)
    .in("status", ["unpaid", "partial", "due", "not_due"]);

  const { data: subscriptions, error: subscriptionError } = await admin
    .from("billgo_subscriptions")
    .select("id, customer_id, worker_id, customer_name, package_id, package_name, current_cycle, cycle, monthly_fee, amount_per_cycle, status, deleted_at, start_date, next_period_start, next_due_date, covered_until")
    .eq("worker_id", workerId)
    .eq("status", "active")
    .is("deleted_at", null)
    .or(`next_period_start.is.null,next_period_start.lte.${targetCollectionMonth}`);
  if (subscriptionError) return { error: subscriptionError.message };
  if (!subscriptions || subscriptions.length === 0) return { created: 0 };

  const { data: existing, error: existingError } = await admin
    .from("billgo_receivables")
    .select("subscription_id, period_start, period_end, cycle_at_collection")
    .eq("worker_id", workerId)
    .is("deleted_at", null)
    .not("subscription_id", "is", null);
  if (existingError) return { error: existingError.message };

  const existingBySubscription = new Map<string, NonNullable<typeof existing>>();
  const existingPeriodKeys = new Set<string>();
  for (const row of existing || []) {
    const subscriptionId = String(row.subscription_id || "");
    if (!subscriptionId) continue;
    existingPeriodKeys.add(`${subscriptionId}:${firstOfMonth(row.period_start || collectionMonth)}`);
    const rows = existingBySubscription.get(subscriptionId) || [];
    rows.push(row);
    existingBySubscription.set(subscriptionId, rows);
  }

  const nextPointers = new Map<string, { next_period_start: string; next_due_date: string }>();
  const rowsToCreate = (subscriptions || []).flatMap(subscription => {
    const cycle = String(subscription.current_cycle || subscription.cycle || "monthly");
    const subscriptionRows = existingBySubscription.get(subscription.id) || [];
    const latestRow = subscriptionRows
      .filter(row => row.period_start)
      .sort((a, b) => String(b.period_start || "").localeCompare(String(a.period_start || "")))[0];
    const seedStart = latestRow?.period_end
      ? getBillGoNextPeriodStartDate(latestRow.period_end)
      : subscription.covered_until
        ? getBillGoNextPeriodStartDate(subscription.covered_until)
        : subscription.next_period_start || subscription.start_date || targetCollectionMonth;
    let periodStart = firstOfMonth(seedStart);
    const drafts = [];

    for (let guard = 0; guard < 60; guard += 1) {
      const billing = getBillGoBillingPeriod(periodStart, cycle);
      if (compareBillGoMonth(billing.collectionMonth, targetCollectionMonth) > 0) {
        nextPointers.set(subscription.id, { next_period_start: billing.periodStart, next_due_date: billing.dueDate });
        break;
      }

      if (!existingPeriodKeys.has(`${subscription.id}:${billing.periodStart}`)) {
        drafts.push(buildReceivableDraft(subscription, userId, billing.periodStart));
        existingPeriodKeys.add(`${subscription.id}:${billing.periodStart}`);
      }

      periodStart = getBillGoNextPeriodStartDate(billing.periodEnd);
      const nextBilling = getBillGoBillingPeriod(periodStart, cycle);
      nextPointers.set(subscription.id, { next_period_start: nextBilling.periodStart, next_due_date: nextBilling.dueDate });
    }

    return drafts;
  });

  if (rowsToCreate.length > 0) {
    const { error: insertError } = await admin.from("billgo_receivables").insert(rowsToCreate);
    if (insertError && insertError.code !== "23505") return { error: insertError.message };
  }

  const subscriptionsById = new Map((subscriptions || []).map(subscription => [subscription.id, subscription]));
  const pointerUpdates = Array.from(nextPointers.entries()).filter(([subscriptionId, pointer]) => {
    const subscription = subscriptionsById.get(subscriptionId);
    return subscription?.next_period_start !== pointer.next_period_start || subscription?.next_due_date !== pointer.next_due_date;
  });
  await Promise.all(pointerUpdates.map(([subscriptionId, pointer]) =>
    admin
      .from("billgo_subscriptions")
      .update({ ...pointer, last_changed_by: userId })
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null)
  ));

  return { created: rowsToCreate.length };
};
export async function GET(request: Request) {
  const context = await getWorkerContext();
  if (context instanceof NextResponse) return context;
  const { admin, userId, workerId, scope } = context;
  if (!canUseBillGoScope(scope)) return jsonError("Bạn không có quyền truy cập BillGo.", 403);

  const { searchParams } = new URL(request.url);
  const monthFilter = searchParams.get("month") || todayInputForServer().slice(0, 7);
  const page = Math.max(Number(searchParams.get("page") || "1") || 1, 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || DEFAULT_BILLGO_PAGE_SIZE) || DEFAULT_BILLGO_PAGE_SIZE, 1), MAX_BILLGO_PAGE_SIZE);
  const requestedCycle = asText(searchParams.get("cycle"));
  const requestedStatus = asText(searchParams.get("status")) || "all";
  const requestedDue = asText(searchParams.get("due")) || "all";
  const areaId = asText(searchParams.get("areaId"));
  const subAreaId = asText(searchParams.get("subAreaId"));
  const searchQuery = asText(searchParams.get("q")).toLocaleLowerCase("vi");
  const cycleFilter = allowedCycles.has(requestedCycle as BillGoCycle) ? requestedCycle : BILLGO_ALL_TAB;
  const statusFilter = allowedListStatuses.has(requestedStatus) ? requestedStatus : "all";
  const dueFilter = allowedDueFilters.has(requestedDue) ? requestedDue : "all";
  const { year, month } = parseMonthFilter(monthFilter);
  const assignedFilters = scope.role === "bill_collector" ? await getAssignedBillGoAreaFilters(admin, userId) : null;
  const ensured = canManageBillGoScope(scope) ? await ensureDueReceivables(admin, workerId, userId, monthFilter) : { created: 0 };
  if ("error" in ensured && ensured.error) return jsonError(ensured.error);

  let subscriptionQuery = admin
    .from("billgo_subscriptions")
    .select("id, customer_id, worker_id, customer_name, phone, internet_account, customer_address, area_id, sub_area_id, address_detail, legacy_address, provider, package_id, package_name, cycle, current_cycle, amount_per_cycle, monthly_fee, next_period_start, next_due_date, covered_until, status, note, created_at, start_date")
    .eq("worker_id", workerId)
    .not("status", "in", "(cancelled,deleted)")
    .is("deleted_at", null);
  if (areaId) subscriptionQuery = subscriptionQuery.eq("area_id", areaId);
  if (subAreaId) subscriptionQuery = subscriptionQuery.eq("sub_area_id", subAreaId);
  if (searchQuery) {
    const escapedQuery = searchQuery.replace(/[%_]/g, "\\$&");
    subscriptionQuery = subscriptionQuery.or([
      `customer_name.ilike.%${escapedQuery}%`,
      `phone.ilike.%${escapedQuery}%`,
      `internet_account.ilike.%${escapedQuery}%`,
      `customer_address.ilike.%${escapedQuery}%`,
      `address_detail.ilike.%${escapedQuery}%`,
      `legacy_address.ilike.%${escapedQuery}%`,
      `provider.ilike.%${escapedQuery}%`,
      `package_name.ilike.%${escapedQuery}%`,
    ].join(","));
  }

  const { data: subscriptions, error: subscriptionError } = await subscriptionQuery.order("customer_name", { ascending: true });
  if (subscriptionError) return jsonError("Không thể tải khách BillGo: " + subscriptionError.message);

  const hydratedSubscriptions = (subscriptions || [])
    .map(subscription => withEffectiveNextPeriodStart(subscription))
    .filter(subscription => !assignedFilters || isBillGoSubscriptionInAssignedArea(subscription, assignedFilters));
  const subscriptionIds = hydratedSubscriptions.map(subscription => subscription.id);
  const coveredMonth = monthStartInput(year, month);
  const coveredMonthEnd = endOfMonth(coveredMonth);
  const [receivableResult, coverageResult, previousUnpaidResult] = subscriptionIds.length > 0
    ? await Promise.all([
        admin
          .from("billgo_receivables")
          .select("id, total_amount, due_date, period_start, period_end, collection_month, usage_month, billing_month, billing_year, cycle_at_collection, billing_months, bonus_months, service_months, next_period_start, next_due_date, paid_amount, paid_at, payment_method, status, note, subscription_id")
          .eq("worker_id", workerId)
          .in("subscription_id", subscriptionIds)
          .is("deleted_at", null)
          .or(`and(billing_month.eq.${month},billing_year.eq.${year}),and(period_start.lte.${coveredMonthEnd},period_end.gte.${coveredMonth})`),
        admin
          .from("billgo_payment_coverages")
          .select("subscription_id, coverage_type")
          .in("subscription_id", subscriptionIds)
          .eq("covered_month", coveredMonth),
        admin
          .from("billgo_receivables")
          .select(previousUnpaidReceivableSelect)
          .eq("worker_id", workerId)
          .in("subscription_id", subscriptionIds)
          .is("deleted_at", null)
          .in("status", ["unpaid", "partial", "overdue", "due"])
          .or(`period_end.lt.${coveredMonth},and(period_end.is.null,billing_year.lt.${year}),and(period_end.is.null,billing_year.eq.${year},billing_month.lt.${month})`)
          .order("billing_year", { ascending: false })
          .order("billing_month", { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const { data: currentRowsData, error: receivableError } = receivableResult;
  if (receivableError) return jsonError("Không thể tải kỳ thu BillGo: " + receivableError.message);
  if (coverageResult.error) return jsonError("Không thể tải tháng đã thanh toán BillGo: " + coverageResult.error.message);
  if (previousUnpaidResult.error) return jsonError("Không thể tải kỳ cước còn nợ BillGo: " + previousUnpaidResult.error.message);

  const subscriptionsById = new Map(hydratedSubscriptions.map(subscription => [subscription.id, subscription]));
  const coverageBySubscription = new Map(
    (coverageResult.data || []).map(coverage => [coverage.subscription_id, coverage.coverage_type])
  );
  const previousUnpaidBySubscription = new Map<string, unknown[]>();
  for (const previousRow of previousUnpaidResult.data || []) {
    const key = String(previousRow.subscription_id || "");
    if (!key) continue;
    const items = previousUnpaidBySubscription.get(key) || [];
    items.push(previousRow);
    previousUnpaidBySubscription.set(key, items);
  }
  const currentRowSubscriptionIds = new Set((currentRowsData || []).map(row => String(row.subscription_id || "")).filter(Boolean));
  const pendingCycleRows = hydratedSubscriptions
    .filter(subscription => subscription.status === "pending_cycle")
    .filter(subscription => !currentRowSubscriptionIds.has(subscription.id))
    .map(subscription => ({
      ...buildPendingCycleRow(subscription),
      previous_unpaid_receivables: previousUnpaidBySubscription.get(subscription.id) || [],
    }));
  const coveredRows = hydratedSubscriptions
    .filter(subscription => !currentRowSubscriptionIds.has(subscription.id))
    .filter(subscription => coverageBySubscription.has(subscription.id))
    .map(subscription => ({
      ...buildNotDueRow(subscription, coverageBySubscription.get(subscription.id), coveredMonth),
      previous_unpaid_receivables: previousUnpaidBySubscription.get(subscription.id) || [],
    }));
  const currentRows = [
    ...(currentRowsData || []).map(row => ({
      ...row,
      subscription: subscriptionsById.get(row.subscription_id || "") || null,
      previous_unpaid_receivables: previousUnpaidBySubscription.get(row.subscription_id || "") || [],
      payments: [],
    })),
    ...coveredRows,
    ...pendingCycleRows,
  ];
  const filteredRows = currentRows
    .filter(row => {
      const status = getComputedListStatus(row);
      if (cycleFilter !== BILLGO_ALL_TAB && getBillGoRowCycle(row) !== cycleFilter) return false;
      if (!matchesBillGoStatusFilter(status, statusFilter)) return false;
      if (dueFilter === "due_this_month" && row.due_date?.slice(0, 7) !== monthFilter) return false;
      if (dueFilter === "not_due" && status !== "not_due" && !isFutureBillGoDate(row.due_date)) return false;
      if (searchQuery && !getRowSearchText(row).includes(searchQuery)) return false;
      return true;
    })
    .sort((a, b) => {
      const dueCompare = String(a.due_date || "9999-12-31").localeCompare(String(b.due_date || "9999-12-31"));
      if (dueCompare !== 0) return dueCompare;
      return String(a.subscription?.customer_name || "").localeCompare(String(b.subscription?.customer_name || ""), "vi");
    });

  const totals = filteredRows.reduce((acc, row) => {
    const status = getComputedListStatus(row);
    const receivable = toMoneyNumber(row.total_amount);
    const paid = toMoneyNumber(row.paid_amount);
    const debt = Math.max(receivable - paid, 0);
    acc.totalCustomers += 1;
    acc.totalReceivable += receivable;
    acc.totalPaid += paid;
    acc.totalDebt += debt;
    if (status === "pending_cycle") acc.pendingCycle += 1;
    if (status === "not_due") acc.notDue += 1;
    if (status === "paid") acc.paid += 1;
    if (status === "partial") acc.partial += 1;
    if (status === "overdue") acc.overdue += 1;
    if (status === "promo") acc.promo += 1;
    if (status === "unpaid") acc.unpaid += 1;
    return acc;
  }, { totalCustomers: 0, pendingCycle: 0, unpaid: 0, paid: 0, partial: 0, overdue: 0, promo: 0, notDue: 0, totalReceivable: 0, totalPaid: 0, totalDebt: 0 });

  const total = filteredRows.length;
  const pageCount = Math.max(Math.ceil(total / limit), 1);
  const safePage = Math.min(page, pageCount);
  const from = (safePage - 1) * limit;
  const pageRows = filteredRows.slice(from, from + limit);
  const receivableIds = pageRows.map(row => row.id).filter(id => !String(id).startsWith("not_due_"));
  const pageSubscriptionIds = Array.from(
    new Set(pageRows.map(row => row.subscription?.id).filter((id): id is string => Boolean(id))),
  );
  const [paymentResult, cycleHistoryResult, statusHistoryResult, receiptHistoryResult] = await Promise.all([
    receivableIds.length > 0
      ? admin
          .from("payments")
          .select("id, receivable_id, amount, method, status, paid_at, note, billgo_receipts(receipt_code, lookup_code, qr_payload)")
          .in("receivable_id", receivableIds)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    pageSubscriptionIds.length > 0
      ? admin
          .from("billgo_cycle_changes")
          .select("id, subscription_id, old_cycle, new_cycle, effective_period_start, note, created_at")
          .in("subscription_id", pageSubscriptionIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    pageSubscriptionIds.length > 0
      ? admin
          .from("billgo_status_events")
          .select("id, subscription_id, event_type, effective_period_start, note, created_at")
          .in("subscription_id", pageSubscriptionIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    pageSubscriptionIds.length > 0
      ? admin
          .from("billgo_receipts")
          .select("receipt_code, lookup_code, qr_payload, subscription_id, period_start, period_end, paid_at, paid_amount, payment_method, note")
          .in("subscription_id", pageSubscriptionIds)
          .order("paid_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const { data: payments, error: paymentError } = paymentResult;
  if (paymentError) return jsonError("Không thể tải thanh toán BillGo: " + paymentError.message);
  if (cycleHistoryResult.error) return jsonError("Không thể tải lịch sử chu kỳ BillGo: " + cycleHistoryResult.error.message);
  if (statusHistoryResult.error) return jsonError("Không thể tải lịch sử trạng thái BillGo: " + statusHistoryResult.error.message);
  if (receiptHistoryResult.error) return jsonError("Không thể tải phiếu thu BillGo: " + receiptHistoryResult.error.message);

  const paymentsByReceivable = new Map<string, unknown[]>();
  for (const payment of payments || []) {
    const key = String(payment.receivable_id || "");
    const items = paymentsByReceivable.get(key) || [];
    items.push(payment);
    paymentsByReceivable.set(key, items);
  }
  const cycleHistoryBySubscription = new Map<string, unknown[]>();
  for (const change of cycleHistoryResult.data || []) {
    const key = String(change.subscription_id || "");
    const items = cycleHistoryBySubscription.get(key) || [];
    items.push(change);
    cycleHistoryBySubscription.set(key, items);
  }
  const statusHistoryBySubscription = new Map<string, unknown[]>();
  for (const event of statusHistoryResult.data || []) {
    const key = String(event.subscription_id || "");
    const items = statusHistoryBySubscription.get(key) || [];
    items.push(event);
    statusHistoryBySubscription.set(key, items);
  }
  const receiptHistoryBySubscription = new Map<string, unknown[]>();
  for (const receipt of receiptHistoryResult.data || []) {
    const key = String(receipt.subscription_id || "");
    const items = receiptHistoryBySubscription.get(key) || [];
    items.push(receipt);
    receiptHistoryBySubscription.set(key, items);
  }
  const hydratedRows = pageRows.map(row => ({
    ...row,
    payments: paymentsByReceivable.get(row.id) || [],
    subscription: row.subscription ? {
      ...row.subscription,
      billgo_cycle_changes: cycleHistoryBySubscription.get(row.subscription.id) || [],
      billgo_status_events: statusHistoryBySubscription.get(row.subscription.id) || [],
      billgo_receipts: receiptHistoryBySubscription.get(row.subscription.id) || [],
    } : null,
  }));

  return NextResponse.json({ rows: hydratedRows, created: ensured.created || 0, page: safePage, limit, total, pageCount, totals });
}
export async function POST(request: Request) {
  const context = await getWorkerContext();
  if (context instanceof NextResponse) return context;
  if (context.isDemo) return jsonError(DEMO_ACTION_BLOCK_MESSAGE, 403);
  const { admin, userId, workerId, scope } = context;
  if (!canManageBillGoScope(scope)) return jsonError("B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n t\u1ea1o kh\u00e1ch BillGo.", 403);

  const body = await request.json();
  const customerName = asText(body.customerName);
  const phone = asText(body.phone);
  const account = asText(body.account);
  const address = asText(body.address);
  const requestedAreaId = asText(body.areaId) || null;
  const requestedSubAreaId = asText(body.subAreaId) || null;
  const areaName = asText(body.areaName);
  const subAreaName = asText(body.subAreaName);
  const addressDetail = asText(body.addressDetail) || address;
  const provider = asText(body.provider);
  const packageId = asText(body.packageId) || null;
  let selectedPackage: BillGoPackageSelection | null = null;
  if (packageId) {
    const { data: packageRow, error: packageError } = await admin
      .from("billgo_packages")
      .select("id, name, type, provider, monthly_price, setup_price, allowed_cycles")
      .eq("id", packageId)
      .eq("is_active", true)
      .maybeSingle();
    if (packageError) return jsonError(packageError.message);
    if (!packageRow) return jsonError("G\u00f3i c\u01b0\u1edbc kh\u00f4ng c\u00f2n \u00e1p d\u1ee5ng.", 404);
    selectedPackage = packageRow as BillGoPackageSelection;
  }
  const packageName = selectedPackage?.name || asText(body.packageName) || "C\u01b0\u1edbc Internet";
  const monthlyFee = selectedPackage ? toMoneyNumber(selectedPackage.monthly_price) : toMoneyNumber(body.monthlyFee ?? body.amount);
  const cycle = asText(body.cycle);
  const hasCycle = allowedCycles.has(cycle as BillGoCycle);
  const allowedPackageCycles = selectedPackage?.allowed_cycles?.length
    ? Array.from(new Set([...selectedPackage.allowed_cycles, ...BILLGO_SIGNUP_CYCLES]))
    : BILLGO_SIGNUP_CYCLES;
  const startDate = asText(body.startDate);
  const dueDate = asText(body.dueDate);
  const note = asText(body.note);
  const isLegacyCustomer = body.isLegacyCustomer === true;
  const paidThroughMonth = isLegacyCustomer ? normalizeMonthInput(asText(body.paidThroughMonth)) : "";
  const paidAt = asText(body.initialPaidAt) || new Date().toISOString();
  const paymentMethod = allowedPaymentMethods.has(asText(body.initialPaymentMethod)) ? asText(body.initialPaymentMethod) : "cash";

  if (!customerName || !account || !address || monthlyFee < 0 || (cycle && (!hasCycle || !allowedPackageCycles.includes(cycle as BillGoCycle))) || (hasCycle && !startDate)) {
    return jsonError("Vui lòng nhập đầy đủ thông tin hợp lệ.");
  }

  const { data: duplicate } = await admin
    .from("billgo_subscriptions")
    .select("id")
    .eq("worker_id", workerId)
    .ilike("internet_account", account)
    .is("deleted_at", null)
    .not("status", "in", "(cancelled,deleted)")
    .maybeSingle();
  if (duplicate) return jsonError("Account n\u00e0y \u0111\u00e3 c\u00f3 trong BillGo.", 409);

  const firstBilling = hasCycle ? getBillGoBillingPeriod(startDate, cycle) : null;
  const location = await resolveBillGoArea(admin, userId, requestedAreaId, areaName, requestedSubAreaId, subAreaName);
  if ("error" in location) return jsonError(location.error || "Kh\u00f4ng th\u1ec3 t\u1ea1o \u0111\u1ecba b\u00e0n kh\u00e1ch h\u00e0ng.");

  const { data: subscription, error: subscriptionError } = await admin
    .from("billgo_subscriptions")
    .insert({
      customer_id: null, worker_id: workerId, customer_name: customerName, phone, internet_account: account, customer_address: address,
      area_id: location.areaId, sub_area_id: location.subAreaId, address_detail: addressDetail, legacy_address: address || null,
      provider: selectedPackage?.provider || provider || null, package_id: selectedPackage?.id || null, package_name: packageName,
      service_type: selectedPackage?.type || "internet", cycle: hasCycle ? cycle : null, current_cycle: hasCycle ? cycle : null, amount_per_cycle: monthlyFee, monthly_fee: monthlyFee,
      start_date: firstBilling?.periodStart || null, next_due_date: firstBilling?.dueDate || null, next_period_start: firstBilling?.periodStart || null,
      status: hasCycle ? "active" : "pending_cycle", note, created_by: userId, last_changed_by: userId,
    })
    .select("id")
    .single();
  if (subscriptionError) return jsonError(subscriptionError.message);

  if (!firstBilling) {
    return NextResponse.json({ subscriptionId: subscription.id, receivableId: null, collectionMonth: null, nextPeriodStart: null, coveredUntil: null, pendingCycle: true, receipt: null }, { status: 201 });
  }

  const subscriptionDraft = { id: subscription.id, customer_id: null, worker_id: workerId, package_id: selectedPackage?.id || null, package_name: packageName, current_cycle: cycle, cycle, monthly_fee: monthlyFee, amount_per_cycle: monthlyFee };
  const rowsToInsert = [];
  const paidThroughStart = paidThroughMonth ? firstOfMonth(paidThroughMonth) : "";
  let nextPeriodStart = firstBilling.periodStart;
  let nextDueDate = firstBilling.dueDate;
  let coveredUntil: string | null = null;
  let collectionMonth = firstBilling.collectionMonth;

  if (paidThroughStart && compareBillGoMonth(paidThroughStart, firstBilling.periodStart) >= 0) {
    let periodStart = firstBilling.periodStart;
    for (let guard = 0; guard < 240 && compareBillGoMonth(periodStart, paidThroughStart) <= 0; guard += 1) {
      const draft = buildReceivableDraft(subscriptionDraft, userId, periodStart);
      rowsToInsert.push({ ...draft, paid_amount: draft.total_amount, paid_at: paidAt, payment_method: paymentMethod, collected_by: userId, status: "paid", note });
      coveredUntil = draft.period_end;
      nextPeriodStart = draft.next_period_start;
      nextDueDate = draft.next_due_date;
      collectionMonth = draft.collection_month;
      periodStart = draft.next_period_start;
    }
  } else {
    const draft = buildReceivableDraft(subscriptionDraft, userId, firstBilling.periodStart);
    const effectiveDueDate = dueDate || draft.due_date;
    const effectiveCollectionMonth = getCollectionMonthFromDueDate(effectiveDueDate);
    rowsToInsert.push({ ...draft, due_date: effectiveDueDate, collection_month: effectiveCollectionMonth, billing_month: getBillingParts(effectiveCollectionMonth).billingMonth, billing_year: getBillingParts(effectiveCollectionMonth).billingYear, note });
  }

  const { data: receivables, error: receivableError } = await admin
    .from("billgo_receivables")
    .insert(rowsToInsert)
    .select("id, total_amount, period_start, period_end, billing_months, bonus_months, paid_amount, status");
  if (receivableError) {
    await admin.from("billgo_subscriptions").delete().eq("id", subscription.id);
    return jsonError(receivableError.message);
  }

  const paidReceivables = (receivables || []).filter(row => row.status === "paid" && toMoneyNumber(row.paid_amount) > 0);
  if (paidReceivables.length > 0) {
    const { data: payments, error: paymentError } = await admin
      .from("payments")
      .insert(paidReceivables.map(row => ({ job_id: null, receivable_id: row.id, amount: row.total_amount, method: paymentMethod, status: "paid", paid_at: paidAt, collected_by: userId, note: "\u0110\u00e3 thu \u0111\u1ebfn k\u1ef3 khi t\u1ea1o kh\u00e1ch BillGo" })))
      .select("id, receivable_id");
    if (paymentError) return jsonError(paymentError.message);
    const paymentByReceivable = new Map((payments || []).map(payment => [payment.receivable_id, payment.id]));
    const coverageRows = paidReceivables.flatMap(row => buildBillGoCoverageMonths(row.period_start, row.billing_months, row.bonus_months).map(month => ({ ...month, payment_id: paymentByReceivable.get(row.id) || null, receivable_id: row.id, subscription_id: subscription.id })));
    if (coverageRows.length > 0) {
      const { error: coverageError } = await admin.from("billgo_payment_coverages").insert(coverageRows);
      if (coverageError && coverageError.code !== "23505") return jsonError("Kh\u00f4ng th\u1ec3 l\u01b0u th\u00e1ng \u0111\u00e3 thu BillGo: " + coverageError.message, 409);
    }
  }

  await admin.from("billgo_subscriptions").update({ covered_until: coveredUntil, next_period_start: nextPeriodStart, next_due_date: nextDueDate, last_changed_by: userId }).eq("id", subscription.id);

  return NextResponse.json({ subscriptionId: subscription.id, receivableId: receivables?.[receivables.length - 1]?.id || null, collectionMonth, nextPeriodStart, coveredUntil, receipt: null }, { status: 201 });
}
export async function PATCH(request: Request) {
  const context = await getWorkerContext();
  if (context instanceof NextResponse) return context;
  if (context.isDemo) return jsonError(DEMO_ACTION_BLOCK_MESSAGE, 403);
  const { admin, userId, workerId, scope } = context;

  const body = await request.json();
  const action = asText(body.action);
  const managerActions = new Set(["import_preview", "import_apply", "bulk_entry_apply", "update_customer", "change_cycle", "pause", "reactivate", "soft_delete", "assign_area_bulk"]);
  if (managerActions.has(action) && !canManageBillGoScope(scope)) return jsonError("Bạn không có quyền quản lý dữ liệu BillGo.", 403);
  if (action === "collect" && !canCollectBillGoScope(scope)) return jsonError("Bạn không có quyền thu cước BillGo.", 403);

  if (action === "import_preview" || action === "import_apply" || action === "bulk_entry_apply") {
    const rows = Array.isArray(body.rows) ? body.rows as BillGoImportRow[] : [];
    if (rows.length === 0) return jsonError("Chưa có dữ liệu khách hàng để lưu.");
    if (rows.length > 1000) return jsonError("Mỗi lần chỉ nhập tối đa 1000 dòng.");

    const monthFilter = asText(body.monthFilter) || todayInputForServer().slice(0, 7);
    const defaultStartDate = getDefaultImportStartDate(monthFilter);
    const plan = await buildBillGoImportPlan(admin, workerId, rows);
    if ("error" in plan) return jsonError(plan.error || "Không thể xem trước dữ liệu nhập.");
    if (action === "import_preview") return NextResponse.json(plan);
    if (plan.summary.errors > 0) return jsonError("Vui lòng sửa các dòng lỗi trước khi đồng bộ.");
    if (action === "bulk_entry_apply") {
      const duplicatedRows = plan.items.filter(item => item.status === "update" || item.status === "skip");
      if (duplicatedRows.length > 0) {
        return NextResponse.json({
          error: "Một số dòng đã tồn tại theo SĐT hoặc tài khoản Internet. Vui lòng bỏ dòng trùng trước khi lưu.",
          rows: duplicatedRows.map(item => ({ rowNumber: item.row.rowNumber, customerName: item.row.customerName, account: item.row.account, phone: item.row.phone })),
        }, { status: 409 });
      }
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ rowNumber?: number; reason: string }> = [];

    for (const item of plan.items) {
      if (item.status === "skip") {
        skipped += 1;
        continue;
      }
      if (item.status === "error") {
        errors.push({ rowNumber: item.row.rowNumber, reason: item.reasons.join(", ") });
        continue;
      }

      const row = item.row;
      const cycle = row.cycle as BillGoCycle;
      const hasCycle = allowedCycles.has(cycle);
      const monthlyFee = toMoneyNumber(row.monthlyFee);
      const packageName = row.packageName || "Cước Internet";
      const location = await resolveBillGoArea(
        admin,
        userId,
        null,
        row.areaName || "",
        null,
        row.subAreaName || "",
      );
      if ("error" in location) {
        errors.push({ rowNumber: row.rowNumber, reason: location.error || "Không thể tạo khu vực" });
        continue;
      }

      if (item.status === "new") {
        const startDate = row.startDate || defaultStartDate;
        const billing = hasCycle ? getBillGoBillingPeriod(startDate, cycle) : null;
        const effectiveDueDate = billing ? row.dueDate || billing.dueDate : null;
        const collectionMonth = effectiveDueDate ? getCollectionMonthFromDueDate(effectiveDueDate) : null;
        const billingParts = collectionMonth ? getBillingParts(collectionMonth) : null;
        const option = hasCycle ? getBillGoCycleOption(cycle) : null;
        const nextPeriodStart = billing ? getBillGoNextPeriodStartDate(billing.periodEnd) : null;
        const nextBilling = nextPeriodStart ? getBillGoBillingPeriod(nextPeriodStart, cycle) : null;
        const totalAmount = hasCycle ? getBillGoCollectableAmount(monthlyFee, cycle) : 0;

        const { data: subscription, error: subscriptionError } = await admin
          .from("billgo_subscriptions")
          .insert({
            customer_id: null,
            worker_id: workerId,
            customer_name: row.customerName,
            phone: row.phone || null,
            internet_account: row.account || null,
            customer_address: row.address || row.addressDetail || null,
            area_id: location.areaId,
            sub_area_id: location.subAreaId,
            address_detail: row.addressDetail || row.address || null,
            legacy_address: row.address || null,
            provider: row.provider || null,
            package_name: packageName,
            service_type: "internet",
            cycle: hasCycle ? cycle : null,
            current_cycle: hasCycle ? cycle : null,
            amount_per_cycle: monthlyFee,
            monthly_fee: monthlyFee,
            start_date: billing?.periodStart || null,
            next_due_date: effectiveDueDate,
            next_period_start: billing?.periodStart || null,
            status: hasCycle ? "active" : "pending_cycle",
            note: row.note || null,
            created_by: userId,
            last_changed_by: userId,
          })
          .select("id")
          .single();
        if (subscriptionError || !subscription) {
          errors.push({ rowNumber: row.rowNumber, reason: subscriptionError?.message || "Không thể thêm khách" });
          continue;
        }

        if (!billing || !collectionMonth || !billingParts || !option || !effectiveDueDate || !nextPeriodStart || !nextBilling) {
          created += 1;
          continue;
        }

        const { error: receivableError } = await admin.from("billgo_receivables").insert({
          customer_id: null,
          worker_id: workerId,
          subscription_id: subscription.id,
          type: "subscription_fee",
          title: `Thu cước ${packageName}`,
          total_amount: totalAmount,
          due_date: effectiveDueDate,
          period_start: billing.periodStart,
          period_end: billing.periodEnd,
          collection_month: collectionMonth,
          usage_month: billing.usageMonth,
          billing_month: billingParts.billingMonth,
          billing_year: billingParts.billingYear,
          cycle_at_collection: cycle,
          billing_months: billing.billingMonths,
          bonus_months: billing.bonusMonths,
          service_months: option.paidMonths + option.bonusMonths,
          paid_amount: 0,
          monthly_fee_at_collection: monthlyFee,
          next_period_start: nextPeriodStart,
          next_due_date: nextBilling.dueDate,
          status: getBillGoStoredStatus(totalAmount, 0, effectiveDueDate),
          note: row.note || null,
          created_by: userId,
        });
        if (receivableError) {
          await admin.from("billgo_subscriptions").delete().eq("id", subscription.id);
          errors.push({ rowNumber: row.rowNumber, reason: receivableError.message });
          continue;
        }
        created += 1;
        continue;
      }

      if (item.status === "update" && item.subscriptionId) {
        const oldCycle = String(item.existing?.current_cycle || item.existing?.cycle || "monthly");
        const effectivePeriodStart = item.existing?.covered_until
          ? getBillGoNextPeriodStartDate(item.existing.covered_until)
          : item.existing?.next_period_start || row.startDate || defaultStartDate;
        const { error: updateError } = await admin
          .from("billgo_subscriptions")
          .update({
            customer_name: row.customerName,
            phone: row.phone || null,
            internet_account: row.account || null,
            customer_address: row.address || row.addressDetail || null,
            area_id: location.areaId,
            sub_area_id: location.subAreaId,
            address_detail: row.addressDetail || row.address || null,
            provider: row.provider || null,
            package_name: packageName,
            current_cycle: cycle,
            cycle,
            amount_per_cycle: monthlyFee,
            monthly_fee: monthlyFee,
            note: row.note || null,
            last_changed_by: userId,
          })
          .eq("id", item.subscriptionId)
          .eq("worker_id", workerId)
          .is("deleted_at", null);
        if (updateError) {
          errors.push({ rowNumber: row.rowNumber, reason: updateError.message });
          continue;
        }

        const option = getBillGoCycleOption(cycle);
        const currentMonth = getDefaultImportStartDate(monthFilter);
        const currentParts = getBillingParts(currentMonth);
        await admin
          .from("billgo_receivables")
          .update({
            title: `Thu cước ${packageName}`,
            total_amount: getBillGoCollectableAmount(monthlyFee, cycle),
            monthly_fee_at_collection: monthlyFee,
            cycle_at_collection: cycle,
            billing_months: option.paidMonths,
            bonus_months: option.bonusMonths,
            service_months: option.paidMonths + option.bonusMonths,
            status: "unpaid",
          })
          .eq("subscription_id", item.subscriptionId)
          .eq("billing_month", currentParts.billingMonth)
          .eq("billing_year", currentParts.billingYear)
          .eq("worker_id", workerId)
          .eq("paid_amount", 0)
          .in("status", ["unpaid", "overdue", "not_due", "due"]);

        if (oldCycle !== cycle) {
          await admin.from("billgo_cycle_changes").insert({
            subscription_id: item.subscriptionId,
            old_cycle: oldCycle,
            new_cycle: cycle,
            effective_period_start: effectivePeriodStart,
            changed_by: userId,
            note: "Đồng bộ từ Excel",
          });
        }
        updated += 1;
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      summary: { created, updated, skipped, errors: errors.length },
      errors,
      missingFromFile: plan.missingFromFile,
    }, { status: errors.length > 0 ? 207 : 200 });
  }

  if (action === "update_customer") {
    const subscriptionId = asText(body.subscriptionId);
    const monthlyFee = toMoneyNumber(body.monthlyFee);
    if (!subscriptionId || monthlyFee < 0) return jsonError("Thông tin khách hàng không hợp lệ.");
    const requestedAreaId = asText(body.areaId) || null;
    const requestedSubAreaId = asText(body.subAreaId) || null;
    const areaName = asText(body.areaName);
    const subAreaName = asText(body.subAreaName);
    const nextAddress = asText(body.address);
    const nextAddressDetail = asText(body.addressDetail) || nextAddress;
    const location = await resolveBillGoArea(admin, userId, requestedAreaId, areaName, requestedSubAreaId, subAreaName);
    if ("error" in location) return jsonError(location.error || "Không thể tạo địa bàn khách hàng.");
    const nextAreaId = location.areaId;
    const nextSubAreaId = location.subAreaId;

    const { data: currentSubscription } = await admin
      .from("billgo_subscriptions")
      .select("id, area_id, sub_area_id, address_detail, current_cycle, cycle")
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null)
      .maybeSingle();

    const { error } = await admin
      .from("billgo_subscriptions")
      .update({
        customer_name: asText(body.customerName),
        phone: asText(body.phone),
        internet_account: asText(body.account),
        customer_address: nextAddress,
        area_id: nextAreaId,
        sub_area_id: nextSubAreaId,
        address_detail: nextAddressDetail,
        provider: asText(body.provider) || null,
        package_name: asText(body.packageName) || "Cước Internet",
        monthly_fee: monthlyFee,
        amount_per_cycle: monthlyFee,
        note: asText(body.note),
        last_changed_by: userId,
      })
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null);
    if (error) return jsonError(error.message);
    const currentMonth = monthStartInput(new Date().getFullYear(), new Date().getMonth() + 1);
    const currentParts = getBillingParts(currentMonth);
    const currentCycle = String(currentSubscription?.current_cycle || currentSubscription?.cycle || "monthly");
    const currentUnpaidAmount = getBillGoCollectableAmount(monthlyFee, currentCycle);
    await admin
      .from("billgo_receivables")
      .update({
        total_amount: currentUnpaidAmount,
        monthly_fee_at_collection: monthlyFee,
        status: "unpaid",
      })
      .eq("subscription_id", subscriptionId)
      .eq("billing_month", currentParts.billingMonth)
      .eq("billing_year", currentParts.billingYear)
      .eq("worker_id", workerId)
      .eq("paid_amount", 0)
      .in("status", ["unpaid", "overdue", "not_due", "due"]);
    if (
      currentSubscription
      && (currentSubscription.area_id !== nextAreaId || currentSubscription.sub_area_id !== nextSubAreaId || (currentSubscription.address_detail || "") !== nextAddressDetail)
    ) {
      await admin.from("billgo_area_changes").insert({
        subscription_id: subscriptionId,
        old_area_id: currentSubscription.area_id,
        old_sub_area_id: currentSubscription.sub_area_id,
        new_area_id: nextAreaId,
        new_sub_area_id: nextSubAreaId,
        old_address_detail: currentSubscription.address_detail,
        new_address_detail: nextAddressDetail,
        changed_by: userId,
        note: "Cập nhật địa bàn khách BillGo",
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "change_cycle") {
    const subscriptionId = asText(body.subscriptionId);
    const newCycle = asText(body.cycle);
    const note = asText(body.note);
    if (!subscriptionId || !allowedCycles.has(newCycle as BillGoCycle)) return jsonError("Hình thức đóng không hợp lệ.");

    const { data: subscription, error: subscriptionError } = await admin
      .from("billgo_subscriptions")
      .select("id, customer_id, worker_id, package_id, package_name, current_cycle, cycle, monthly_fee, amount_per_cycle, covered_until, next_period_start, status")
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null)
      .single();
    if (subscriptionError || !subscription) return jsonError("Không tìm thấy khách hàng BillGo.", 404);

    const effectivePeriodStart = firstOfMonth(
      asText(body.effectivePeriodStart)
      || (subscription.covered_until ? getBillGoNextPeriodStartDate(subscription.covered_until) : subscription.next_period_start)
      || todayInputForServer()
    );
    const oldCycle = String(subscription.current_cycle || subscription.cycle || "pending_cycle");
    const cycleOption = getBillGoCycleOption(newCycle);
    const billing = getBillGoBillingPeriod(effectivePeriodStart, newCycle);
    const nextPeriodStart = getBillGoNextPeriodStartDate(billing.periodEnd);
    const nextBilling = getBillGoBillingPeriod(nextPeriodStart, newCycle);
    const billingParts = getBillingParts(billing.collectionMonth);
    const monthlyFee = toMoneyNumber(subscription.monthly_fee ?? subscription.amount_per_cycle);
    const totalAmount = getBillGoCollectableAmount(monthlyFee, newCycle);

    const { error: updateError } = await admin
      .from("billgo_subscriptions")
      .update({
        current_cycle: newCycle,
        cycle: newCycle,
        status: "active",
        start_date: subscription.status === "pending_cycle" ? billing.periodStart : undefined,
        next_period_start: billing.periodStart,
        next_due_date: billing.dueDate,
        last_changed_by: userId,
      })
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null);
    if (updateError) return jsonError(updateError.message);

    const deletedAt = new Date().toISOString();
    await admin
      .from("billgo_receivables")
      .update({ status: "deleted", deleted_at: deletedAt, deleted_by: userId })
      .eq("subscription_id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null)
      .eq("paid_amount", 0)
      .in("status", ["unpaid", "overdue", "not_due", "due"])
      .gte("period_start", billing.periodStart);

    const { data: existingReceivable } = await admin
      .from("billgo_receivables")
      .select("id")
      .eq("subscription_id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null)
      .eq("period_start", billing.periodStart)
      .maybeSingle();

    if (!existingReceivable) {
      const { error: insertError } = await admin.from("billgo_receivables").insert({
        customer_id: subscription.customer_id,
        worker_id: subscription.worker_id,
        subscription_id: subscriptionId,
        type: "subscription_fee",
        package_id: subscription.package_id,
        package_name_at_collection: subscription.package_name || "Internet",
        title: `Thu cước ${subscription.package_name || "Internet"}`,
        total_amount: totalAmount,
        due_date: billing.dueDate,
        period_start: billing.periodStart,
        period_end: billing.periodEnd,
        collection_month: billing.collectionMonth,
        usage_month: billing.usageMonth,
        billing_month: billingParts.billingMonth,
        billing_year: billingParts.billingYear,
        cycle_at_collection: newCycle,
        billing_months: cycleOption.paidMonths,
        bonus_months: cycleOption.bonusMonths,
        service_months: cycleOption.paidMonths + cycleOption.bonusMonths,
        paid_amount: 0,
        monthly_fee_at_collection: monthlyFee,
        next_period_start: nextPeriodStart,
        next_due_date: nextBilling.dueDate,
        status: getBillGoStoredStatus(totalAmount, 0, billing.dueDate),
        note,
        created_by: userId,
      });
      if (insertError && insertError.code !== "23505") return jsonError("Không thể tạo kỳ thu theo chu kỳ mới: " + insertError.message);
    }

    await admin.from("billgo_cycle_changes").insert({
      subscription_id: subscriptionId,
      old_cycle: oldCycle,
      new_cycle: newCycle,
      effective_period_start: billing.periodStart,
      changed_by: userId,
      note,
    });
    return NextResponse.json({ ok: true, effectivePeriodStart: billing.periodStart, nextDueDate: billing.dueDate });
  }

  if (action === "pause" || action === "reactivate") {
    const subscriptionId = asText(body.subscriptionId);
    const effectivePeriodStart = asText(body.effectivePeriodStart) || todayInputForServer();
    const note = asText(body.note);
    if (!subscriptionId) return jsonError("Thiếu khách hàng BillGo.");

    const update = action === "pause"
      ? { status: "paused", paused_at: new Date().toISOString(), last_changed_by: userId }
      : { status: "active", reactivated_at: new Date().toISOString(), reactivated_period_start: effectivePeriodStart, next_period_start: effectivePeriodStart, last_changed_by: userId };

    const { error } = await admin
      .from("billgo_subscriptions")
      .update(update)
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null);
    if (error) return jsonError(error.message);

    await admin.from("billgo_status_events").insert({
      subscription_id: subscriptionId,
      event_type: action === "pause" ? "paused" : "reactivated",
      effective_period_start: effectivePeriodStart,
      performed_by: userId,
      note,
    });
    if (action === "reactivate") {
      const monthFilter = effectivePeriodStart.slice(0, 7);
      await ensureDueReceivables(admin, workerId, userId, monthFilter);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "soft_delete") {
    const subscriptionId = asText(body.subscriptionId);
    const note = asText(body.note);
    if (!subscriptionId) return jsonError("Thiếu khách hàng BillGo.");

    const deletedAt = new Date().toISOString();
    const { error } = await admin
      .from("billgo_subscriptions")
      .update({ status: "deleted", deleted_at: deletedAt, last_changed_by: userId })
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null);
    if (error) return jsonError(error.message);

    await admin
      .from("billgo_receivables")
      .update({ status: "deleted", deleted_at: deletedAt, deleted_by: userId })
      .eq("subscription_id", subscriptionId)
      .in("status", ["unpaid", "partial", "overdue"]);

    await admin.from("billgo_status_events").insert({
      subscription_id: subscriptionId,
      event_type: "deleted",
      performed_by: userId,
      note,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "assign_area_bulk") {
    const subscriptionIds = Array.isArray(body.subscriptionIds) ? body.subscriptionIds.map(asText).filter(Boolean) : [];
    const areaId = asText(body.areaId) || null;
    const subAreaId = asText(body.subAreaId) || null;
    const addressDetail = asText(body.addressDetail);
    const note = asText(body.note);
    if (subscriptionIds.length === 0 || !areaId) return jsonError("Vui lòng chọn khách và xã cần gán.");

    const { data: subscriptions, error: loadError } = await admin
      .from("billgo_subscriptions")
      .select("id, area_id, sub_area_id, address_detail")
      .eq("worker_id", workerId)
      .in("id", subscriptionIds)
      .is("deleted_at", null);
    if (loadError) return jsonError(loadError.message);

    const { error: updateError } = await admin
      .from("billgo_subscriptions")
      .update({ area_id: areaId, sub_area_id: subAreaId, address_detail: addressDetail || undefined, last_changed_by: userId })
      .eq("worker_id", workerId)
      .in("id", subscriptionIds);
    if (updateError) return jsonError(updateError.message);

    const historyRows = (subscriptions || []).map(subscription => ({
      subscription_id: subscription.id,
      old_area_id: subscription.area_id,
      old_sub_area_id: subscription.sub_area_id,
      new_area_id: areaId,
      new_sub_area_id: subAreaId,
      old_address_detail: subscription.address_detail,
      new_address_detail: addressDetail || subscription.address_detail,
      changed_by: userId,
      note,
    }));
    if (historyRows.length > 0) await admin.from("billgo_area_changes").insert(historyRows);
    return NextResponse.json({ ok: true, updated: subscriptionIds.length });
  }

  if (action !== "collect") return jsonError("Hành động BillGo không hợp lệ.");

  const receivableId = asText(body.receivableId);
  const paidAmount = toMoneyNumber(body.amount);
  const paidAt = asText(body.paidAt) || new Date().toISOString();
  const method = allowedPaymentMethods.has(asText(body.method)) ? asText(body.method) : "cash";
  const note = asText(body.note);

  if (!receivableId || paidAmount < 0) return jsonError("Thông tin thu tiền không hợp lệ.");

  const { data: receivable, error: receivableError } = await admin
    .from("billgo_receivables")
    .select("id, worker_id, subscription_id, total_amount, due_date, period_start, period_end, cycle_at_collection, billing_months, bonus_months, paid_amount, status, monthly_fee_at_collection, subscription:billgo_subscriptions(current_cycle, cycle, customer_name, phone, internet_account, customer_address, area_id, sub_area_id, address_detail, legacy_address, package_name)")
    .eq("id", receivableId)
    .eq("worker_id", workerId)
    .is("deleted_at", null)
    .single();

  if (receivableError || !receivable) return jsonError("Không tìm thấy kỳ cước.", 404);
  if (receivable.status === "paid" || receivable.status === "promo") return jsonError("Kỳ cước này đã được xử lý.", 409);

  const receivableSubscription = Array.isArray(receivable.subscription) ? receivable.subscription[0] : receivable.subscription;
  if (scope.role === "bill_collector") {
    const assignedFilters = await getAssignedBillGoAreaFilters(admin, userId);
    if (!isBillGoSubscriptionInAssignedArea(receivableSubscription, assignedFilters)) {
      return jsonError("Bạn chỉ được thu khách trong địa bàn được giao.", 403);
    }
  }

  const alreadyPaid = toMoneyNumber(receivable.paid_amount);
  const nextPaid = alreadyPaid + paidAmount;
  if (paidAmount <= 0) return jsonError("Số tiền thực thu phải lớn hơn 0.");
  if (alreadyPaid >= toMoneyNumber(receivable.total_amount)) return jsonError("Không thể xác nhận trùng kỳ.", 409);

  const nextStatus = getBillGoStoredStatus(toMoneyNumber(receivable.total_amount), nextPaid, receivable.due_date);
  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      job_id: null,
      receivable_id: receivable.id,
      amount: paidAmount,
      method,
      status: "paid",
      paid_at: paidAt,
      collected_by: userId,
      note,
    })
    .select("id")
    .single();
  if (paymentError) return jsonError(paymentError.message);

  const { error: updateError } = await admin
    .from("billgo_receivables")
    .update({
      paid_amount: nextPaid,
      paid_at: paidAt,
      payment_method: method,
      collected_by: userId,
      status: nextStatus,
      note: note || undefined,
    })
    .eq("id", receivable.id);
  if (updateError) return jsonError(updateError.message);

  const subscriptionRelation = receivableSubscription;
  const { data: collector } = await admin
    .from("profiles")
    .select("full_name, phone")
    .eq("id", userId)
    .maybeSingle();
  const receiptCode = buildBillGoReceiptCode(payment.id, paidAt);
  const lookupCode = buildBillGoReceiptLookupCode(receiptCode);
  const receiptUrl = new URL(`/billgo/receipt/${lookupCode}`, request.url).toString();
  const { data: receipt, error: receiptError } = await admin
    .from("billgo_receipts")
    .insert({
      receipt_code: receiptCode,
      lookup_code: lookupCode,
      qr_payload: receiptUrl,
      payment_id: payment.id,
      receivable_id: receivable.id,
      subscription_id: receivable.subscription_id,
      worker_id: workerId,
      collected_by: userId,
      customer_name: subscriptionRelation?.customer_name || null,
      customer_phone: subscriptionRelation?.phone || null,
      internet_account: subscriptionRelation?.internet_account || null,
      customer_address: subscriptionRelation?.customer_address || subscriptionRelation?.address_detail || subscriptionRelation?.legacy_address || null,
      package_name: subscriptionRelation?.package_name || null,
      cycle_at_collection: subscriptionRelation?.current_cycle || subscriptionRelation?.cycle || receivable.cycle_at_collection || "monthly",
      period_start: receivable.period_start,
      period_end: receivable.period_end,
      total_amount: receivable.total_amount,
      paid_amount: paidAmount,
      remaining_amount: Math.max(toMoneyNumber(receivable.total_amount) - nextPaid, 0),
      payment_method: method,
      paid_at: paidAt,
      collector_name: collector?.full_name || collector?.phone || null,
      note,
    })
    .select("receipt_code, lookup_code, qr_payload")
    .single();
  if (receiptError) return jsonError("Không thể tạo phiếu thu BillGo: " + receiptError.message);

  if (nextPaid >= toMoneyNumber(receivable.total_amount) && receivable.subscription_id) {
    const coverages = buildBillGoCoverageMonths(receivable.period_start, receivable.billing_months, receivable.bonus_months).map(month => ({
      ...month,
      payment_id: payment.id,
      receivable_id: receivable.id,
      subscription_id: receivable.subscription_id,
    }));
    const { error: coverageError } = await admin.from("billgo_payment_coverages").insert(coverages);
    if (coverageError) return jsonError("Không thể lưu tháng bao phủ hoặc kỳ này đã được thu: " + coverageError.message, 409);

    const nextStart = getBillGoNextPeriodStartDate(receivable.period_end);
    const nextCycle = String(subscriptionRelation?.current_cycle || subscriptionRelation?.cycle || receivable.cycle_at_collection || "monthly");
    const nextBilling = getBillGoBillingPeriod(nextStart, nextCycle);
    await admin
      .from("billgo_subscriptions")
      .update({
        covered_until: receivable.period_end,
        next_period_start: nextStart,
        next_due_date: nextBilling.dueDate,
        last_changed_by: userId,
      })
      .eq("id", receivable.subscription_id);

    if (receivable.bonus_months > 0) {
      const cycle = getBillGoCycleOption("yearly");
      const promoStart = toBillGoDateInput(addMonths(receivable.period_start, cycle.paidMonths));
      await admin.from("billgo_receivables").insert({
        worker_id: workerId,
        subscription_id: receivable.subscription_id,
        type: "subscription_fee",
        title: "Tháng khuyến mại BillGo",
        total_amount: 0,
        due_date: promoStart,
        period_start: promoStart,
        period_end: endOfMonth(promoStart),
        collection_month: firstOfMonth(promoStart),
        usage_month: firstOfMonth(promoStart),
        billing_month: getBillingParts(firstOfMonth(promoStart)).billingMonth,
        billing_year: getBillingParts(firstOfMonth(promoStart)).billingYear,
        cycle_at_collection: "yearly",
        billing_months: 0,
        bonus_months: 1,
        service_months: 1,
        next_due_date: nextBilling.dueDate,
        paid_amount: 0,
        status: "promo",
        created_by: userId,
      });
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus, receipt });
}
