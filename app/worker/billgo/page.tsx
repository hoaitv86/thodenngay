"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  MoreVertical,
  PauseCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  BILLGO_ACCOUNT_SUGGESTIONS,
  BILLGO_ALL_TAB,
  BILLGO_CYCLE_OPTIONS,
  BillGoCycle,
  formatBillGoCurrency,
  getBillGoBillingPeriod,
  getBillGoCollectableAmount,
  getBillGoCycleOption,
  getBillGoNextPeriodStartDate,
  getBillGoReceivableSummary,
  toBillGoDateInput,
  toMoneyNumber,
} from "@/lib/billgo";
import {
  BILLGO_SIGNUP_CYCLES,
  getBillGoPackageTypeLabel,
  type BillGoPackage,
  type BillGoPackageType,
} from "@/lib/billgo-packages";
import { createClient } from "@/lib/supabase/client";
import { enqueueOfflineMutation, getCachedDataset, isLikelyOfflineError, logOfflineDebug, setCachedDataset, syncOfflineMutations } from "@/lib/offline/cache";
import { isBrowserOffline, makeWorkerDatasetKey, makeWorkerUserDatasetKey, type WorkerOfflineScope } from "@/lib/offline/worker-data";
import {
  BILLGO_SERVICE_ICON_CONFIG,
  BILLGO_SERVICE_ICON_TYPES,
  ServiceIcon,
  getBillGoServiceIconType,
  type BillGoServiceIconType,
} from "@/app/components/billgo/ServiceIcon";

type Payment = {
  id: string;
  amount: number | string;
  method: string;
  status: string;
  paid_at?: string | null;
  note?: string | null;
  billgo_receipts?: BillGoReceipt | BillGoReceipt[] | null;
};

type BillGoReceipt = {
  id?: string | null;
  payment_id?: string | null;
  receipt_code: string;
  lookup_code: string;
  qr_payload: string;
  status?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  paid_at?: string | null;
  paid_amount?: number | string | null;
  payment_method?: string | null;
  note?: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_note?: string | null;
};

type Receivable = {
  id: string;
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
  next_period_start?: string | null;
  next_due_date?: string | null;
  paid_amount?: number | string | null;
  paid_at?: string | null;
  payment_method?: string | null;
  status?: string | null;
  note?: string | null;
  subscription?: Subscription | null;
  payments?: Payment[] | null;
  previous_unpaid_receivables?: Array<{
    id: string;
    total_amount?: number | string | null;
    paid_amount?: number | string | null;
    due_date?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    collection_month?: string | null;
    billing_month?: number | null;
    billing_year?: number | null;
    status?: string | null;
  }> | null;
};

type Subscription = {
  id: string;
  customer_name?: string | null;
  phone?: string | null;
  internet_account?: string | null;
  tv360_account?: string | null;
  tv360_service_type?: string | null;
  service_type?: string | null;
  parent_subscription_id?: string | null;
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
  next_due_date?: string | null;
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
  billgo_receipts?: BillGoReceipt[] | null;
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
  cycle: BillGoCycle | "";
  customerName: string;
  account: string;
};

type BillGoReceiptEntry = {
  payment?: Payment;
  receipt: BillGoReceipt;
};

type ActionMode = "edit" | "cycle" | "status" | "detail" | "delete";
type BillGoImportRow = {
  rowNumber: number;
  customerName: string;
  phone: string;
  account: string;
  address: string;
  areaName: string;
  subAreaName: string;
  addressDetail: string;
  provider: string;
  packageName: string;
  monthlyFee: string;
  cycle: string;
  startDate: string;
  dueDate: string;
  note: string;
};

type BillGoImportPreviewItem = {
  row: BillGoImportRow;
  status: "new" | "update" | "skip" | "error";
  reasons: string[];
  changes: string[];
  subscriptionId?: string | null;
};

type BulkEntryRow = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  provider: string;
  account: string;
  packageId: string;
  packageName: string;
  monthlyFee: string;
  cycle: BillGoCycle | "";
  startMonth: string;
  note: string;
};

type Tv360ServiceType = "smart_tv360" | "receiver_tv360";

type Tv360AccountForm = {
  id: string;
  enabled: boolean;
  serviceType: Tv360ServiceType;
  account: string;
  packageId: string;
  packageName: string;
  monthlyFee: string;
  cycle: BillGoCycle | "";
};

type BulkEntryField = keyof Pick<BulkEntryRow, "customerName" | "phone" | "address" | "provider" | "account" | "packageName" | "cycle" | "startMonth">;

type BulkEntryError = {
  rowNumber: number;
  messages: string[];
  fieldErrors?: Partial<Record<BulkEntryField, string>>;
};

type BillGoImportPreview = {
  items: BillGoImportPreviewItem[];
  summary: { created: number; updated: number; skipped: number; errors: number };
  missingFromFile: Array<{ subscriptionId: string; customerName?: string | null; account?: string | null; phone?: string | null }>;
};

type BillGoListTotals = {
  totalCustomers: number;
  unpaid: number;
  paid: number;
  partial: number;
  overdue: number;
  promo: number;
  notDue: number;
  pendingCycle: number;
  totalReceivable: number;
  totalPaid: number;
  totalDebt: number;
};

type BillingPeriodQuickFilter = {
  month: string;
  label: string;
  source: "previous" | "current";
};

type BillGoServiceOverview = {
  type: BillGoServiceIconType;
  label: string;
  count: number;
  receivable: number;
  debt: number;
};

type BillGoListCacheResult = {
  rows?: Receivable[];
  page?: number | string;
  pageCount?: number | string;
  total?: number | string;
  totals?: Partial<BillGoListTotals>;
  meta?: unknown;
};

type WorkerProfileCache = {
  worker?: { id?: string | null } | null;
  storeId?: string | null;
};

const currentDate = new Date();
const todayInput = () => toBillGoDateInput(new Date());
const getNextPeriodStartDisplay = (subscription?: Subscription | null, fallback?: string | null) => {
  if (subscription?.covered_until) {
    const coveredUntil = new Date(subscription.covered_until);
    if (!Number.isNaN(coveredUntil.getTime())) {
      coveredUntil.setDate(coveredUntil.getDate() + 1);
      return toBillGoDateInput(coveredUntil);
    }
  }

  return subscription?.next_period_start || fallback || null;
};
const isSettledBillGoRow = (row?: Receivable | null) => {
  if (!row) return false;
  const total = toMoneyNumber(row.total_amount);
  return row.status === "paid" || row.status === "promo" || (total > 0 && toMoneyNumber(row.paid_amount) >= total);
};

const getPaidThroughDisplay = (row?: Receivable | null) =>
  row?.subscription?.covered_until || (isSettledBillGoRow(row) ? row?.period_end || null : null);

const getNextPeriodStartForRow = (row?: Receivable | null) => {
  const paidThrough = getPaidThroughDisplay(row);
  if (paidThrough) return getBillGoNextPeriodStartDate(paidThrough);
  return getNextPeriodStartDisplay(row?.subscription, row?.next_period_start || row?.period_start || null);
};

const getReceivableServiceIconType = (row?: Receivable | null) =>
  getBillGoServiceIconType([
    row?.subscription?.service_type,
    row?.subscription?.package_name,
    row?.subscription?.provider,
    row?.subscription?.note,
  ].filter(Boolean).join(" "));
const previousMonthFirstInput = () => {
  const today = new Date();
  return toBillGoDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1));
};
const currentMonthDayInput = (day: number) => {
  const today = new Date();
  return toBillGoDateInput(new Date(today.getFullYear(), today.getMonth(), day));
};
const monthInput = (date = currentDate) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getPreviousUnpaidReceivables = (item: Receivable) =>
  (item.previous_unpaid_receivables || []).filter(previous => {
    const total = toMoneyNumber(previous.total_amount);
    return total > 0 && toMoneyNumber(previous.paid_amount) < total;
  });
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
const monthYearLabel = (value: string) => {
  const date = parseDateInput(value);
  if (!date) return "tháng cước";
  return `tháng ${String(date.month).padStart(2, "0")}/${date.year}`;
};
const dateLabel = (value: string) => {
  const date = parseDateInput(value);
  if (!date) return value;
  return `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}`;
};
const BILLGO_VIEW_STATE_KEY = "billgo.collection.view";
const BILLGO_PAGE_SIZE = 30;
const emptyBillGoTotals: BillGoListTotals = {
  totalCustomers: 0,
  unpaid: 0,
  paid: 0,
  partial: 0,
  overdue: 0,
  promo: 0,
  notDue: 0,
  pendingCycle: 0,
  totalReceivable: 0,
  totalPaid: 0,
  totalDebt: 0,
};

const methodLabels: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  other: "Khác",
};

const providerSuggestions = ["Viettel", "VNPT", "FPT"];
const signupCycleOptions = BILLGO_CYCLE_OPTIONS.filter(option => BILLGO_SIGNUP_CYCLES.includes(option.value));

const billGoImportHeaders = [
  "Tên khách hàng",
  "SĐT",
  "Account",
  "Địa chỉ",
  "Xã/phường",
  "Xóm/thôn/khối",
  "Địa chỉ chi tiết",
  "Nhà mạng",
  "Gói cước",
  "Số tiền tháng",
  "Chu kỳ",
  "Kỳ bắt đầu",
  "Hạn nộp",
  "Ghi chú",
];

const emptyImportSummary = { created: 0, updated: 0, skipped: 0, errors: 0 };

const createBulkEntryRow = (): BulkEntryRow => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  customerName: "",
  phone: "",
  address: "",
  provider: providerSuggestions[0] || "Viettel",
  account: "",
  packageId: "",
  packageName: "",
  monthlyFee: "",
  cycle: "",
  startMonth: "",
  note: "",
});

const createTv360AccountForm = (): Tv360AccountForm => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  enabled: true,
  serviceType: "smart_tv360",
  account: "",
  packageId: "",
  packageName: "",
  monthlyFee: "",
  cycle: "",
});

const createOfflineMutationId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

const statusOptions = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "pending_cycle", label: "Chưa thiết lập chu kỳ" },
  { value: "unpaid", label: "Chưa thu" },
  { value: "paid", label: "Đã thu" },
  { value: "partial", label: "Thu thiếu" },
  { value: "overdue", label: "Quá hạn" },
  { value: "promo", label: "Khuyến mại" },
];

const dueFilterOptions = [
  { value: "all", label: "Tất cả hạn thu" },
  { value: "due_this_month", label: "Đến hạn tháng này" },
];

const normalizeImportHeader = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const billGoImportHeaderMap: Record<string, keyof Omit<BillGoImportRow, "rowNumber">> = {
  tenkhachhang: "customerName",
  khachhang: "customerName",
  customername: "customerName",
  name: "customerName",
  sdt: "phone",
  sodienthoai: "phone",
  phone: "phone",
  account: "account",
  taikhoan: "account",
  diachi: "address",
  address: "address",
  xaphuong: "areaName",
  xa: "areaName",
  phuong: "areaName",
  areaname: "areaName",
  xomthonkhoi: "subAreaName",
  thonxom: "subAreaName",
  subareaname: "subAreaName",
  diachichitiet: "addressDetail",
  addressdetail: "addressDetail",
  khuvuc: "addressDetail",
  nhamang: "provider",
  provider: "provider",
  goicuoc: "packageName",
  packagename: "packageName",
  sotienthang: "monthlyFee",
  cuocthang: "monthlyFee",
  monthlyfee: "monthlyFee",
  amount: "monthlyFee",
  sotien: "monthlyFee",
  chuky: "cycle",
  cycle: "cycle",
  hinhthucdong: "cycle",
  kybatdau: "startDate",
  startdate: "startDate",
  ngaybatdau: "startDate",
  hannop: "dueDate",
  handong: "dueDate",
  duedate: "dueDate",
  ghichu: "note",
  note: "note",
};

const normalizeImportCycle = (value: string) => {
  const normalized = normalizeImportHeader(value);
  if (!normalized) return "monthly";
  if (["monthly", "hangthang", "thang", "1thang"].includes(normalized)) return "monthly";
  if (["twomonths", "2thang", "haithang"].includes(normalized)) return "two_months";
  if (["threemonths", "3thang", "bathang"].includes(normalized)) return "three_months";
  if (["sixmonths", "6thang", "sauthang"].includes(normalized)) return "six_months";
  if (["yearly", "12thang", "nam", "1nam"].includes(normalized)) return "yearly";
  return value;
};

const normalizeImportDateValue = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  const serial = Number(trimmed);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    return toBillGoDateInput(new Date(Date.UTC(1899, 11, 30 + serial)));
  }
  return trimmed;
};

const normalizeImportMoneyValue = (value: string) => {
  const normalized = String(value || "").replace(/[^\d.-]/g, "");
  return normalized ? String(Number(normalized)) : "";
};

const buildImportRowsFromTable = (table: string[][]): BillGoImportRow[] => {
  const [headerRow, ...bodyRows] = table.filter(row => row.some(cell => String(cell || "").trim()));
  if (!headerRow) return [];
  const fieldByColumn = headerRow.map(header => billGoImportHeaderMap[normalizeImportHeader(header)]);
  return bodyRows
    .map((cells, index) => {
      const row: BillGoImportRow = {
        rowNumber: index + 2,
        customerName: "",
        phone: "",
        account: "",
        address: "",
        areaName: "",
        subAreaName: "",
        addressDetail: "",
        provider: "",
        packageName: "",
        monthlyFee: "",
        cycle: "monthly",
        startDate: "",
        dueDate: "",
        note: "",
      };
      cells.forEach((cell, columnIndex) => {
        const field = fieldByColumn[columnIndex];
        if (field) row[field] = String(cell || "").trim();
      });
      row.monthlyFee = normalizeImportMoneyValue(row.monthlyFee);
      row.cycle = normalizeImportCycle(row.cycle);
      row.startDate = normalizeImportDateValue(row.startDate);
      row.dueDate = normalizeImportDateValue(row.dueDate);
      return row;
    })
    .filter(row => row.customerName || row.phone || row.account);
};

const parseCsvTable = (text: string) => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  rows.push(row);
  return rows;
};

const inflateRaw = async (data: Uint8Array) => {
  const source = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const stream = new Blob([source]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const unzipXlsxEntries = async (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("File Excel không hợp lệ.");
  const entryCount = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries = new Map<string, string>();
  const decoder = new TextDecoder();

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const content = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
    if (content) entries.set(name, decoder.decode(content));
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
};

const getXmlText = (node: Element, tagName: string) =>
  node.getElementsByTagName(tagName)[0]?.textContent || "";

const columnIndexFromRef = (ref: string) =>
  ref.replace(/\d/g, "").split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;

const parseXlsxTable = async (file: File) => {
  const entries = await unzipXlsxEntries(await file.arrayBuffer());
  const parser = new DOMParser();
  const sharedXml = entries.get("xl/sharedStrings.xml");
  const sharedStrings = sharedXml
    ? Array.from(parser.parseFromString(sharedXml, "application/xml").getElementsByTagName("si")).map(item => item.textContent || "")
    : [];
  const sheetXml = entries.get("xl/worksheets/sheet1.xml")
    || Array.from(entries.entries()).find(([name]) => name.startsWith("xl/worksheets/sheet"))?.[1];
  if (!sheetXml) throw new Error("Không tìm thấy sheet dữ liệu trong file Excel.");
  const documentXml = parser.parseFromString(sheetXml, "application/xml");
  return Array.from(documentXml.getElementsByTagName("row")).map(rowNode => {
    const cells: string[] = [];
    Array.from(rowNode.getElementsByTagName("c")).forEach(cellNode => {
      const ref = cellNode.getAttribute("r") || "";
      const columnIndex = ref ? columnIndexFromRef(ref) : cells.length;
      const type = cellNode.getAttribute("t");
      const rawValue = type === "inlineStr" ? getXmlText(cellNode, "t") : getXmlText(cellNode, "v");
      cells[columnIndex] = type === "s" ? sharedStrings[Number(rawValue)] || "" : rawValue;
    });
    return cells;
  });
};

const parseBillGoImportFile = async (file: File) => {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx")) return buildImportRowsFromTable(await parseXlsxTable(file));
  const text = await file.text();
  if (lowerName.endsWith(".xls") && text.includes("<table")) {
    const rows = Array.from(text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map(rowMatch =>
      Array.from(rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(cellMatch =>
        cellMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim(),
      ),
    );
    return buildImportRowsFromTable(rows);
  }
  return buildImportRowsFromTable(parseCsvTable(text));
};

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
  serviceType: "internet" as BillGoServiceIconType,
  provider: "Viettel",
  packageId: "",
  packageName: "",
  monthlyFee: "",
  cycle: "" as BillGoCycle | "",
  startDate: "",
  dueDate: "",
  note: "",
  isLegacyCustomer: false,
  paidThroughMonth: "",
  initialPaidAt: todayInput(),
  initialPaymentMethod: "cash",
  hasTv360: false,
  tv360Accounts: [] as Tv360AccountForm[],
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

const uniqueAddressParts = (...values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  return values
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .filter(value => {
      const key = value.toLocaleLowerCase("vi");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const buildCustomerAddressInput = (subscription: Subscription | null | undefined, subAreaName?: string | null) =>
  uniqueAddressParts(
    subAreaName,
    subscription?.address_detail,
    subscription?.customer_address,
    subscription?.legacy_address,
  ).join(", ");

const isSameMonth = (dateValue: string | null | undefined, monthValue: string) =>
  !!dateValue && dateValue.slice(0, 7) === monthValue;

const isFutureDate = (dateValue: string | null | undefined) => {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(date.getTime()) && date.getTime() > today.getTime();
};

const matchesBillGoStatusFilter = (status: string, filter: string) => {
  if (filter === "all") return true;
  if (filter === "unpaid") return status === "unpaid" || status === "partial" || status === "overdue";
  return status === filter;
};

const getPaymentReceipts = (payment: Payment): BillGoReceipt[] => {
  const receipts = payment.billgo_receipts;
  if (!receipts) return [];
  return Array.isArray(receipts) ? receipts : [receipts];
};

const getReceiptEntries = (item: Receivable): BillGoReceiptEntry[] =>
  (item.subscription?.billgo_receipts || []).length > 0
    ? (item.subscription?.billgo_receipts || [])
      .map(receipt => ({ receipt }))
      .sort((a, b) => {
        const paidCompare = new Date(b.receipt.paid_at || 0).getTime() - new Date(a.receipt.paid_at || 0).getTime();
        if (paidCompare !== 0) return paidCompare;
        return b.receipt.receipt_code.localeCompare(a.receipt.receipt_code);
      })
    : (item.payments || [])
      .flatMap(payment => getPaymentReceipts(payment).map(receipt => ({ payment, receipt })))
    .sort((a, b) => {
      const paidCompare = new Date(b.payment?.paid_at || 0).getTime() - new Date(a.payment?.paid_at || 0).getTime();
      if (paidCompare !== 0) return paidCompare;
      return b.receipt.receipt_code.localeCompare(a.receipt.receipt_code);
    });

const getBillGoRowCycle = (item: Receivable): BillGoCycle | "" => {
  if (item.status === "pending_cycle" || item.subscription?.status === "pending_cycle") return "";
  return (String(item.id || "").startsWith("not_due_")
    ? item.subscription?.current_cycle || item.subscription?.cycle || item.cycle_at_collection || "monthly"
    : item.cycle_at_collection || item.subscription?.current_cycle || item.subscription?.cycle || "monthly") as BillGoCycle;
};

const getSignupCycleValues = (allowedCycles?: BillGoCycle[] | null) =>
  new Set([...(allowedCycles || []), ...BILLGO_SIGNUP_CYCLES]);

const subAreaNameCollator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

const upfrontSignupCycles = new Set<BillGoCycle>(["two_months", "three_months", "six_months", "yearly"]);

const applySignupCycleDefaults = <T extends { cycle: BillGoCycle | ""; startDate: string; dueDate: string }>(form: T, cycle: BillGoCycle | ""): T => {
  if (!cycle) return { ...form, cycle, startDate: "", dueDate: "" };
  if (cycle === "monthly") {
    return { ...form, cycle, startDate: previousMonthFirstInput(), dueDate: "" };
  }
  if (upfrontSignupCycles.has(cycle)) {
    return { ...form, cycle, startDate: currentMonthDayInput(1), dueDate: currentMonthDayInput(28) };
  }
  return { ...form, cycle };
};

export default function WorkerBillGoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Receivable[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cycle" | "area">("cycle");
  const [activeTab, setActiveTab] = useState<BillGoCycle | typeof BILLGO_ALL_TAB>(BILLGO_ALL_TAB);
  const [monthFilter, setMonthFilter] = useState(monthInput());
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [areaStatusFilter, setAreaStatusFilter] = useState("all");
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [selectedSubAreaId, setSelectedSubAreaId] = useState("");
  const [viewStateHydrated, setViewStateHydrated] = useState(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [serverTotals, setServerTotals] = useState<BillGoListTotals>(emptyBillGoTotals);
  const [packages, setPackages] = useState<BillGoPackage[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkEntryRow[]>(() => [createBulkEntryRow()]);
  const [selectedBulkRowIds, setSelectedBulkRowIds] = useState<string[]>([]);
  const [bulkErrors, setBulkErrors] = useState<BulkEntryError[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<BillGoImportRow[]>([]);
  const [importPreview, setImportPreview] = useState<BillGoImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [packageSearch, setPackageSearch] = useState("");
  const [showPackageSuggestions, setShowPackageSuggestions] = useState(false);
  const [collecting, setCollecting] = useState<Receivable | null>(null);
  const [actionTarget, setActionTarget] = useState<Receivable | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<Receivable | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
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
    cycle: "" as BillGoCycle | "",
    effectivePeriodStart: todayInput(),
  });
  const [selectedReceivableIds, setSelectedReceivableIds] = useState<string[]>([]);
  const [billingPeriodFilter, setBillingPeriodFilter] = useState<BillingPeriodQuickFilter | null>(null);
  const [showBulkCycle, setShowBulkCycle] = useState(false);
  const [bulkCycleForm, setBulkCycleForm] = useState({
    cycle: "monthly" as BillGoCycle,
    effectivePeriodStart: todayInput(),
    note: "",
  });

  const applyBillGoListResult = useCallback((result: BillGoListCacheResult) => {
    setRows(normalizeRows(result.rows || []));
    setPage(Number(result.page || 1));
    setPageCount(Number(result.pageCount || 1));
    setTotalRows(Number(result.total || 0));
    setServerTotals({ ...emptyBillGoTotals, ...(result.totals || {}) });
  }, []);

  const loadBillGoOfflineScope = useCallback(async (): Promise<WorkerOfflineScope | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const profileKey = makeWorkerUserDatasetKey("worker-profile", user.id);
    const cachedProfile = await getCachedDataset<WorkerProfileCache>(profileKey);
    if (cachedProfile?.data.worker?.id) {
      return { userId: user.id, workerId: cachedProfile.data.worker.id, storeId: cachedProfile.data.storeId || null };
    }

    if (typeof window !== "undefined" && !window.navigator.onLine) {
      logOfflineDebug("server fetch skipped", { dataset: "worker-profile", userId: user.id, reason: "offline" });
      return { userId: user.id, workerId: "pending", storeId: null };
    }

    const [{ data: worker, error: workerError }, { data: membership }] = await Promise.all([
      supabase
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("worker_unit_members")
        .select("unit_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

    if (workerError || !worker?.id) {
      logOfflineDebug("server fetch error", { dataset: "worker-profile", userId: user.id, reason: workerError?.message || "missing-worker" });
      return { userId: user.id, workerId: "pending", storeId: null };
    }

    const storeId = cachedProfile?.data.storeId || membership?.unit_id || null;
    void setCachedDataset(profileKey, { worker, storeId } satisfies WorkerProfileCache, { dataset: "worker-profile", userId: user.id, workerId: worker.id, storeId });
    return { userId: user.id, workerId: worker.id, storeId };
  }, [supabase]);

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
          dueFilter: string;
          areaStatusFilter: string;
          selectedAreaId: string;
          selectedSubAreaId: string;
          query: string;
          billingPeriodFilter: BillingPeriodQuickFilter | null;
        }>;
        if (saved.viewMode) setViewMode(saved.viewMode);
        if (saved.activeTab) setActiveTab(saved.activeTab);
        if (saved.billingPeriodFilter?.month) {
          setMonthFilter(saved.billingPeriodFilter.month);
        } else if (saved.monthFilter === monthInput()) {
          setMonthFilter(saved.monthFilter);
        }
        if (saved.statusFilter && saved.statusFilter !== "not_due") setStatusFilter(saved.statusFilter);
        if (saved.dueFilter && saved.dueFilter !== "not_due") setDueFilter(saved.dueFilter);
        if (saved.areaStatusFilter && saved.areaStatusFilter !== "not_due") setAreaStatusFilter(saved.areaStatusFilter);
        if (typeof saved.selectedAreaId === "string") setSelectedAreaId(saved.selectedAreaId);
        if (typeof saved.selectedSubAreaId === "string") setSelectedSubAreaId(saved.selectedSubAreaId);
        if (typeof saved.query === "string") setQuery(saved.query);
        if (saved.billingPeriodFilter?.month) setBillingPeriodFilter(saved.billingPeriodFilter);
      } catch {
        window.localStorage.removeItem(BILLGO_VIEW_STATE_KEY);
      } finally {
        setViewStateHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!viewStateHydrated) return;
    window.localStorage.setItem(BILLGO_VIEW_STATE_KEY, JSON.stringify({
      viewMode,
      activeTab,
      monthFilter,
      statusFilter,
      dueFilter,
      areaStatusFilter,
      selectedAreaId,
      selectedSubAreaId,
      query,
      billingPeriodFilter,
    }));
  }, [activeTab, areaStatusFilter, billingPeriodFilter, dueFilter, monthFilter, query, selectedAreaId, selectedSubAreaId, statusFilter, viewMode, viewStateHydrated]);

  const fetchAreas = useCallback(async () => {
    const cacheScope = await loadBillGoOfflineScope();
    const cacheKey = cacheScope ? makeWorkerDatasetKey("areas", cacheScope) : null;
    const offline = isBrowserOffline();
    const cached = offline && cacheKey ? await getCachedDataset<AreaOption[]>(cacheKey) : null;

    if (offline) {
      if (cached) {
        setAreas(cached.data);
        logOfflineDebug("hydrated from cache", { dataset: "areas", cacheKey, recordCount: cached.data.length });
      }
      logOfflineDebug("server fetch skipped", { dataset: "areas", cacheKey, reason: "offline" });
      return;
    }

    try {
      const response = await fetch("/api/worker/areas");
      if (!response.ok) throw new Error("Không thể tải khu vực.");
      const result = await response.json();
      const nextAreas = (result.areas || []) as AreaOption[];
      setAreas(nextAreas);
      if (cacheKey) void setCachedDataset(cacheKey, nextAreas, { dataset: "areas", userId: cacheScope?.userId, workerId: cacheScope?.workerId, storeId: cacheScope?.storeId || null });
    } catch (error) {
      logOfflineDebug("skipped cache overwrite", { dataset: "areas", cacheKey, reason: error instanceof Error ? error.message : "fetch-error" });
      if (!cached) setAreas([]);
    }
  }, [loadBillGoOfflineScope]);

  const fetchPackages = useCallback(async () => {
    const cacheScope = await loadBillGoOfflineScope();
    const cacheKey = cacheScope ? makeWorkerDatasetKey("packages", cacheScope) : null;
    const offline = isBrowserOffline();
    const cached = offline && cacheKey ? await getCachedDataset<BillGoPackage[]>(cacheKey) : null;

    if (offline) {
      if (cached) {
        setPackages(cached.data);
        logOfflineDebug("hydrated from cache", { dataset: "packages", cacheKey, recordCount: cached.data.length });
      }
      logOfflineDebug("server fetch skipped", { dataset: "packages", cacheKey, reason: "offline" });
      return;
    }

    const { data, error } = await supabase
      .from("billgo_packages")
      .select("id, code, name, type, provider, monthly_price, setup_price, allowed_cycles, description, is_active, sort_order")
      .eq("is_active", true)
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      logOfflineDebug("skipped cache overwrite", { dataset: "packages", cacheKey, reason: error.message });
      if (!cached) setPackages([]);
      return;
    }
    const nextPackages = (data || []) as BillGoPackage[];
    setPackages(nextPackages);
    if (cacheKey) void setCachedDataset(cacheKey, nextPackages, { dataset: "packages", userId: cacheScope?.userId, workerId: cacheScope?.workerId, storeId: cacheScope?.storeId || null });
  }, [loadBillGoOfflineScope, supabase]);

  const fetchBillGo = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const params = new URLSearchParams({
      month: monthFilter,
      page: String(page),
      limit: String(BILLGO_PAGE_SIZE),
      due: dueFilter,
      q: query.trim(),
    });
    if (viewMode === "cycle" && activeTab !== BILLGO_ALL_TAB) params.set("cycle", activeTab);
    params.set("status", viewMode === "area" ? areaStatusFilter : statusFilter);
    if (viewMode === "area") {
      if (selectedAreaId) params.set("areaId", selectedAreaId);
      if (selectedSubAreaId) params.set("subAreaId", selectedSubAreaId);
    }

    const requestKey = params.toString();
    const cacheScope = await loadBillGoOfflineScope();
    const cacheKey = cacheScope ? makeWorkerDatasetKey("billgo", cacheScope, requestKey) : null;
    const offline = isBrowserOffline();
    const cached = offline && cacheKey ? await getCachedDataset<BillGoListCacheResult>(cacheKey) : null;

    if (offline) {
      if (cached) {
        applyBillGoListResult(cached.data);
        setMessage("");
        logOfflineDebug("hydrated from cache", { dataset: "billgo", cacheKey, recordCount: cached.data.rows?.length || 0 });
      } else {
        setMessage("Chưa có dữ liệu BillGo offline. Hãy mở màn này khi có mạng ít nhất một lần.");
      }
      setLoading(false);
      logOfflineDebug("server fetch skipped", { dataset: "billgo", cacheKey, reason: "offline" });
      return;
    }

    try {
      const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
      const response = await fetch(`/api/worker/billgo?${requestKey}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể tải BillGo.");
      applyBillGoListResult(result);
      if (cacheKey) void setCachedDataset(cacheKey, result, { dataset: "billgo", variant: requestKey, userId: cacheScope?.userId, workerId: cacheScope?.workerId, storeId: cacheScope?.storeId || null });
      if (process.env.NODE_ENV !== "production") {
        console.info("[BillGo] customer list loaded", { clientMs: startedAt ? Math.round(performance.now() - startedAt) : null, server: result.meta });
      }
    } catch (error) {
      if (cached) {
        logOfflineDebug("skipped cache overwrite", { dataset: "billgo", cacheKey, reason: error instanceof Error ? error.message : "fetch-error" });
        return;
      }
      setMessage(error instanceof Error ? error.message : "Không thể tải BillGo.");
      setRows([]);
      setPageCount(1);
      setTotalRows(0);
      setServerTotals(emptyBillGoTotals);
    } finally {
      setLoading(false);
    }
  }, [activeTab, applyBillGoListResult, areaStatusFilter, dueFilter, loadBillGoOfflineScope, monthFilter, page, query, selectedAreaId, selectedSubAreaId, statusFilter, viewMode]);

  useEffect(() => {
    if (!viewStateHydrated) return;
    const timeoutId = window.setTimeout(() => void fetchBillGo(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchBillGo, viewStateHydrated]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchAreas(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAreas]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchPackages(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchPackages]);

  useEffect(() => {
    if (!viewStateHydrated) return;
    const timeoutId = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, areaStatusFilter, dueFilter, monthFilter, query, selectedAreaId, selectedSubAreaId, statusFilter, viewMode, viewStateHydrated]);

  const getBillGoAddress = useCallback((subscription?: Subscription | null) => {
    const subAreaName = areas
      .flatMap(area => area.sub_areas || [])
      .find(subArea => subArea.id === subscription?.sub_area_id)?.name;
    return buildCustomerAddressInput(subscription, subAreaName);
  }, [areas]);
  const rowViews = useMemo<RowView[]>(() => rows.map(item => {
    const cycle = getBillGoRowCycle(item);
    return {
      item,
      cycle,
      summary: getBillGoReceivableSummary(item),
      customerName: item.subscription?.customer_name || "Khách BillGo",
      account: item.subscription?.tv360_account || item.subscription?.internet_account || "Chưa có account",
    };
  }), [rows]);

  const serviceOverview = useMemo<BillGoServiceOverview[]>(() => {
    const stats = new Map<BillGoServiceIconType, BillGoServiceOverview>(BILLGO_SERVICE_ICON_TYPES.map(type => [type, {
      type,
      label: BILLGO_SERVICE_ICON_CONFIG[type].label,
      count: 0,
      receivable: 0,
      debt: 0,
    }]));
    rowViews.forEach(row => {
      const type = getReceivableServiceIconType(row.item);
      const item = stats.get(type);
      if (!item) return;
      item.count += 1;
      item.receivable += row.summary.receivable;
      item.debt += row.summary.debt;
    });
    return BILLGO_SERVICE_ICON_TYPES.map(type => stats.get(type)!).filter(item => item.count > 0 || item.type === "internet");
  }, [rowViews]);

  const matchesSearch = useCallback((row: RowView) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    if (!normalizedQuery) return true;
    return [
        row.customerName,
        row.account,
        row.item.subscription?.phone,
        row.item.subscription?.tv360_account,
        getBillGoAddress(row.item.subscription),

        row.item.subscription?.provider,
        row.item.subscription?.package_name,
      ].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(normalizedQuery);
  }, [getBillGoAddress, query]);

  const matchesDueFilter = useCallback((row: RowView) => {
    if (dueFilter === "due_this_month") return isSameMonth(row.item.due_date, monthFilter);
    if (dueFilter === "not_due") {
      return row.summary.status === "not_due" || (row.summary.status !== "paid" && row.summary.status !== "promo" && isFutureDate(row.item.due_date));
    }
    return true;
  }, [dueFilter, monthFilter]);

  const filteredRows = useMemo(() => rowViews, [rowViews]);

  const selectedArea = useMemo(
    () => areas.find(area => area.id === selectedAreaId),
    [areas, selectedAreaId],
  );
  const selectedAreaSubAreas = useMemo(
    () => selectedArea?.sub_areas?.filter(subArea => subArea.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || subAreaNameCollator.compare(a.name, b.name)) || [],
    [selectedArea],
  );
  useEffect(() => {
    if (viewMode !== "area") return;
    if (!selectedAreaId || !selectedSubAreaId) return;
    if (selectedAreaSubAreas.some(subArea => subArea.id === selectedSubAreaId)) return;
    const timeoutId = window.setTimeout(() => setSelectedSubAreaId(""), 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedAreaId, selectedAreaSubAreas, selectedSubAreaId, viewMode]);

  const areaRows = useMemo(() => [...rowViews].sort((a, b) => {
    const order: Record<string, number> = { unpaid: 0, partial: 1, overdue: 2, paid: 3, promo: 4 };
    return (order[a.summary.status] ?? 9) - (order[b.summary.status] ?? 9) || a.customerName.localeCompare(b.customerName);
  }), [rowViews]);

  const areaStats = useMemo(() => ({
    total: serverTotals.totalCustomers,
    unpaid: serverTotals.unpaid,
    paid: serverTotals.paid,
    partial: serverTotals.partial,
    overdue: serverTotals.overdue,
    receivable: serverTotals.totalReceivable,
    paidAmount: serverTotals.totalPaid,
    debt: serverTotals.totalDebt,
  }), [serverTotals]);
  const visibleRows = viewMode === "area" ? areaRows : filteredRows;
  const visibleReceivableIds = useMemo(() => Array.from(new Set(visibleRows.map(row => row.item.id).filter(Boolean))), [visibleRows]);
  const selectedReceivableIdSet = useMemo(() => new Set(selectedReceivableIds), [selectedReceivableIds]);
  const selectedVisibleCount = visibleReceivableIds.filter(id => selectedReceivableIdSet.has(id)).length;
  const allVisibleSelected = visibleReceivableIds.length > 0 && selectedVisibleCount === visibleReceivableIds.length;
  const selectedVisibleRows = useMemo(
    () => visibleRows.filter(row => selectedReceivableIdSet.has(row.item.id)),
    [selectedReceivableIdSet, visibleRows],
  );
  const selectedCycleSubscriptionIds = useMemo(
    () => Array.from(new Set(selectedVisibleRows.map(row => row.item.subscription?.id).filter((id): id is string => Boolean(id)))),
    [selectedVisibleRows],
  );
  const selectedCollectableRows = useMemo(
    () => selectedVisibleRows.filter(row => row.summary.debt > 0 && !["pending_cycle", "not_due", "paid", "promo"].includes(row.summary.status)),
    [selectedVisibleRows],
  );
  const skippedSelectedCollectionCount = Math.max(selectedVisibleRows.length - selectedCollectableRows.length, 0);
  const selectedCollectionTotal = useMemo(
    () => selectedCollectableRows.reduce((sum, row) => sum + row.summary.debt, 0),
    [selectedCollectableRows],
  );
  const overduePeriodSummaries = useMemo(() => {
    const summaries = new Map<string, { month: string; label: string; count: number; debt: number }>();
    visibleRows.flatMap(row => getPreviousUnpaidReceivables(row.item)).forEach(previous => {
      const sourceDate = previous.period_start || previous.collection_month || `${monthFilter}-01`;
      const month = sourceDate.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return;
      const existing = summaries.get(month) || { month, label: monthYearLabel(sourceDate), count: 0, debt: 0 };
      existing.count += 1;
      existing.debt += Math.max(toMoneyNumber(previous.total_amount) - toMoneyNumber(previous.paid_amount), 0);
      summaries.set(month, existing);
    });
    return Array.from(summaries.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [monthFilter, visibleRows]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSelectedReceivableIds(previous => previous.filter(id => rowViews.some(row => row.item.id === id)));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [rowViews]);

  const processedCount = areaStats.paid;
  const remainingCount = areaStats.unpaid + areaStats.partial + areaStats.overdue;

  const totals = serverTotals;
  const totalUncollectedCustomers = totals.unpaid + totals.partial + totals.overdue;
  const currentMonthFilter = monthInput();
  const currentPeriodSummary = monthFilter === currentMonthFilter && totalUncollectedCustomers > 0
    ? {
        month: currentMonthFilter,
        label: monthYearLabel(`${currentMonthFilter}-01`),
        count: totalUncollectedCustomers,
        debt: totals.totalDebt,
      }
    : null;
  const hasBillingPeriodFilter = Boolean(billingPeriodFilter);

  const applyBillingPeriodFilter = (filter: BillingPeriodQuickFilter) => {
    setBillingPeriodFilter(filter);
    setViewMode("cycle");
    setActiveTab(BILLGO_ALL_TAB);
    setMonthFilter(filter.month);
    setStatusFilter("unpaid");
    setDueFilter("all");
    setPage(1);
    setSelectedReceivableIds([]);
  };

  const clearBillingPeriodFilter = () => {
    setBillingPeriodFilter(null);
    setMonthFilter(monthInput());
    setStatusFilter("all");
    setDueFilter("all");
    setPage(1);
    setSelectedReceivableIds([]);
  };

  const selectedSubAreaIndex = selectedAreaSubAreas.findIndex(subArea => subArea.id === selectedSubAreaId);
  const previousSubArea = selectedSubAreaIndex > 0 ? selectedAreaSubAreas[selectedSubAreaIndex - 1] : null;
  const nextSubArea = selectedSubAreaIndex >= 0 && selectedSubAreaIndex < selectedAreaSubAreas.length - 1 ? selectedAreaSubAreas[selectedSubAreaIndex + 1] : null;

  const hasFormCycle = Boolean(form.cycle);
  const formBilling = useMemo(() => hasFormCycle ? getBillGoBillingPeriod(form.startDate || previousMonthFirstInput(), form.cycle) : null, [form.cycle, form.startDate, hasFormCycle]);
  const formDueDate = form.dueDate || formBilling?.dueDate || "";
  const primaryFormTotal = useMemo(() => hasFormCycle ? getBillGoCollectableAmount(form.monthlyFee, form.cycle) : 0, [form.cycle, form.monthlyFee, hasFormCycle]);
  const selectedFormServiceConfig = BILLGO_SERVICE_ICON_CONFIG[form.serviceType];
  const isInternetForm = form.serviceType === "internet";
  const tv360FormTotal = useMemo(() => form.hasTv360
    ? form.tv360Accounts.reduce((sum, account) => sum + (account.cycle ? getBillGoCollectableAmount(account.monthlyFee, account.cycle) : 0), 0)
    : 0, [form.hasTv360, form.tv360Accounts]);
  const formTotal = primaryFormTotal + tv360FormTotal;
  const selectedSummary = collecting ? getBillGoReceivableSummary(collecting) : null;
  const formSubAreas = useMemo(
    () => areas.find(area => area.id === form.areaId)?.sub_areas?.filter(subArea => subArea.is_active !== false) || [],
    [areas, form.areaId],
  );
  const customerAddressSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const suggestions: string[] = [];
    const addSuggestion = (value: string | null | undefined) => {
      const trimmed = String(value || "").trim();
      if (!trimmed) return;
      const key = trimmed.toLocaleLowerCase("vi");
      if (seen.has(key)) return;
      seen.add(key);
      suggestions.push(trimmed);
    };

    formSubAreas.forEach(subArea => addSuggestion(subArea.name));
    areas
      .filter(area => area.is_active !== false)
      .flatMap(area => area.sub_areas || [])
      .filter(subArea => subArea.is_active !== false)
      .forEach(subArea => addSuggestion(subArea.name));
    rows.forEach(row => {
      const subscription = row.subscription;
      const subArea = areas.flatMap(area => area.sub_areas || []).find(item => item.id === subscription?.sub_area_id);
      addSuggestion(subArea?.name);
      addSuggestion(subscription?.legacy_address);
      addSuggestion(subscription?.address_detail);
      addSuggestion(subscription?.customer_address);
    });

    return suggestions.sort((a, b) => a.localeCompare(b, "vi"));
  }, [areas, formSubAreas, rows]);
  const selectedFormPackage = useMemo(
    () => packages.find(item => item.id === form.packageId) || null,
    [form.packageId, packages],
  );
  const internetPackages = useMemo(() => packages.filter(item => item.type === "internet"), [packages]);
  const tv360Packages = useMemo(() => packages.filter(item => item.type === "tv360" || item.type === "receiver"), [packages]);
  const packageSearchDigits = packageSearch.replace(/\D/g, "");
  const packageSearchText = packageSearch.trim().toLocaleLowerCase("vi");
  const formPackageOptions = useMemo(
    () => {
      if (!isInternetForm) return [];
      if (packageSearchDigits) {
        return internetPackages.filter(item => String(Number(item.monthly_price || 0)).startsWith(packageSearchDigits));
      }
      if (!packageSearchText) return internetPackages;
      return internetPackages.filter(item => {
        const label = [getBillGoPackageTypeLabel(item.type), item.name, item.provider, formatBillGoCurrency(item.monthly_price)]
          .join(" ")
          .toLocaleLowerCase("vi");
        return label.includes(packageSearchText);
      });
    },
    [internetPackages, isInternetForm, packageSearchDigits, packageSearchText],
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
      if (key === "address") {
        const normalizedValue = value.trim().toLocaleLowerCase("vi");
        const candidateAreas = prev.areaId ? areas.filter(area => area.id === prev.areaId) : areas;
        const matchedArea = candidateAreas.find(area =>
          area.sub_areas?.some(subArea =>
            subArea.is_active !== false &&
            subArea.name.trim().toLocaleLowerCase("vi") === normalizedValue
          )
        );
        const matchedSubArea = matchedArea?.sub_areas?.find(subArea =>
          subArea.is_active !== false &&
          subArea.name.trim().toLocaleLowerCase("vi") === normalizedValue
        );
        if (matchedArea && matchedSubArea) {
          return {
            ...prev,
            address: value,
            areaId: prev.areaId || matchedArea.id,
            areaName: prev.areaName || matchedArea.name,
            subAreaId: matchedSubArea.id,
            subAreaName: matchedSubArea.name,
          };
        }
        return { ...prev, address: value, addressDetail: value };
      }
      if (key === "serviceType") {
        const nextServiceType = getBillGoServiceIconType(value);
        return {
          ...prev,
          serviceType: nextServiceType,
          provider: nextServiceType === "internet" ? prev.provider || "Viettel" : prev.provider,
          packageId: "",
          packageName: "",
          monthlyFee: "",
          hasTv360: nextServiceType === "internet" ? prev.hasTv360 : false,
          tv360Accounts: nextServiceType === "internet" ? prev.tv360Accounts : [],
        };
      }
      if (key === "isLegacyCustomer") return { ...prev, isLegacyCustomer: value === "true", paidThroughMonth: value === "true" ? prev.paidThroughMonth : "" };
      if (key === "hasTv360") return prev.serviceType === "internet" ? { ...prev, hasTv360: value === "true", tv360Accounts: value === "true" ? (prev.tv360Accounts.length > 0 ? prev.tv360Accounts : [createTv360AccountForm()]) : [] } : prev;
      if (key === "cycle") return applySignupCycleDefaults(prev, value as BillGoCycle | "");
      if (key === "packageId") {
        const selectedPackage = internetPackages.find(item => item.id === value);
        if (!selectedPackage) return { ...prev, packageId: "", packageName: "", monthlyFee: "" };
        const allowedCycles = getSignupCycleValues(selectedPackage.allowed_cycles);
        const nextCycle = prev.cycle && allowedCycles.has(prev.cycle) ? prev.cycle : "";
        return applySignupCycleDefaults({
          ...prev,
          packageId: selectedPackage.id,
          packageName: selectedPackage.name,
          monthlyFee: String(Number(selectedPackage.monthly_price || 0)),
          provider: selectedPackage.provider || prev.provider,
          cycle: nextCycle,
        }, nextCycle);
      }
      if (key !== "packageName") return { ...prev, [key]: value };
      const packageAmount = getNumericPackageAmount(value);
      return { ...prev, packageName: value, monthlyFee: packageAmount || prev.monthlyFee };
    });
  };

  const selectFormPackage = (packageOption: BillGoPackage) => {
    setPackageSearch(formatBillGoCurrency(packageOption.monthly_price) + " - " + packageOption.name);
    setShowPackageSuggestions(false);
    updateForm("packageId", packageOption.id);
  };

  const updateTv360Account = (accountId: string, patch: Partial<Tv360AccountForm>) => {
    setForm(prev => ({
      ...prev,
      tv360Accounts: prev.tv360Accounts.map(account => account.id === accountId ? { ...account, ...patch } : account),
    }));
  };

  const addTv360Account = () => {
    setForm(prev => ({ ...prev, hasTv360: true, tv360Accounts: [...prev.tv360Accounts, createTv360AccountForm()] }));
  };

  const removeTv360Account = (accountId: string) => {
    setForm(prev => {
      const nextAccounts = prev.tv360Accounts.filter(account => account.id !== accountId);
      return { ...prev, hasTv360: nextAccounts.length > 0, tv360Accounts: nextAccounts };
    });
  };

  const selectTv360Package = (accountId: string, packageId: string) => {
    const selectedPackage = tv360Packages.find(item => item.id === packageId);
    if (!selectedPackage) {
      updateTv360Account(accountId, { packageId: "", packageName: "", monthlyFee: "" });
      return;
    }
    updateTv360Account(accountId, {
      packageId: selectedPackage.id,
      packageName: selectedPackage.name,
      monthlyFee: String(Number(selectedPackage.monthly_price || 0)),
      serviceType: selectedPackage.type === "receiver" ? "receiver_tv360" : "smart_tv360",
    });
  };

  const getTv360PackageOptions = (serviceType: Tv360ServiceType) => {
    const packageType: BillGoPackageType = serviceType === "receiver_tv360" ? "receiver" : "tv360";
    return tv360Packages.filter(item => item.type === packageType);
  };

  const updatePackageSearch = (value: string) => {
    setPackageSearch(value);
    if (!isInternetForm) {
      setShowPackageSuggestions(false);
      setForm(prev => ({ ...prev, packageId: "", packageName: value }));
      return;
    }
    setShowPackageSuggestions(Boolean(value.trim()));
    if (form.packageId) updateForm("packageId", "");
  };

  const updateEditAreaName = (value: string) => {
    const area = areas.find(item => item.name.toLowerCase() === value.trim().toLowerCase());
    setEditForm(prev => ({ ...prev, areaName: value, areaId: area?.id || "", subAreaId: "", subAreaName: "" }));
  };


  const refreshBillGoKeepingScroll = async () => {
    const scrollY = window.scrollY;
    await fetchBillGo();
    window.requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
  };

  useEffect(() => {
    const handleSyncComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ synced?: number; failed?: number }>).detail;
      if ((detail?.synced || 0) > 0) {
        const scrollY = window.scrollY;
        void fetchBillGo().then(() => window.requestAnimationFrame(() => window.scrollTo({ top: scrollY })));
      }
    };
    window.addEventListener("tdn:offline-sync-complete", handleSyncComplete);
    return () => window.removeEventListener("tdn:offline-sync-complete", handleSyncComplete);
  }, [fetchBillGo]);

  const downloadImportTemplate = () => {
    const sample = [
      billGoImportHeaders,
      ["Nguyễn Văn A", "0912345678", "n350_gftth_001", "Xóm 1", "Xã Mẫu", "Xóm 1", "Nhà số 12", "Viettel", "Internet 165000", "165000", "monthly", monthFilter ? `${monthFilter}-01` : previousMonthFirstInput(), "", ""],
    ];
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${sample.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mau-nhap-billgo.xls";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const previewImportRows = async (nextRows: BillGoImportRow[], fileName: string) => {
    setImportLoading(true);
    setImportError("");
    setImportPreview(null);
    try {
      const response = await fetch("/api/worker/billgo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_preview", rows: nextRows, monthFilter }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể xem trước dữ liệu Excel.");
      setImportRows(nextRows);
      setImportPreview(result as BillGoImportPreview);
      setImportFileName(fileName);
      setShowImport(true);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Không thể xem trước dữ liệu Excel.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    setImportLoading(true);
    setImportError("");
    try {
      const parsedRows = await parseBillGoImportFile(file);
      if (parsedRows.length === 0) throw new Error("File không có dòng khách hàng hợp lệ.");
      await previewImportRows(parsedRows, file.name);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Không thể đọc file Excel.");
      setImportPreview(null);
    } finally {
      setImportLoading(false);
    }
  };

  const confirmImportSync = async () => {
    if (importRows.length === 0 || !importPreview) return;
    setImportLoading(true);
    setImportError("");
    setMessage("");
    try {
      const response = await fetch("/api/worker/billgo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_apply", rows: importRows, monthFilter }),
      });
      const result = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(result.error || "Không thể đồng bộ dữ liệu Excel.");
      const summary = result.summary || emptyImportSummary;
      setImportPreview(prev => prev ? { ...prev, summary, items: prev.items } : prev);
      setMessage(`Đã đồng bộ Excel: thêm mới ${summary.created}, cập nhật ${summary.updated}, bỏ qua ${summary.skipped}, lỗi ${summary.errors}.`);
      await fetchAreas();
      await refreshBillGoKeepingScroll();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Không thể đồng bộ dữ liệu Excel.");
    } finally {
      setImportLoading(false);
    }
  };

  const bulkErrorByRow = useMemo(() => new Map(bulkErrors.map(error => [error.rowNumber, error])), [bulkErrors]);
  const selectedBulkRows = useMemo(() => bulkRows.filter(row => selectedBulkRowIds.includes(row.id)), [bulkRows, selectedBulkRowIds]);
  const allBulkRowsSelected = bulkRows.length > 0 && selectedBulkRowIds.length === bulkRows.length;

  const getBulkFieldError = (rowNumber: number, field: BulkEntryField) => bulkErrorByRow.get(rowNumber)?.fieldErrors?.[field] || "";
  const bulkInputClass = (hasError: boolean) => `input-field h-10 !rounded-md !px-3 !py-2 text-sm ${hasError ? "!border-error !text-error focus:!ring-error/30" : ""}`;

  const updateBulkRow = (rowId: string, patch: Partial<BulkEntryRow>) => {
    setBulkRows(prev => prev.map(row => row.id === rowId ? { ...row, ...patch } : row));
    setBulkErrors([]);
  };

  const addBulkRow = () => {
    setBulkRows(prev => [...prev, createBulkEntryRow()]);
    setBulkErrors([]);
  };

  const removeBulkRow = (rowId: string) => {
    setBulkRows(prev => prev.length > 1 ? prev.filter(row => row.id !== rowId) : [createBulkEntryRow()]);
    setSelectedBulkRowIds(prev => prev.filter(id => id !== rowId));
    setBulkErrors([]);
  };

  const duplicateBulkRow = (rowId: string) => {
    setBulkRows(prev => {
      const index = prev.findIndex(row => row.id === rowId);
      if (index < 0) return prev;
      const copy = { ...prev[index], id: createBulkEntryRow().id };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
    setBulkErrors([]);
  };

  const toggleBulkRowSelection = (rowId: string, checked: boolean) => {
    setSelectedBulkRowIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return Array.from(next);
    });
  };

  const selectAllBulkRows = () => setSelectedBulkRowIds(bulkRows.map(row => row.id));
  const clearBulkRowSelection = () => setSelectedBulkRowIds([]);
  const selectEmptyBulkRows = () => setSelectedBulkRowIds(bulkRows
    .filter(row => ![row.customerName, row.phone, row.address, row.account, row.packageName, row.cycle, row.startMonth].some(value => String(value || "").trim()))
    .map(row => row.id));

  const applyBulkPatchToSelected = (patch: Partial<BulkEntryRow>) => {
    if (selectedBulkRowIds.length === 0) return;
    setBulkRows(prev => prev.map(row => selectedBulkRowIds.includes(row.id) ? { ...row, ...patch } : row));
    setBulkErrors([]);
  };

  const applyBulkPackageToSelected = (packageId: string) => {
    if (!packageId || selectedBulkRowIds.length === 0) return;
    const selectedPackage = packages.find(item => item.id === packageId);
    setBulkRows(prev => prev.map(row => selectedBulkRowIds.includes(row.id) ? {
      ...row,
      packageId,
      packageName: selectedPackage?.name || row.packageName,
      monthlyFee: selectedPackage ? String(Number(selectedPackage.monthly_price || 0)) : row.monthlyFee,
      provider: selectedPackage?.provider || row.provider,
    } : row));
    setBulkErrors([]);
  };

  const selectBulkPackage = (rowId: string, packageId: string) => {
    const selectedPackage = packages.find(item => item.id === packageId);
    updateBulkRow(rowId, {
      packageId,
      packageName: selectedPackage?.name || "",
      monthlyFee: selectedPackage ? String(Number(selectedPackage.monthly_price || 0)) : "",
      provider: selectedPackage?.provider || bulkRows.find(row => row.id === rowId)?.provider || providerSuggestions[0] || "Viettel",
    });
  };

  const normalizeBulkCycle = (value: string): BillGoCycle | "" => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return "";
    if (["2", "2m", "2 tháng", "2 thang", "two_months"].includes(normalized)) return "two_months";
    if (["3", "3m", "3 tháng", "3 thang", "three_months"].includes(normalized)) return "three_months";
    if (["6", "6m", "6 tháng", "6 thang", "six_months"].includes(normalized)) return "six_months";
    if (["12", "12m", "12 tháng", "12 thang", "year", "yearly"].includes(normalized)) return "yearly";
    return "monthly";
  };

  const normalizeBulkStartMonth = (value: string) => {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed.slice(0, 7);
    const slash = trimmed.match(/^(\d{1,2})[/-](\d{4})$/);
    if (slash) return `${slash[2]}-${slash[1].padStart(2, "0")}`;
    return monthInput();
  };

  const appendBulkRowsFromText = (text: string) => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) return false;
    const pastedRows = lines.map(line => {
      const cells = line.includes("\t") ? line.split("\t") : line.split(",");
      const selectedPackage = packages.find(item => item.name.toLowerCase() === String(cells[5] || "").trim().toLowerCase());
      const packageText = String(cells[5] || "").trim();
      return {
        ...createBulkEntryRow(),
        customerName: String(cells[0] || "").trim(),
        phone: String(cells[1] || "").trim(),
        address: String(cells[2] || "").trim(),
        provider: String(cells[3] || selectedPackage?.provider || providerSuggestions[0] || "Viettel").trim(),
        account: String(cells[4] || "").trim(),
        packageId: selectedPackage?.id || "",
        packageName: selectedPackage?.name || packageText,
        monthlyFee: selectedPackage ? String(Number(selectedPackage.monthly_price || 0)) : getNumericPackageAmount(packageText),
        cycle: normalizeBulkCycle(String(cells[6] || "")),
        startMonth: String(cells[6] || "").trim() ? normalizeBulkStartMonth(String(cells[7] || monthInput())) : "",
        note: "",
      };
    });
    setBulkRows(prev => prev.length === 1 && !prev[0].customerName && !prev[0].account ? pastedRows : [...prev, ...pastedRows]);
    setBulkErrors([]);
    return true;
  };

  const handleBulkPaste = (event: React.ClipboardEvent<HTMLElement>) => {
    const text = event.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n") && !text.includes(",")) return;
    event.preventDefault();
    appendBulkRowsFromText(text);
  };

  const pasteBulkRowsFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!appendBulkRowsFromText(text)) setMessage("Clipboard chưa có dữ liệu Excel để dán.");
    } catch {
      setMessage("Không đọc được clipboard. Bạn có thể copy từ Excel rồi dán trực tiếp vào bảng bằng Ctrl+V.");
    }
  };

  const handleBulkCellKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const controls = Array.from(document.querySelectorAll<HTMLElement>("[data-bulk-cell='true']"));
    const index = controls.indexOf(event.currentTarget);
    const next = controls[index + 1];
    if (next) {
      next.focus();
      return;
    }
    addBulkRow();
    window.setTimeout(() => {
      const updatedControls = Array.from(document.querySelectorAll<HTMLElement>("[data-bulk-cell='true']"));
      updatedControls[updatedControls.length - 8]?.focus();
    }, 0);
  };

  const validateBulkRows = (rows: BulkEntryRow[]) => {
    const errors: BulkEntryError[] = [];
    const seenPhones = new Map<string, number>();
    const seenAccounts = new Map<string, number>();
    rows.forEach((row, index) => {
      const messages: string[] = [];
      const fieldErrors: Partial<Record<BulkEntryField, string>> = {};
      const rowNumber = index + 1;
      const phoneKey = row.phone.replace(/\D/g, "");
      const accountKey = row.account.trim().toLowerCase();
      const monthlyFee = toMoneyNumber(row.monthlyFee || getNumericPackageAmount(row.packageName));
      if (!row.customerName.trim()) { messages.push("Thiếu tên khách hàng"); fieldErrors.customerName = "Vui lòng nhập tên"; }
      if (!row.phone.trim()) { messages.push("Thiếu số điện thoại"); fieldErrors.phone = "Vui lòng nhập SĐT"; }
      if (!row.address.trim()) { messages.push("Thiếu địa chỉ"); fieldErrors.address = "Vui lòng nhập địa chỉ"; }
      if (!row.provider.trim()) { messages.push("Thiếu nhà mạng"); fieldErrors.provider = "Vui lòng chọn nhà mạng"; }
      if (!row.account.trim()) { messages.push("Thiếu tài khoản Internet"); fieldErrors.account = "Vui lòng nhập tài khoản"; }
      if (!row.packageName.trim()) { messages.push("Thiếu gói cước"); fieldErrors.packageName = "Vui lòng chọn gói cước"; }
      if (monthlyFee < 0 || (!row.packageId && !getNumericPackageAmount(row.packageName))) { messages.push("Gói cước chưa có số tiền hợp lệ"); fieldErrors.packageName = "Gói cước chưa hợp lệ"; }
      if (!row.cycle) { messages.push("Thiếu chu kỳ"); fieldErrors.cycle = "Vui lòng chọn chu kỳ"; }
      if (row.cycle && !/^\d{4}-\d{2}$/.test(row.startMonth)) { messages.push("Tháng bắt đầu không hợp lệ"); fieldErrors.startMonth = "Vui lòng chọn tháng"; }
      if (phoneKey) {
        const existing = seenPhones.get(phoneKey);
        if (existing) { messages.push(`Trùng SĐT với dòng ${existing}`); fieldErrors.phone = `Trùng dòng ${existing}`; }
        seenPhones.set(phoneKey, rowNumber);
      }
      if (accountKey) {
        const existing = seenAccounts.get(accountKey);
        if (existing) { messages.push(`Trùng tài khoản Internet với dòng ${existing}`); fieldErrors.account = `Trùng dòng ${existing}`; }
        seenAccounts.set(accountKey, rowNumber);
      }
      if (messages.length > 0) errors.push({ rowNumber, messages, fieldErrors });
    });
    return errors;
  };

  const buildBulkImportRows = (rows: BulkEntryRow[]): BillGoImportRow[] => rows.map((row, index) => ({
    rowNumber: index + 1,
    customerName: row.customerName.trim(),
    phone: row.phone.trim(),
    account: row.account.trim(),
    address: row.address.trim(),
    areaName: "",
    subAreaName: "",
    addressDetail: row.address.trim(),
    provider: row.provider.trim(),
    packageName: row.packageName.trim(),
    monthlyFee: row.monthlyFee || getNumericPackageAmount(row.packageName),
    cycle: row.cycle,
    startDate: row.cycle && row.startMonth ? `${row.startMonth}-01` : "",
    dueDate: "",
    note: row.note.trim(),
  }));

  const saveBulkRows = async () => {
    const activeRows = bulkRows.filter(row => [row.customerName, row.phone, row.address, row.account, row.packageName].some(value => value.trim()));
    const nextRows = activeRows.length > 0 ? activeRows : bulkRows;
    const validationErrors = validateBulkRows(nextRows);
    const invalidRowNumbers = new Set(validationErrors.map(error => error.rowNumber));
    const validRows = nextRows.filter((_row, index) => !invalidRowNumbers.has(index + 1));
    if (validationErrors.length > 0 && validRows.length === 0) {
      setBulkErrors(validationErrors);
      setMessage(`Chưa có dòng hợp lệ để lưu. Vui lòng kiểm tra dòng ${validationErrors.map(error => error.rowNumber).join(", ")}.`);
      return;
    }
    setBulkSaving(true);
    setBulkErrors(validationErrors);
    setMessage("");
    try {
      const response = await fetch("/api/worker/billgo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_entry_apply", rows: buildBulkImportRows(validRows), monthFilter }),
      });
      const result = await response.json();
      if (!response.ok && response.status !== 207) {
        const rowErrors = Array.isArray(result.rows) ? result.rows.map((item: { rowNumber?: number }) => ({ rowNumber: item.rowNumber || 0, messages: [result.error || "Dòng đã tồn tại"] })) : [];
        setBulkErrors([...validationErrors, ...rowErrors]);
        throw new Error(result.error || "Không thể lưu nhiều khách hàng.");
      }
      const summary = result.summary || emptyImportSummary;
      const invalidText = validationErrors.length > 0 ? ` Các dòng chưa hợp lệ chưa được lưu: ${validationErrors.map(error => error.rowNumber).join(", ")}.` : "";
      setMessage(`Đã thêm nhiều khách hàng: thêm mới ${summary.created}, bỏ qua ${summary.skipped}, lỗi ${summary.errors}.${invalidText}`);
      setBulkRows(validationErrors.length > 0 ? nextRows.filter((_row, index) => invalidRowNumbers.has(index + 1)) : [createBulkEntryRow()]);
      setSelectedBulkRowIds([]);
      if (validationErrors.length === 0) setShowBulkEntry(false);
      await fetchAreas();
      await refreshBillGoKeepingScroll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu nhiều khách hàng.");
    } finally {
      setBulkSaving(false);
    }
  };

  const submitCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    const addedCycle = form.cycle;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/billgo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, addressDetail: form.address, paidThroughMonth: form.isLegacyCustomer ? form.paidThroughMonth : "", dueDate: formDueDate }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể thêm khách hàng BillGo.");
      if (typeof result.collectionMonth === "string" && result.collectionMonth.length >= 7) {
        setMonthFilter(result.collectionMonth.slice(0, 7));
      }
      setViewMode("cycle");
      if (addedCycle) setActiveTab(addedCycle);
      setStatusFilter(result.pendingCycle ? "pending_cycle" : "all");
      setDueFilter("all");
      setForm(initialForm());
      setPackageSearch("");
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

  const mergeBillGoRow = (nextRow: Receivable) => {
    setRows(previous => previous.map(row => row.id === nextRow.id ? nextRow : row));
    return nextRow;
  };

  const loadBillGoRowDetail = async (item: Receivable) => {
    if ((item.payments || []).length > 0 || (item.subscription?.billgo_receipts || []).length > 0 || (item.subscription?.billgo_cycle_changes || []).length > 0 || (item.subscription?.billgo_status_events || []).length > 0) {
      return item;
    }
    setDetailLoadingId(item.id);
    try {
      const response = await fetch(`/api/worker/billgo?detailReceivableId=${encodeURIComponent(item.id)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể tải chi tiết BillGo.");
      return mergeBillGoRow(normalizeRows([result.row])[0] || item);
    } finally {
      setDetailLoadingId(null);
    }
  };

  const openReceiptHistory = async (item: Receivable) => {
    try {
      setReceiptTarget(await loadBillGoRowDetail(item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải phiếu thu BillGo.");
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

  const applyPendingCollection = useCallback((item: Receivable, amount: number, paidAt: string, method: string, note?: string) => {
    const total = toMoneyNumber(item.total_amount);
    const nextPaid = toMoneyNumber(item.paid_amount) + amount;
    const nextStatus = nextPaid >= total ? "paid" : "partial";
    setRows((previous) => previous
      .map((row) => row.id === item.id
        ? {
            ...row,
            paid_amount: nextPaid,
            paid_at: paidAt,
            payment_method: method,
            status: nextStatus,
            payments: [
              ...(row.payments || []),
              { id: createOfflineMutationId("offline-payment"), amount, method, status: "pending", paid_at: paidAt, note },
            ],
          }
        : row)
      .filter((row) => !(row.id === item.id && nextStatus === "paid" && ["unpaid", "overdue"].includes(statusFilter))));
    setServerTotals((previous) => ({
      ...previous,
      totalPaid: previous.totalPaid + amount,
      totalDebt: Math.max(previous.totalDebt - amount, 0),
      paid: nextStatus === "paid" ? previous.paid + 1 : previous.paid,
      unpaid: nextStatus === "paid" ? Math.max(previous.unpaid - 1, 0) : previous.unpaid,
      partial: nextStatus === "partial" ? previous.partial + 1 : previous.partial,
    }));
  }, [statusFilter]);

  const queueBillGoCollection = useCallback(async (item: Receivable, payload: Record<string, unknown>) => {
    const id = String(payload.idempotencyKey || createOfflineMutationId("billgo-collect"));
    await enqueueOfflineMutation({
      id,
      url: "/api/worker/billgo",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: { ...payload, idempotencyKey: id },
      module: "billgo",
      entityId: item.id,
    });
    applyPendingCollection(item, toMoneyNumber(payload.amount as string | number | null | undefined), String(payload.paidAt || todayInput()), String(payload.method || "cash"), typeof payload.note === "string" ? payload.note : undefined);
  }, [applyPendingCollection]);

  const openAction = async (mode: ActionMode, item: Receivable) => {
    let targetItem = item;
    if (mode === "detail") {
      try {
        targetItem = await loadBillGoRowDetail(item);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không thể tải chi tiết BillGo.");
        return;
      }
    }
    const subscription = targetItem.subscription;
    setActionTarget(targetItem);
    setActionMode(mode);
    setEditForm({
      customerName: subscription?.customer_name || "",
      phone: subscription?.phone || "",
      account: subscription?.internet_account || "",
      address: buildCustomerAddressInput(subscription, areas.flatMap(area => area.sub_areas || []).find(subArea => subArea.id === subscription?.sub_area_id)?.name),
      areaId: subscription?.area_id || "",
      areaName: areas.find(area => area.id === subscription?.area_id)?.name || "",
      subAreaId: subscription?.sub_area_id || "",
      subAreaName: areas.flatMap(area => area.sub_areas || []).find(subArea => subArea.id === subscription?.sub_area_id)?.name || "",
      addressDetail: buildCustomerAddressInput(subscription, areas.flatMap(area => area.sub_areas || []).find(subArea => subArea.id === subscription?.sub_area_id)?.name),
      provider: subscription?.provider || "Viettel",
      packageName: subscription?.package_name || "",
      monthlyFee: String(subscription?.monthly_fee ?? subscription?.amount_per_cycle ?? ""),
      note: subscription?.note || "",
      cycle: (subscription?.current_cycle || subscription?.cycle || "") as BillGoCycle | "",
      effectivePeriodStart: getNextPeriodStartDisplay(subscription, targetItem.period_start) || todayInput(),
    });
  };

  const submitCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!collecting) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = { action: "collect", receivableId: collecting.id, ...collectForm, idempotencyKey: createOfflineMutationId("billgo-collect") };
      const response = await fetch("/api/worker/billgo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể xác nhận thu tiền.");
      setCollecting(null);
      setMessage("Đã xác nhận thu tiền.");
      await refreshBillGoKeepingScroll();
    } catch (error) {
      if (collecting && isLikelyOfflineError(error)) {
        const payload = { action: "collect", receivableId: collecting.id, ...collectForm, idempotencyKey: createOfflineMutationId("billgo-collect") };
        await queueBillGoCollection(collecting, payload);
        setCollecting(null);
        setMessage("Đã lưu xác nhận thu vào hàng chờ offline. Hệ thống sẽ tự đồng bộ khi có mạng.");
        return;
      }
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
            addressDetail: editForm.address,
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
      if (actionMode === "cycle") {
        setViewMode("cycle");
        setActiveTab(editForm.cycle || BILLGO_ALL_TAB);
      }
      await refreshBillGoKeepingScroll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu thay đổi BillGo.");
    } finally {
      setSaving(false);
    }
  };

  const toggleReceivableSelection = (receivableId: string, checked: boolean) => {
    setSelectedReceivableIds(previous => {
      const next = new Set(previous);
      if (checked) next.add(receivableId);
      else next.delete(receivableId);
      return Array.from(next);
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedReceivableIds(previous => {
      const next = new Set(previous);
      if (allVisibleSelected) visibleReceivableIds.forEach(id => next.delete(id));
      else visibleReceivableIds.forEach(id => next.add(id));
      return Array.from(next);
    });
  };

  const submitBulkCollection = async () => {
    if (selectedVisibleRows.length === 0) {
      setMessage("Vui lòng chọn khách cần xác nhận đã thu.");
      return;
    }
    if (selectedCollectableRows.length === 0) {
      setMessage("Các khách đã chọn không còn khoản chưa thu để xác nhận.");
      return;
    }

    const skippedText = skippedSelectedCollectionCount > 0 ? `
Bỏ qua ${skippedSelectedCollectionCount} khách đã thu, khuyến mại, chưa đến kỳ hoặc chưa thiết lập chu kỳ.` : "";
    const confirmed = window.confirm(`Xác nhận đã thu cho ${selectedCollectableRows.length} khách?
Tổng số tiền cần xác nhận thu: ${formatBillGoCurrency(selectedCollectionTotal)}.${skippedText}`);
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    const errors: string[] = [];
    let completed = 0;
    let queued = 0;
    try {
      for (const row of selectedCollectableRows) {
        const payload = {
          action: "collect",
          receivableId: row.item.id,
          amount: row.summary.debt,
          paidAt: todayInput(),
          method: "cash",
          note: "Xác nhận đã thu hàng loạt",
          idempotencyKey: createOfflineMutationId("billgo-collect"),
        };
        try {
          const response = await fetch("/api/worker/billgo", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const result = await response.json();
          if (!response.ok) {
            errors.push(`${row.customerName}: ${result.error || "Không thể xác nhận đã thu"}`);
          } else {
            completed += 1;
          }
        } catch (error) {
          if (!isLikelyOfflineError(error)) throw error;
          await queueBillGoCollection(row.item, payload);
          queued += 1;
        }
      }

      setSelectedReceivableIds([]);
      if (queued === 0) await refreshBillGoKeepingScroll();
      else if (window.navigator.onLine) void syncOfflineMutations();
      const skippedSuffix = skippedSelectedCollectionCount > 0 ? ` Đã bỏ qua ${skippedSelectedCollectionCount} khách không đủ điều kiện.` : "";
      const queuedSuffix = queued > 0 ? ` Đã đưa ${queued} khách vào hàng chờ offline.` : "";
      setMessage(errors.length > 0
        ? `Đã xác nhận ${completed}/${selectedCollectableRows.length} khách.${queuedSuffix}${skippedSuffix} Lỗi: ${errors.slice(0, 3).join("; ")}`
        : `Đã xác nhận đã thu cho ${completed} khách.${queuedSuffix}${skippedSuffix}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xác nhận đã thu hàng loạt.");
    } finally {
      setSaving(false);
    }
  };

  const submitBulkCycle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedCycleSubscriptionIds.length === 0) return;
    const cycleLabel = getBillGoCycleOption(bulkCycleForm.cycle).label;
    const ok = window.confirm("Gan chu ky " + cycleLabel + " cho " + selectedCycleSubscriptionIds.length + " khach hang da chon? Cac ky da thu se duoc giu nguyen.");
    if (!ok) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/billgo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_cycle_bulk",
          subscriptionIds: selectedCycleSubscriptionIds,
          cycle: bulkCycleForm.cycle,
          effectivePeriodStart: bulkCycleForm.effectivePeriodStart,
          note: bulkCycleForm.note,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Khong the gan chu ky hang loat.");
      const errorCount = Array.isArray(result.errors) ? result.errors.length : 0;
      setMessage(errorCount > 0 ? "Da gan chu ky cho " + (result.updated || 0) + " khach, " + errorCount + " khach bi loi." : "Da gan chu ky cho " + (result.updated || selectedCycleSubscriptionIds.length) + " khach hang.");
      setShowBulkCycle(false);
      setSelectedReceivableIds([]);
      setViewMode("cycle");
      setActiveTab(bulkCycleForm.cycle);
      await refreshBillGoKeepingScroll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Khong the gan chu ky hang loat.");
    } finally {
      setSaving(false);
    }
  };

  const shareReceipt = async (receipt: BillGoReceipt) => {
    const url = receipt.qr_payload || `${window.location.origin}/billgo/receipt/${receipt.lookup_code}`;
    if (navigator.share) {
      await navigator.share({ title: `Phiếu thu ${receipt.receipt_code}`, url });
      return;
    }
    await navigator.clipboard?.writeText(url);
    setMessage("Đã sao chép liên kết phiếu thu.");
  };

  const getReceiptStatusLabel = (receipt: BillGoReceipt, payment?: Payment) => {
    const status = payment?.status === "void" ? "reversed" : receipt.status || "paid";
    if (status === "reversed" || status === "void") return "Đã hoàn tác";
    return "Đã thu";
  };

  const reverseCollection = async (target: Receivable, payment: Payment | undefined, receipt: BillGoReceipt) => {
    const paymentId = payment?.id || receipt.payment_id;
    if (!paymentId) {
      setMessage("Không tìm thấy mã thanh toán để hoàn tác.");
      return;
    }
    const amount = formatBillGoCurrency(receipt.paid_amount ?? payment?.amount);
    const customerName = target.subscription?.customer_name || "khách BillGo";
    const confirmed = window.confirm(`Hoàn tác khoản thu ${amount} của ${customerName}? Phiếu thu cũ sẽ được giữ lại và chuyển sang trạng thái Đã hoàn tác.`);
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/billgo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reverse_collection", receivableId: target.id, paymentId, note: "Hoàn tác thu nhầm" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể hoàn tác khoản thu.");
      setReceiptTarget(null);
      setMessage("Đã hoàn tác khoản thu BillGo.");
      await refreshBillGoKeepingScroll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể hoàn tác khoản thu.");
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (row: RowView) => {
    const { item, summary } = row;
    const cycle = row.cycle ? getBillGoCycleOption(row.cycle) : null;
    const canCollect = summary.status !== "pending_cycle" && summary.status !== "not_due" && summary.status !== "paid" && summary.status !== "promo";
    const receiptEntries = getReceiptEntries(item);
    const canOpenReceiptHistory = receiptEntries.length > 0 || summary.paid > 0 || summary.status === "paid" || summary.status === "partial";
    const previousUnpaidReceivables = getPreviousUnpaidReceivables(item);
    const hasPreviousUnpaidPeriod = previousUnpaidReceivables.length > 0;
    const firstPreviousUnpaid = previousUnpaidReceivables[0];

    return (
      <article key={item.id} className="grid gap-3 rounded-lg border border-outline-variant/40 bg-white p-3 shadow-sm lg:grid-cols-[32px_minmax(190px,1.5fr)_120px_190px_130px_130px_110px] lg:items-center">
        <label className="flex items-center gap-2 text-xs font-bold text-on-surface-variant lg:justify-center">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-outline-variant accent-primary"
            checked={selectedReceivableIdSet.has(item.id)}
            onChange={event => toggleReceivableSelection(item.id, event.target.checked)}
            aria-label={`Chon ${row.customerName}`}
          />
          <span className="lg:hidden">Chon khach hang</span>
        </label>
        <div className="flex items-start justify-between gap-3 lg:contents">
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold text-on-surface">{row.customerName}</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{row.account}</p>
            <p className="text-sm text-on-surface-variant">{item.subscription?.phone || "Chưa có số điện thoại"}</p>
            {hasPreviousUnpaidPeriod && (
              <p className="mt-2 rounded-lg bg-error-container/60 px-2.5 py-1.5 text-xs font-extrabold text-error">
                Còn kỳ cước {monthYearLabel(firstPreviousUnpaid?.period_start || firstPreviousUnpaid?.collection_month || `${monthFilter}-01`)} chưa thu
              </p>
            )}
          </div>
          <div className="relative flex shrink-0 items-center justify-end gap-2 text-right">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${summary.status === "paid" ? "bg-success-container text-success" : summary.status === "partial" ? "bg-warning-container text-warning" : summary.status === "overdue" ? "bg-error-container text-error" : summary.status === "promo" ? "bg-primary-fixed text-primary" : "bg-surface-container text-on-surface-variant"}`}>
              {summary.statusLabel}
            </span>
            {canCollect && (
              <button type="button" title="Xác nhận thu tiền" onClick={() => openCollect(item)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-extrabold text-white">
                <CheckCircle2 size={16} />
                <span className="lg:hidden">Thu</span>
              </button>
            )}
            {canOpenReceiptHistory && (
              <button type="button" onClick={() => void openReceiptHistory(item)} className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 bg-white px-3 py-2 text-xs font-extrabold text-primary">
                {detailLoadingId === item.id ? "Đang tải..." : "Phiếu thu"}
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
                <button type="button" onClick={() => void openAction("detail", item)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-container-low">
                  <Eye size={16} /> {detailLoadingId === item.id ? "Đang tải..." : "Xem chi tiết"}
                </button>
                <button type="button" onClick={() => void openAction("edit", item)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-container-low">
                  <Pencil size={16} /> Sửa thông tin
                </button>
                <button type="button" onClick={() => void openAction("cycle", item)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-container-low">
                  <RotateCcw size={16} /> {item.subscription?.status === "pending_cycle" ? "Thiết lập chu kỳ" : "Chuyển hình thức đóng"}
                </button>
                <button type="button" onClick={() => void openAction("status", item)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-container-low">
                  <PauseCircle size={16} /> {item.subscription?.status === "paused" ? "Kích hoạt lại" : "Ngừng thu"}
                </button>
                <button type="button" onClick={() => void openAction("delete", item)} className="flex w-full items-center gap-2 px-3 py-2 text-error hover:bg-error-container/40">
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
          <p>Chu kỳ: {cycle?.label || "Chưa thiết lập chu kỳ"}</p>
          <p>Sử dụng: {cycle ? item.service_months || ((item.billing_months || 0) + (item.bonus_months || 0)) || cycle.paidMonths + cycle.bonusMonths : 0} tháng</p>
          <p>Kỳ cước: {item.period_start || "Chưa có"} - {item.period_end || "Chưa có"}</p>
          <p>Hạn thanh toán: {item.due_date ? new Date(item.due_date).toLocaleDateString("vi-VN") : "Chưa có"}</p>
          <p>Đến hạn tiếp theo: {(item.next_due_date || item.subscription?.next_due_date) ? new Date(item.next_due_date || item.subscription?.next_due_date || "").toLocaleDateString("vi-VN") : "Chưa có"}</p>
          <p>{getBillGoAddress(item.subscription) || "Chưa có địa chỉ"}</p>
        </div>

        {canCollect && (
          <button type="button" onClick={() => openCollect(item)} className="btn-primary mt-1 !w-full lg:hidden">
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
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button type="button" title="Tải lại" onClick={() => void fetchBillGo()} className="btn-outline !w-auto !p-3">
            <RefreshCw size={18} />
          </button>
          <button type="button" onClick={downloadImportTemplate} className="btn-outline !w-auto flex-1 sm:flex-none">
            <Download size={18} /> Tải file mẫu
          </button>
          <label className="btn-outline !w-auto flex-1 cursor-pointer sm:flex-none">
            <Upload size={18} /> Nhập/Đồng bộ Excel
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={importLoading}
              onChange={event => {
                const file = event.target.files?.[0] || null;
                event.currentTarget.value = "";
                void handleImportFile(file);
              }}
            />
          </label>
          <button type="button" onClick={() => { setShowBulkEntry(value => !value); if (showForm) { setPackageSearch(""); setShowPackageSuggestions(false); setShowForm(false); } }} className="btn-outline !w-auto flex-1 sm:flex-none">
            <Plus size={18} /> Thêm nhiều khách hàng
          </button>
          <button type="button" onClick={() => { if (showForm) { setPackageSearch(""); setShowPackageSuggestions(false); } setShowForm(value => !value); if (showBulkEntry) setShowBulkEntry(false); }} className="btn-primary !w-auto flex-1 sm:flex-none">
            <Plus size={18} /> Thêm khách hàng
          </button>
        </div>
      </header>

      {message && <div className="mt-4 rounded-lg bg-primary-fixed p-3 text-sm font-bold text-primary">{message}</div>}
      <div className="mt-4 grid grid-cols-4 gap-2 overflow-x-auto pb-1">
        {BILLGO_SERVICE_ICON_TYPES.map(type => {
          const config = BILLGO_SERVICE_ICON_CONFIG[type];
          const isActive = type === "internet";
          return (
            <button
              key={type}
              type="button"
              className={[
                "flex min-w-24 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-extrabold",
                isActive ? config.tone.border + " " + config.tone.softBg + " " + config.tone.text + " shadow-[inset_0_-3px_0_currentColor]" : "border-outline-variant/50 bg-white text-on-surface hover:bg-surface-container-low",
              ].join(" ")}
            >
              <ServiceIcon type={type} size="sm" />
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>
      {importError && <div className="mt-4 rounded-lg bg-error-container p-3 text-sm font-bold text-error">{importError}</div>}
      {(overduePeriodSummaries.length > 0 || currentPeriodSummary || hasBillingPeriodFilter) && (
        <div className="mt-4 rounded-lg border border-error/30 bg-error-container/60 p-3 text-sm font-extrabold text-error">
          <div className="flex flex-wrap items-center gap-2">
            {overduePeriodSummaries.map(summary => (
              <button
                key={summary.month}
                type="button"
                onClick={() => applyBillingPeriodFilter({ month: summary.month, label: summary.label, source: "previous" })}
                className="rounded-lg border border-error/30 bg-white px-3 py-2 text-left text-xs font-extrabold text-error hover:bg-error-container/40"
              >
                Kỳ cước {summary.label} chưa thu · {summary.count} khách · {formatBillGoCurrency(summary.debt)}
              </button>
            ))}
            {currentPeriodSummary && (
              <button
                type="button"
                onClick={() => applyBillingPeriodFilter({ month: currentPeriodSummary.month, label: currentPeriodSummary.label, source: "current" })}
                className="rounded-lg border border-warning/30 bg-white px-3 py-2 text-left text-xs font-extrabold text-warning hover:bg-warning-container/40"
              >
                Kỳ cước tháng hiện tại chưa thu · {currentPeriodSummary.count} khách · {formatBillGoCurrency(currentPeriodSummary.debt)}
              </button>
            )}
            {hasBillingPeriodFilter && (
              <button type="button" onClick={clearBillingPeriodFilter} className="rounded-lg border border-outline-variant/50 bg-white px-3 py-2 text-xs font-extrabold text-on-surface">
                Quay lại / Xóa bộ lọc
              </button>
            )}
          </div>
          {billingPeriodFilter && (
            <p className="mt-2 text-xs text-error">
              Đang lọc khách chưa thu kỳ cước {billingPeriodFilter.label}. Khoản thu muộn vẫn giữ kỳ cước gốc và ngày thu là ngày thực tế thanh toán.
            </p>
          )}
        </div>
      )}
      <section className="mt-4 rounded-lg border border-outline-variant/50 bg-white p-3 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {serviceOverview.map(item => (
            <div key={item.type} className="flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-white p-3">
              <ServiceIcon type={item.type} size="lg" selected />
              <div className="min-w-0">
                <p className={"text-sm font-extrabold " + BILLGO_SERVICE_ICON_CONFIG[item.type].tone.text}>{item.label}</p>
                <p className="text-xs text-on-surface-variant">{item.count} {"kho\u1ea3n"}</p>
                <p className="mt-1 text-base font-black text-on-surface">{formatBillGoCurrency(item.receivable)}</p>
                <p className="text-xs text-on-surface-variant">{"C\u00f2n l\u1ea1i"} {formatBillGoCurrency(item.debt)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

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

      {showBulkEntry && (
        <section className="mt-4 overflow-hidden rounded-lg border border-outline-variant/50 bg-white shadow-sm" onPaste={handleBulkPaste}>
          <div className="flex flex-col gap-3 border-b border-outline-variant/25 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-on-surface">Thêm nhiều khách hàng</h2>
                <p className="mt-1 text-xs font-semibold text-on-surface-variant">Có thể dán dữ liệu theo thứ tự: Tên, SĐT, Địa chỉ, Nhà mạng, Tài khoản, Gói cước, Chu kỳ, Tháng bắt đầu.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void pasteBulkRowsFromClipboard()} className="btn-outline !w-auto !px-3 !py-2"><Upload size={16} /> Dán từ Excel</button>
              <button type="button" onClick={addBulkRow} className="btn-outline !w-auto !px-3 !py-2"><Plus size={16} /> Thêm dòng</button>
              <button type="button" disabled={bulkSaving} onClick={() => void saveBulkRows()} className="btn-primary !w-auto !px-4 !py-2 disabled:opacity-50">{bulkSaving ? "Đang lưu..." : "Lưu tất cả"}</button>
            </div>
          </div>

          <div className="m-4 rounded-lg border border-primary-container/25 bg-primary-fixed/50 px-3 py-2 text-xs font-semibold text-primary-container">
            <span className="font-extrabold">Mẹo:</span> Nhấn Tab hoặc Enter để chuyển ô. Dán Ctrl+V từ Excel theo thứ tự cột để nhập nhanh nhiều dòng.
          </div>

          {bulkErrors.length > 0 && (
            <div className="mx-4 mb-4 rounded-lg bg-error-container p-3 text-sm font-bold text-error">
              {bulkErrors.map(error => <p key={error.rowNumber || error.messages.join("-")}>Dòng {error.rowNumber}: {error.messages.join("; ")}</p>)}
            </div>
          )}

          <div className="mx-4 hidden overflow-x-auto rounded-lg border border-outline-variant/35 bg-white md:block">
            <table className="min-w-[1540px] w-full border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[44px]" />
                <col className="w-[48px]" />
                <col className="w-[170px]" />
                <col className="w-[140px]" />
                <col className="w-[190px]" />
                <col className="w-[130px]" />
                <col className="w-[180px]" />
                <col className="w-[200px]" />
                <col className="w-[130px]" />
                <col className="w-[140px]" />
                <col className="w-[104px]" />
              </colgroup>
              <thead className="bg-surface-container-low text-xs font-extrabold text-on-surface">
                <tr className="border-b border-outline-variant/35">
                  <th className="px-3 py-3"><input type="checkbox" checked={allBulkRowsSelected} onChange={event => event.target.checked ? selectAllBulkRows() : clearBulkRowSelection()} className="h-4 w-4 accent-primary" aria-label="Chọn tất cả dòng" /></th>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Tên khách hàng <span className="text-error">*</span></th>
                  <th className="px-3 py-3">Số điện thoại <span className="text-error">*</span></th>
                  <th className="px-3 py-3">Địa chỉ <span className="text-error">*</span></th>
                  <th className="px-3 py-3">Nhà mạng <span className="text-error">*</span></th>
                  <th className="px-3 py-3">Tài khoản Internet <span className="text-error">*</span></th>
                  <th className="px-3 py-3">Gói cước <span className="text-error">*</span></th>
                  <th className="px-3 py-3">Chu kỳ <span className="text-error">*</span></th>
                  <th className="px-3 py-3">Tháng bắt đầu <span className="text-error">*</span></th>
                  <th className="px-3 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/25">
                {bulkRows.map((row, index) => {
                  const rowNumber = index + 1;
                  const rowError = bulkErrorByRow.get(rowNumber);
                  const customerError = getBulkFieldError(rowNumber, "customerName");
                  const phoneError = getBulkFieldError(rowNumber, "phone");
                  const addressError = getBulkFieldError(rowNumber, "address");
                  const providerError = getBulkFieldError(rowNumber, "provider");
                  const accountError = getBulkFieldError(rowNumber, "account");
                  const packageError = getBulkFieldError(rowNumber, "packageName");
                  const cycleError = getBulkFieldError(rowNumber, "cycle");
                  const startMonthError = getBulkFieldError(rowNumber, "startMonth");
                  return (
                    <tr key={row.id} className={rowError ? "bg-error-container/10" : "bg-white"}>
                      <td className="px-3 py-3 align-top"><input type="checkbox" checked={selectedBulkRowIds.includes(row.id)} onChange={event => toggleBulkRowSelection(row.id, event.target.checked)} className="mt-2 h-4 w-4 accent-primary" aria-label={`Chọn dòng ${rowNumber}`} /></td>
                      <td className="px-3 py-3 align-top font-bold text-on-surface-variant"><span className="mt-2 inline-block">{rowNumber}</span></td>
                      <td className="px-2 py-3 align-top"><input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(customerError))} placeholder="Nhập tên khách hàng" value={row.customerName} onChange={e => updateBulkRow(row.id, { customerName: e.target.value })} />{customerError && <p className="mt-1 text-xs font-bold text-error">{customerError}</p>}</td>
                      <td className="px-2 py-3 align-top"><input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(phoneError))} inputMode="tel" placeholder="Nhập số điện thoại" value={row.phone} onChange={e => updateBulkRow(row.id, { phone: e.target.value })} />{phoneError && <p className="mt-1 text-xs font-bold text-error">{phoneError}</p>}</td>
                      <td className="px-2 py-3 align-top"><input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(addressError))} placeholder="Nhập địa chỉ" value={row.address} onChange={e => updateBulkRow(row.id, { address: e.target.value })} />{addressError && <p className="mt-1 text-xs font-bold text-error">{addressError}</p>}</td>
                      <td className="px-2 py-3 align-top"><select data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(providerError))} value={row.provider} onChange={e => updateBulkRow(row.id, { provider: e.target.value })}>{providerSuggestions.map(provider => <option key={provider} value={provider}>{provider}</option>)}</select>{providerError && <p className="mt-1 text-xs font-bold text-error">{providerError}</p>}</td>
                      <td className="px-2 py-3 align-top"><input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(accountError))} placeholder="Nhập tài khoản" value={row.account} onChange={e => updateBulkRow(row.id, { account: e.target.value })} />{accountError && <p className="mt-1 text-xs font-bold text-error">{accountError}</p>}</td>
                      <td className="px-2 py-3 align-top"><select data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(packageError))} value={row.packageId} onChange={e => selectBulkPackage(row.id, e.target.value)}><option value="">Chọn gói cước</option>{packages.map(item => <option key={item.id} value={item.id}>{formatBillGoCurrency(item.monthly_price)} - {item.name}</option>)}</select>{packageError && <p className="mt-1 text-xs font-bold text-error">{packageError}</p>}</td>
                      <td className="px-2 py-3 align-top"><select data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(cycleError))} value={row.cycle} onChange={e => updateBulkRow(row.id, { cycle: e.target.value as BillGoCycle })}><option value="">Chọn chu kỳ</option>{signupCycleOptions.map(option => <option key={option.value} value={option.value}>{option.shortLabel}</option>)}</select>{cycleError && <p className="mt-1 text-xs font-bold text-error">{cycleError}</p>}</td>
                      <td className="px-2 py-3 align-top"><input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} type="month" className={bulkInputClass(Boolean(startMonthError))} value={row.startMonth} onChange={e => updateBulkRow(row.id, { startMonth: e.target.value })} />{startMonthError && <p className="mt-1 text-xs font-bold text-error">{startMonthError}</p>}</td>
                      <td className="px-2 py-3 align-top"><div className="flex justify-center gap-2"><button type="button" title="Nhân bản dòng" onClick={() => duplicateBulkRow(row.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 text-primary hover:bg-primary-fixed"><Copy size={16} /></button><button type="button" title="Xóa dòng" onClick={() => removeBulkRow(row.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-error/20 text-error hover:bg-error-container"><Trash2 size={16} /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mx-3 grid gap-4 md:hidden">
            {bulkRows.map((row, index) => {
              const rowNumber = index + 1;
              const rowError = bulkErrorByRow.get(rowNumber);
              const customerError = getBulkFieldError(rowNumber, "customerName");
              const phoneError = getBulkFieldError(rowNumber, "phone");
              const addressError = getBulkFieldError(rowNumber, "address");
              const providerError = getBulkFieldError(rowNumber, "provider");
              const accountError = getBulkFieldError(rowNumber, "account");
              const packageError = getBulkFieldError(rowNumber, "packageName");
              const cycleError = getBulkFieldError(rowNumber, "cycle");
              const startMonthError = getBulkFieldError(rowNumber, "startMonth");
              return (
                <article key={row.id} className={`rounded-xl border bg-white p-3 shadow-sm ${rowError ? "border-error/45 bg-error-container/10" : "border-outline-variant/35"}`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <input type="checkbox" checked={selectedBulkRowIds.includes(row.id)} onChange={event => toggleBulkRowSelection(row.id, event.target.checked)} className="h-6 w-6 shrink-0 accent-primary" aria-label={`Chọn dòng ${rowNumber}`} />
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold text-white ${rowError ? "bg-error" : "bg-primary"}`}>{rowNumber}</span>
                      <h3 className="truncate text-base font-extrabold text-on-surface">Khách {rowNumber}</h3>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" title="Nhân bản dòng" onClick={() => duplicateBulkRow(row.id)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-primary/25 px-2.5 text-xs font-extrabold text-primary hover:bg-primary-fixed"><Copy size={16} /> Nhân bản</button>
                      <button type="button" title="Xóa dòng" onClick={() => removeBulkRow(row.id)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-error/25 px-2.5 text-xs font-extrabold text-error hover:bg-error-container"><Trash2 size={16} /> Xóa</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-extrabold text-on-surface-variant">
                      Tên khách hàng <span className="text-error">*</span>
                      <input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(customerError)) + " !h-12 text-base"} placeholder="Nhập tên khách hàng" value={row.customerName} onChange={e => updateBulkRow(row.id, { customerName: e.target.value })} />
                      {customerError && <span className="text-xs font-bold text-error">{customerError}</span>}
                    </label>
                    <label className="grid gap-1.5 text-xs font-extrabold text-on-surface-variant">
                      Số điện thoại <span className="text-error">*</span>
                      <input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(phoneError)) + " !h-12 text-base"} inputMode="tel" placeholder="Nhập số điện thoại" value={row.phone} onChange={e => updateBulkRow(row.id, { phone: e.target.value })} />
                      {phoneError && <span className="text-xs font-bold text-error">{phoneError}</span>}
                    </label>
                    <label className="grid gap-1.5 text-xs font-extrabold text-on-surface-variant min-[390px]:col-span-2">
                      Địa chỉ <span className="text-error">*</span>
                      <input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(addressError)) + " !h-12 text-base"} placeholder="Nhập địa chỉ" value={row.address} onChange={e => updateBulkRow(row.id, { address: e.target.value })} />
                      {addressError && <span className="text-xs font-bold text-error">{addressError}</span>}
                    </label>
                    <label className="grid gap-1.5 text-xs font-extrabold text-on-surface-variant">
                      Nhà mạng <span className="text-error">*</span>
                      <select data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(providerError)) + " !h-12 text-base"} value={row.provider} onChange={e => updateBulkRow(row.id, { provider: e.target.value })}>{providerSuggestions.map(provider => <option key={provider} value={provider}>{provider}</option>)}</select>
                      {providerError && <span className="text-xs font-bold text-error">{providerError}</span>}
                    </label>
                    <label className="grid gap-1.5 text-xs font-extrabold text-on-surface-variant">
                      Tài khoản Internet <span className="text-error">*</span>
                      <input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(accountError)) + " !h-12 text-base"} placeholder="Nhập tài khoản Internet" value={row.account} onChange={e => updateBulkRow(row.id, { account: e.target.value })} />
                      {accountError && <span className="text-xs font-bold text-error">{accountError}</span>}
                    </label>
                    <label className="grid gap-1.5 text-xs font-extrabold text-on-surface-variant min-[390px]:col-span-2">
                      Gói cước <span className="text-error">*</span>
                      <select data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(packageError)) + " !h-12 text-base"} value={row.packageId} onChange={e => selectBulkPackage(row.id, e.target.value)}><option value="">Chọn gói cước</option>{packages.map(item => <option key={item.id} value={item.id}>{formatBillGoCurrency(item.monthly_price)} - {item.name}</option>)}</select>
                      {packageError && <span className="text-xs font-bold text-error">{packageError}</span>}
                    </label>
                    <label className="grid gap-1.5 text-xs font-extrabold text-on-surface-variant">
                      Chu kỳ <span className="text-error">*</span>
                      <select data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} className={bulkInputClass(Boolean(cycleError)) + " !h-12 text-base"} value={row.cycle} onChange={e => updateBulkRow(row.id, { cycle: e.target.value as BillGoCycle })}><option value="">Chọn chu kỳ</option>{signupCycleOptions.map(option => <option key={option.value} value={option.value}>{option.shortLabel}</option>)}</select>
                      {cycleError && <span className="text-xs font-bold text-error">{cycleError}</span>}
                    </label>
                    <label className="grid gap-1.5 text-xs font-extrabold text-on-surface-variant">
                      Tháng bắt đầu <span className="text-error">*</span>
                      <input data-bulk-cell="true" onKeyDown={handleBulkCellKeyDown} type="month" className={bulkInputClass(Boolean(startMonthError)) + " !h-12 text-base"} value={row.startMonth} onChange={e => updateBulkRow(row.id, { startMonth: e.target.value })} />
                      {startMonthError && <span className="text-xs font-bold text-error">{startMonthError}</span>}
                    </label>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 border-t border-outline-variant/25 bg-white p-3 md:p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm md:text-sm">
              <div className="mr-2 flex items-center gap-2 font-extrabold text-on-surface"><input type="checkbox" checked={allBulkRowsSelected} onChange={event => event.target.checked ? selectAllBulkRows() : clearBulkRowSelection()} className="h-5 w-5 accent-primary md:hidden" aria-label="Chọn tất cả dòng" />Đã chọn {selectedBulkRows.length} dòng</div>
              <button type="button" onClick={selectAllBulkRows} className="btn-outline !w-auto !px-3 !py-2">Chọn tất cả</button>
              <button type="button" onClick={clearBulkRowSelection} className="btn-outline !w-auto !px-3 !py-2">Bỏ chọn tất cả</button>
              <button type="button" onClick={selectEmptyBulkRows} className="btn-outline !w-auto !px-3 !py-2">Chọn dòng trống</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant">Gán chung cho đã chọn:</span>
              <select className="input-field h-10 !w-auto min-w-32 !py-2 text-sm" value="" disabled={selectedBulkRows.length === 0} onChange={e => applyBulkPatchToSelected({ provider: e.target.value })}><option value="">Nhà mạng</option>{providerSuggestions.map(provider => <option key={provider} value={provider}>{provider}</option>)}</select>
              <select className="input-field h-10 !w-auto min-w-44 !py-2 text-sm" value="" disabled={selectedBulkRows.length === 0} onChange={e => applyBulkPackageToSelected(e.target.value)}><option value="">Gói cước</option>{packages.map(item => <option key={item.id} value={item.id}>{formatBillGoCurrency(item.monthly_price)} - {item.name}</option>)}</select>
              <select className="input-field h-10 !w-auto min-w-32 !py-2 text-sm" value="" disabled={selectedBulkRows.length === 0} onChange={e => applyBulkPatchToSelected({ cycle: e.target.value as BillGoCycle })}><option value="">Chu kỳ</option>{signupCycleOptions.map(option => <option key={option.value} value={option.value}>{option.shortLabel}</option>)}</select>
              <input type="month" className="input-field h-10 !w-auto min-w-36 !py-2 text-sm" disabled={selectedBulkRows.length === 0} onChange={e => applyBulkPatchToSelected({ startMonth: e.target.value })} aria-label="Gán tháng bắt đầu" />
            </div>
          </div>

          <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-outline-variant/25 bg-surface-container-low/95 p-3 shadow-[0_-10px_30px_rgba(15,23,42,0.10)] backdrop-blur sm:flex-row sm:items-center sm:justify-between md:p-4">
            <p className="text-sm font-semibold text-success">Các dòng hợp lệ sẽ được thêm. Dòng lỗi sẽ không được lưu.</p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="button" onClick={() => setShowBulkEntry(false)} className="btn-outline !w-full !px-5 sm:!w-auto">Hủy</button>
              <button type="button" disabled={bulkSaving} onClick={() => void saveBulkRows()} className="btn-primary !w-full !px-5 disabled:opacity-50 sm:!w-auto">{bulkSaving ? "Đang lưu..." : "Lưu tất cả"}</button>
            </div>
          </div>
        </section>
      )}
      {showForm && (
        <form onSubmit={submitCustomer} className="mt-4 grid h-[calc(100dvh-16rem)] max-h-[calc(100dvh-16rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-outline-variant/50 bg-white shadow-sm">
          <div className="border-b border-outline-variant/25 bg-white px-4 py-3">
            <h2 className="text-base font-extrabold">Thêm khách hàng</h2>
          </div>
          <div className="min-h-0 overflow-y-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2 xl:col-span-3">
                <p className="text-xs font-extrabold uppercase text-on-surface-variant">{"Lo\u1ea1i d\u1ecbch v\u1ee5"}</p>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {BILLGO_SERVICE_ICON_TYPES.map(type => {
                    const config = BILLGO_SERVICE_ICON_CONFIG[type];
                    const isSelected = form.serviceType === type;
                    return (
                      <button key={type} type="button" onClick={() => updateForm("serviceType", type)} className={["flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-extrabold", isSelected ? config.tone.border + " " + config.tone.softBg + " " + config.tone.text + " shadow-[inset_0_-3px_0_currentColor]" : "border-outline-variant/50 bg-white text-on-surface hover:bg-surface-container-low"].join(" ")}>
                        <ServiceIcon type={type} size="sm" selected={isSelected} />
                        <span>{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <input required className="input-field" placeholder="Tên khách hàng" value={form.customerName} onChange={e => updateForm("customerName", e.target.value)} />
              <input className="input-field" placeholder="Số điện thoại" value={form.phone} onChange={e => updateForm("phone", e.target.value)} />
              <input required list="billgo-account-suggestions" className="input-field" placeholder={isInternetForm ? "Account Internet" : `M\u00e3/t\u00e0i kho\u1ea3n ${selectedFormServiceConfig.label}`} value={form.account} onChange={e => updateForm("account", e.target.value)} />
              <datalist id="billgo-account-suggestions">
                {BILLGO_ACCOUNT_SUGGESTIONS.map(account => <option key={account} value={account} />)}
              </datalist>
              {isInternetForm ? (
                <select className="input-field" value={form.provider} onChange={e => updateForm("provider", e.target.value)}>
                  {providerSuggestions.map(provider => <option key={provider} value={provider}>{provider}</option>)}
                </select>
              ) : (
                <input className="input-field" placeholder={`Nh\u00e0 cung c\u1ea5p ${selectedFormServiceConfig.label}`} value={form.provider} onChange={e => updateForm("provider", e.target.value)} />
              )}
              <input list="billgo-area-suggestions" className="input-field" placeholder="Xã/phường" value={form.areaName} onChange={e => updateForm("areaName", e.target.value)} />
              <datalist id="billgo-area-suggestions">
                {areas.filter(area => area.is_active !== false).map(area => <option key={area.id} value={area.name} />)}
              </datalist>
              <input required list="billgo-customer-address-suggestions" className="input-field sm:col-span-2 xl:col-span-1" placeholder="Địa chỉ khách hàng" value={form.address} onChange={e => updateForm("address", e.target.value)} />
              <datalist id="billgo-customer-address-suggestions">
                {customerAddressSuggestions.map(address => <option key={address} value={address} />)}
              </datalist>
              <div className="relative grid gap-1 text-xs font-bold text-on-surface-variant">
             {isInternetForm ? "Ch\u1ecdn g\u00f3i c\u01b0\u1edbc" : `G\u00f3i/kho\u1ea3n ${selectedFormServiceConfig.label}`}
                <input
                  required
                  inputMode="numeric"
                  className="input-field"
                  placeholder={isInternetForm ? "Nh\u1eadp gi\u00e1 ti\u1ec1n \u0111\u1ec3 t\u00ecm g\u00f3i c\u01b0\u1edbc" : `Nh\u1eadp g\u00f3i/kho\u1ea3n ${selectedFormServiceConfig.label}`}
                  value={packageSearch}
                  onChange={e => updatePackageSearch(e.target.value)}
                />
                {isInternetForm && showPackageSuggestions && packageSearch.trim() && (
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-outline-variant/40 bg-white p-1 shadow-sm">
                    {formPackageOptions.map(packageOption => (
                      <button
                        key={packageOption.id}
                        type="button"
                        onClick={() => selectFormPackage(packageOption)}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm font-bold ${form.packageId === packageOption.id ? "bg-primary text-white" : "hover:bg-surface-container-low"}`}
                      >
                        {getBillGoPackageTypeLabel(packageOption.type)} - {packageOption.name} - {formatBillGoCurrency(packageOption.monthly_price)}/tháng
                      </button>
                    ))}
                    {formPackageOptions.length === 0 && packageSearchDigits && (
                      <p className="px-3 py-2 text-sm text-on-surface-variant">Không có gói cước bắt đầu bằng giá {packageSearchDigits}</p>
                    )}
                  </div>
                )}
              </div>
              <input required readOnly={Boolean(selectedFormPackage)} className="input-field" placeholder={isInternetForm ? "T\u00ean g\u00f3i t\u1ea1i th\u1eddi \u0111i\u1ec3m \u0111\u0103ng k\u00fd" : `T\u00ean g\u00f3i/kho\u1ea3n ${selectedFormServiceConfig.label}`} value={form.packageName} onChange={e => updateForm("packageName", e.target.value)} />
              <input required readOnly={Boolean(selectedFormPackage)} type="number" min="0" inputMode="numeric" className="input-field" placeholder="Số tiền cước một tháng" value={form.monthlyFee} onChange={e => updateForm("monthlyFee", e.target.value)} />
              <select className="input-field" value={form.cycle} onChange={e => updateForm("cycle", e.target.value)}>
                <option value="">Chưa thiết lập</option>
                {signupCycleOptions
                  .filter(option => !isInternetForm || getSignupCycleValues(selectedFormPackage?.allowed_cycles).has(option.value))
                  .map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input readOnly className="input-field bg-surface-container-low font-bold" value={formatBillGoCurrency(formTotal)} aria-label="Số tiền cần thu" />
              {isInternetForm && (
              <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 sm:col-span-2 xl:col-span-3">
                <label className="flex items-center justify-between gap-3 text-sm font-bold text-on-surface">
                  <span>Có dịch vụ TV360</span>
                  <input type="checkbox" checked={form.hasTv360} onChange={e => updateForm("hasTv360", e.target.checked ? "true" : "false")} className="h-5 w-5 accent-primary" />
                </label>
                {form.hasTv360 && (
                  <div className="mt-3 space-y-3">
                    {form.tv360Accounts.map((tvAccount, index) => {
                      const tvPackageOptions = getTv360PackageOptions(tvAccount.serviceType);
                      return (
                        <div key={tvAccount.id} className="rounded-lg border border-outline-variant/40 bg-white p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-extrabold text-on-surface">Tài khoản TV360 {index + 1}</p>
                            <button type="button" onClick={() => removeTv360Account(tvAccount.id)} className="rounded-lg border border-outline-variant px-2 py-1 text-xs font-bold text-error hover:bg-error-container">Xóa</button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <select className="input-field" value={tvAccount.serviceType} onChange={e => updateTv360Account(tvAccount.id, { serviceType: e.target.value as Tv360ServiceType, packageId: "", packageName: "", monthlyFee: "" })}>
                              <option value="smart_tv360">Smart TV360</option>
                              <option value="receiver_tv360">Đầu thu TV360</option>
                            </select>
                            <input required className="input-field" placeholder="Tài khoản TV360" value={tvAccount.account} onChange={e => updateTv360Account(tvAccount.id, { account: e.target.value })} />
                            <select required className="input-field" value={tvAccount.packageId} onChange={e => selectTv360Package(tvAccount.id, e.target.value)}>
                              <option value="">Gói cước TV360</option>
                              {tvPackageOptions.map(item => <option key={item.id} value={item.id}>{item.name} - {formatBillGoCurrency(item.monthly_price)}</option>)}
                            </select>
                            <input required readOnly={Boolean(tvAccount.packageId)} type="number" min="0" inputMode="numeric" className="input-field" placeholder="Giá cước TV360" value={tvAccount.monthlyFee} onChange={e => updateTv360Account(tvAccount.id, { monthlyFee: e.target.value })} />
                            <select required className="input-field" value={tvAccount.cycle} onChange={e => updateTv360Account(tvAccount.id, { cycle: e.target.value as BillGoCycle | "" })}>
                              <option value="">Chu kỳ TV360</option>
                              {signupCycleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          </div>
                          <p className="mt-2 text-xs font-bold text-on-surface-variant">
                            Đến kỳ: {tvAccount.cycle ? formatBillGoCurrency(getBillGoCollectableAmount(tvAccount.monthlyFee, tvAccount.cycle)) : "Chưa chọn chu kỳ"}
                          </p>
                        </div>
                      );
                    })}
                    <button type="button" onClick={addTv360Account} className="btn-outline !w-auto !px-3 !py-2"><Plus size={16} /> Thêm tài khoản TV360</button>
                    <p className="text-xs font-bold text-primary-container">Tổng TV360 đến kỳ: {formatBillGoCurrency(tv360FormTotal)}</p>
                  </div>
                )}
              </section>
              )}
              <label className="flex items-center gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-sm font-bold text-on-surface sm:col-span-2 xl:col-span-3">
                <input type="checkbox" checked={form.isLegacyCustomer} onChange={e => updateForm("isLegacyCustomer", e.target.checked ? "true" : "false")} className="h-5 w-5 accent-primary" />
                Nhập khách hàng cũ
              </label>
              <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
                Kỳ cước {monthLabel(form.startDate)}
                <input required={hasFormCycle} disabled={!hasFormCycle} type="date" className="input-field" value={form.startDate} onChange={e => updateForm("startDate", e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
                Hạn nộp tiền
                <input disabled={!hasFormCycle} type="date" className="input-field" value={formDueDate} onChange={e => updateForm("dueDate", e.target.value)} />
              </label>
              {form.isLegacyCustomer && (
                <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
                  Đã thu đến kỳ
                  <input type="month" className="input-field" value={form.paidThroughMonth} onChange={e => updateForm("paidThroughMonth", e.target.value)} />
                </label>
              )}
              <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
                Ngày nhập khách hàng
                <input type="date" className="input-field" value={form.initialPaidAt} onChange={e => updateForm("initialPaidAt", e.target.value)} />
              </label>
              <select className="input-field" value={form.initialPaymentMethod} onChange={e => updateForm("initialPaymentMethod", e.target.value)}>
                {Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <textarea className="input-field min-h-20 sm:col-span-2 xl:col-span-3" placeholder="Ghi chú" value={form.note} onChange={e => updateForm("note", e.target.value)} />
            </div>
            <p className="mt-3 text-xs text-on-surface-variant">
              {hasFormCycle && formBilling ? `Kỳ cước ${monthLabel(form.startDate)}: ${dateLabel(formBilling.periodStart)} - ${dateLabel(formBilling.periodEnd)}. Hạn nộp tiền: ${dateLabel(formDueDate)}. ` : "Khách hàng sẽ được lưu ở trạng thái Chưa thiết lập chu kỳ, chưa tạo kỳ thu và chưa tính tiền cần thu. "}{hasFormCycle ? (form.isLegacyCustomer && form.paidThroughMonth ? `Đã thu đến kỳ tháng ${form.paidThroughMonth.slice(5, 7)}/${form.paidThroughMonth.slice(0, 4)}; hệ thống tự xác định kỳ tiếp theo.` : "Khách hàng mới sẽ được tạo kỳ cước hiện tại ở trạng thái Chưa thu.") : ""} {form.cycle === "yearly" ? "Khách trả 12 tháng và được dùng 13 tháng." : ""}
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-outline-variant/25 bg-white p-4 shadow-[0_-10px_24px_rgba(15,23,42,0.08)]">
            <button type="button" onClick={() => { setPackageSearch(""); setShowPackageSuggestions(false); setShowForm(false); }} className="btn-outline !w-auto">Hủy</button>
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
          ["Chưa thu", String(areaStats.unpaid + areaStats.partial + areaStats.overdue)],
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

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative block">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input className="input-field !pl-10" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, account, địa chỉ, gói cước..." />
        </label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input type="month" className="input-field" value={monthFilter} onChange={e => { setBillingPeriodFilter(null); setMonthFilter(e.target.value || monthInput()); setPage(1); }} />
          <button type="button" title="Tháng hiện tại" onClick={() => { setBillingPeriodFilter(null); setMonthFilter(monthInput()); setPage(1); }} className="btn-outline !w-auto !px-3">
            <RotateCcw size={16} />
          </button>
        </div>
        <label className="relative block">
          <select className="input-field appearance-none pr-10" value={statusFilter} onChange={e => { setBillingPeriodFilter(null); setStatusFilter(e.target.value); setPage(1); }}>
            {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        </label>
        <label className="relative block">
          <select className="input-field appearance-none pr-10" value={dueFilter} onChange={e => { setBillingPeriodFilter(null); setDueFilter(e.target.value); setPage(1); }}>
            {dueFilterOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
          ["Chưa chu kỳ", String(totals.pendingCycle || 0)],
          ["Chưa thu", String(totalUncollectedCustomers)],
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

      {visibleRows.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-bold text-on-surface">
            <input type="checkbox" className="h-5 w-5 accent-primary" checked={allVisibleSelected} onChange={toggleVisibleSelection} />
            {allVisibleSelected ? "Bo chon trang hien tai" : "Chon tat ca tren trang"}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm font-bold text-on-surface-variant">Da chon {selectedReceivableIds.length} khach</span>
            <button type="button" disabled={saving || selectedCollectableRows.length === 0} onClick={() => void submitBulkCollection()} className="btn-primary !w-full !px-4 !py-2 disabled:opacity-45 sm:!w-auto">
              <CheckCircle2 size={16} /> Xác nhận đã thu
            </button>
            <button type="button" disabled={selectedCycleSubscriptionIds.length === 0} onClick={() => setShowBulkCycle(true)} className="btn-primary !w-full !px-4 !py-2 disabled:opacity-45 sm:!w-auto">
              <RotateCcw size={16} /> Gan chu ky
            </button>
            {selectedReceivableIds.length > 0 && <button type="button" onClick={() => setSelectedReceivableIds([])} className="btn-outline !w-full !px-4 !py-2 sm:!w-auto">Bo chon</button>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-on-surface-variant">Đang tải BillGo...</div>
      ) : visibleRows.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-outline-variant bg-white p-8 text-center text-sm text-on-surface-variant">
          Chưa có khách hàng phù hợp bộ lọc tháng, trạng thái hoặc địa bàn.
        </div>
      ) : (
        <section className="mt-5 space-y-2">
          <div className="hidden rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs font-bold uppercase text-on-surface-variant lg:grid lg:grid-cols-[32px_minmax(190px,1.5fr)_120px_190px_130px_130px_110px]">
            <span></span>
            <span>Khách hàng</span>
            <span>Trạng thái</span>
            <span>Gói tháng</span>
            <span>Cần thu</span>
            <span>Còn lại</span>
            <span>Kỳ cước</span>
          </div>
          {visibleRows.map(renderRow)}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/40 bg-white p-3 text-sm text-on-surface-variant">
            <span>Trang {page}/{pageCount} · {totalRows} khách</span>
            <div className="flex gap-2">
              <button type="button" className="btn-outline !w-auto !px-3 !py-2" disabled={loading || page <= 1} onClick={() => setPage(current => Math.max(current - 1, 1))}>
                Trước
              </button>
              <button type="button" className="btn-outline !w-auto !px-3 !py-2" disabled={loading || page >= pageCount} onClick={() => setPage(current => Math.min(current + 1, pageCount))}>
                Sau
              </button>
            </div>
          </div>
        </section>
      )}

      {showImport && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
          <div className="modal-panel flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden p-0">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 p-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-primary"><FileSpreadsheet size={16} /> Nhập/Đồng bộ Excel</p>
                <h2 className="text-lg font-extrabold">{importFileName || "Dữ liệu BillGo"}</h2>
              </div>
              <button type="button" onClick={() => setShowImport(false)} className="btn-outline !w-auto !px-3 !py-2">Đóng</button>
            </div>
            <div className="overflow-y-auto p-4">
              {importLoading && <div className="rounded-lg bg-surface-container-low p-3 text-sm font-bold text-on-surface-variant">Đang xử lý file Excel...</div>}
              {importPreview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Thêm mới", importPreview.summary.created, "text-success"],
                      ["Cập nhật", importPreview.summary.updated, "text-primary"],
                      ["Bỏ qua", importPreview.summary.skipped, "text-on-surface"],
                      ["Lỗi", importPreview.summary.errors, "text-error"],
                    ].map(([label, value, className]) => (
                      <div key={String(label)} className="rounded-lg border border-outline-variant/40 bg-white p-3">
                        <p className="text-[11px] font-bold uppercase text-on-surface-variant">{label}</p>
                        <p className={`mt-1 text-xl font-extrabold ${className}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-lg border border-outline-variant/40">
                    <div className="hidden bg-surface-container-low px-3 py-2 text-xs font-bold uppercase text-on-surface-variant sm:grid sm:grid-cols-[70px_1.2fr_1fr_1fr_120px_1.4fr]">
                      <span>Dòng</span>
                      <span>Khách hàng</span>
                      <span>Account</span>
                      <span>SĐT</span>
                      <span>Trạng thái</span>
                      <span>Ghi chú</span>
                    </div>
                    <div className="max-h-[42dvh] divide-y divide-outline-variant/30 overflow-y-auto bg-white">
                      {importPreview.items.map(item => {
                        const statusLabel = item.status === "new" ? "Thêm mới" : item.status === "update" ? "Cập nhật" : item.status === "skip" ? "Bỏ qua" : "Lỗi";
                        const statusClass = item.status === "error" ? "bg-error-container text-error" : item.status === "new" ? "bg-success-container text-success" : item.status === "update" ? "bg-primary-fixed text-primary" : "bg-surface-container text-on-surface-variant";
                        return (
                          <div key={`${item.row.rowNumber}-${item.row.account || item.row.phone}`} className="grid gap-2 p-3 text-sm sm:grid-cols-[70px_1.2fr_1fr_1fr_120px_1.4fr] sm:items-center">
                            <span className="text-xs font-bold text-on-surface-variant">#{item.row.rowNumber}</span>
                            <span className="font-bold text-on-surface">{item.row.customerName || "Chưa có tên"}</span>
                            <span className="text-on-surface-variant">{item.row.account || "Không có"}</span>
                            <span className="text-on-surface-variant">{item.row.phone || "Không có"}</span>
                            <span className={`w-max rounded-full px-2 py-1 text-[11px] font-extrabold ${statusClass}`}>{statusLabel}</span>
                            <span className={item.status === "error" ? "text-error" : "text-on-surface-variant"}>
                              {item.reasons.length > 0 ? item.reasons.join(", ") : item.changes.join(", ") || "Không thay đổi"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {importPreview.missingFromFile.length > 0 && (
                    <details className="rounded-lg border border-outline-variant/40 bg-white p-3 text-sm">
                      <summary className="cursor-pointer font-extrabold text-on-surface">Khách BillGo không có trong file ({importPreview.missingFromFile.length})</summary>
                      <div className="mt-3 grid gap-2">
                        {importPreview.missingFromFile.slice(0, 50).map(item => (
                          <div key={item.subscriptionId} className="rounded-lg bg-surface-container-low p-2 text-on-surface-variant">
                            <strong className="text-on-surface">{item.customerName || "Khách BillGo"}</strong> · {item.account || item.phone || "Chưa có khóa đối chiếu"}
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-on-surface-variant">Hệ thống không tự xóa khách không có trong file. Hãy mở từng khách để chọn ngừng thu nếu cần.</p>
                    </details>
                  )}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-outline-variant/25 bg-white p-4 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowImport(false)} className="btn-outline !w-full sm:!w-auto">Hủy</button>
              <button
                type="button"
                disabled={importLoading || !importPreview || importPreview.summary.errors > 0}
                onClick={() => void confirmImportSync()}
                className="btn-primary !w-full disabled:opacity-45 sm:!w-auto"
              >
                {importLoading ? "Đang đồng bộ..." : "Xác nhận đồng bộ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptTarget && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
          <div className="modal-panel flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden p-0">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 p-4">
              <div>
                <p className="text-xs font-bold uppercase text-primary">Phiếu thu</p>
                <h2 className="text-lg font-extrabold">{receiptTarget.subscription?.customer_name || "Khách BillGo"}</h2>
              </div>
              <button type="button" onClick={() => setReceiptTarget(null)} className="btn-outline !w-auto !px-3 !py-2">Đóng</button>
            </div>
            <div className="overflow-y-auto p-3 sm:p-4">
              {getReceiptEntries(receiptTarget).length === 0 ? (
                <p className="text-sm text-on-surface-variant">Chưa có phiếu thu đã lưu.</p>
              ) : (
                <div className="space-y-2">
                  {getReceiptEntries(receiptTarget).map(({ payment, receipt }) => {
                    const receiptStatus = getReceiptStatusLabel(receipt, payment);
                    const canReverseReceipt = receiptStatus === "Đã thu" && Boolean(payment?.id || receipt.payment_id);
                    return (
                    <details key={`${payment?.id || receipt.payment_id || "receipt"}-${receipt.lookup_code}`} className="group rounded-lg border border-outline-variant/40 bg-white text-sm">
                      <summary className="grid cursor-pointer list-none gap-2 p-3 sm:grid-cols-[minmax(0,1.4fr)_110px_120px_110px] sm:items-center">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Kỳ cước</p>
                          <p className="truncate font-extrabold text-on-surface">{receipt.period_start || "Chưa có"} - {receipt.period_end || "Chưa có"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Số tiền</p>
                          <p className="font-extrabold text-primary">{formatBillGoCurrency(receipt.paid_amount ?? payment?.amount)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Ngày thu</p>
                          <p className="font-bold text-on-surface">{(receipt.paid_at || payment?.paid_at) ? new Date(receipt.paid_at || payment?.paid_at || "").toLocaleDateString("vi-VN") : "Chưa có"}</p>
                        </div>
                        <div className="flex items-end justify-between gap-2 sm:block">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Mã phiếu</p>
                            <p className="font-bold text-on-surface">{receipt.receipt_code}</p>
                            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${receiptStatus === "Đã hoàn tác" ? "bg-error-container text-error" : "bg-success-container text-success"}`}>{receiptStatus}</span>
                          </div>
                          <span className="text-xs font-bold text-primary group-open:hidden">Mở</span>
                          <span className="hidden text-xs font-bold text-primary group-open:inline">Đóng</span>
                        </div>
                      </summary>
                      <div className="border-t border-outline-variant/30 p-3 pt-2">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          <a href={`/billgo/receipt/${receipt.lookup_code}`} target="_blank" rel="noreferrer" className="btn-outline !w-full !px-2 !py-2 text-xs">Xem</a>
                          <a href={`/billgo/receipt/${receipt.lookup_code}?print=1`} target="_blank" rel="noreferrer" className="btn-outline !w-full !px-2 !py-2 text-xs">PDF/In</a>
                          <button type="button" onClick={() => void shareReceipt(receipt)} className="btn-outline !w-full !px-2 !py-2 text-xs">Chia sẻ</button>
                          <button type="button" onClick={() => void shareReceipt(receipt)} className="btn-outline !w-full !px-2 !py-2 text-xs">Zalo</button>
                          <button type="button" disabled={!canReverseReceipt || saving} onClick={() => void reverseCollection(receiptTarget, payment, receipt)} className="btn-outline !w-full !px-2 !py-2 text-xs text-error disabled:opacity-45">Hoàn tác</button>
                        </div>
                        {receiptStatus === "Đã hoàn tác" && <p className="mt-2 rounded-lg bg-error-container/40 p-2 text-xs font-bold text-error">Phiếu thu đã hoàn tác{receipt.reversed_at ? ` lúc ${new Date(receipt.reversed_at).toLocaleString("vi-VN")}` : ""}.</p>}
                        {(receipt.note || payment?.note) && <p className="mt-2 text-xs text-on-surface-variant">{receipt.note || payment?.note}</p>}
                      </div>
                    </details>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {collecting && selectedSummary && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
          <form onSubmit={submitCollection} className="modal-panel flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden p-0">
            <div className="overflow-y-auto p-4 pb-3">
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
                <div className="rounded-lg bg-surface-container-low p-3">Chu kỳ: <strong>{getBillGoCycleOption(getBillGoRowCycle(collecting)).label}</strong></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-surface-container-low p-3">Số tháng tính tiền<br /><strong>{collecting.billing_months || 0}</strong></div>
                  <div className="rounded-lg bg-surface-container-low p-3">Số tháng sử dụng<br /><strong>{collecting.service_months || ((collecting.billing_months || 0) + (collecting.bonus_months || 0))}</strong></div>
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">Đến hạn tiếp theo: <strong>{(collecting.next_due_date || collecting.subscription?.next_due_date) ? new Date(collecting.next_due_date || collecting.subscription?.next_due_date || "").toLocaleDateString("vi-VN") : "Chưa có"}</strong></div>
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
            </div>
            <div className="border-t border-outline-variant/30 bg-white p-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)]">
              <button disabled={saving || toMoneyNumber(collectForm.amount) <= 0} className="btn-primary !w-full">
                {saving ? "Đang xác nhận..." : "Xác nhận thu tiền"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showBulkCycle && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
          <form onSubmit={submitBulkCycle} className="modal-panel w-full max-w-lg overflow-y-auto p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-primary">BillGo</p>
                <h2 className="text-lg font-extrabold">Gan chu ky hang loat</h2>
              </div>
              <button type="button" onClick={() => setShowBulkCycle(false)} className="btn-outline !w-auto !px-3 !py-2">Dong</button>
            </div>
            <div className="mt-4 rounded-lg bg-primary-fixed p-3 text-sm font-bold text-primary">
              Ap dung cho {selectedCycleSubscriptionIds.length} khach hang da chon. Cac phieu thu va ky da thu se duoc giu nguyen.
            </div>
            <div className="mt-4 grid gap-3">
              <select className="input-field" value={bulkCycleForm.cycle} onChange={event => setBulkCycleForm(previous => ({ ...previous, cycle: event.target.value as BillGoCycle }))}>
                {BILLGO_CYCLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
                Ky/thang bat dau
                <input type="date" className="input-field" value={bulkCycleForm.effectivePeriodStart} onChange={event => setBulkCycleForm(previous => ({ ...previous, effectivePeriodStart: event.target.value }))} />
              </label>
              <textarea className="input-field min-h-20" placeholder="Ghi chu thay doi" value={bulkCycleForm.note} onChange={event => setBulkCycleForm(previous => ({ ...previous, note: event.target.value }))} />
              <p className="text-xs text-on-surface-variant">He thong chi dieu chinh cac ky chua thu va ky tuong lai tu thang bat dau da chon.</p>
            </div>
            <button disabled={saving || selectedCycleSubscriptionIds.length === 0} className="btn-primary mt-4 !w-full">
              {saving ? "Dang gan chu ky..." : "Xac nhan gan chu ky"}
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
                  {actionMode === "edit" ? "Sửa thông tin" : actionMode === "cycle" ? "Chuyển hình thức đóng" : actionMode === "status" ? (actionTarget.subscription?.status === "paused" ? "Kích hoạt lại" : "Ngừng thu") : actionMode === "delete" ? "Xóa khách hàng" : "Chi tiết khách hàng"}
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
                  ["Địa chỉ", getBillGoAddress(actionTarget.subscription) || "Chưa có"],
                  ["Nhà mạng", actionTarget.subscription?.provider || "Chưa có"],
                  ["Hình thức hiện tại", getBillGoCycleOption(actionTarget.subscription?.current_cycle || actionTarget.subscription?.cycle || "monthly").label],
                  ["Đã thanh toán đến", getPaidThroughDisplay(actionTarget) || "Chưa có"],
                  ["Kỳ thu tiếp theo", getNextPeriodStartForRow(actionTarget) ? dateLabel(getNextPeriodStartForRow(actionTarget) || "") : "Chưa có"],
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
                      <strong>{formatBillGoCurrency(payment.amount)}</strong> · {payment.status === "void" ? "Đã hoàn tác" : "Đã thu"} · {methodLabels[payment.method] || payment.method} · {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("vi-VN") : "Chưa có ngày"}
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
                <input required list="billgo-edit-customer-address-suggestions" className="input-field sm:col-span-2" placeholder="Địa chỉ khách hàng" value={editForm.address} onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value, addressDetail: e.target.value }))} />
                <datalist id="billgo-edit-customer-address-suggestions">
                  {customerAddressSuggestions.map(address => <option key={address} value={address} />)}
                </datalist>
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
