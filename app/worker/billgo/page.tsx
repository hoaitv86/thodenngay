"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
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
} from "@/lib/billgo-packages";
import { createClient } from "@/lib/supabase/client";

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
  receipt_code: string;
  lookup_code: string;
  qr_payload: string;
  period_start?: string | null;
  period_end?: string | null;
  paid_at?: string | null;
  paid_amount?: number | string | null;
  payment_method?: string | null;
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
  cycle: BillGoCycle;
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
  totalReceivable: number;
  totalPaid: number;
  totalDebt: number;
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
const BILLGO_PAGE_SIZE = 10;
const emptyBillGoTotals: BillGoListTotals = {
  totalCustomers: 0,
  unpaid: 0,
  paid: 0,
  partial: 0,
  overdue: 0,
  promo: 0,
  notDue: 0,
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

const statusOptions = [
  { value: "all", label: "Tất cả trạng thái" },
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
  provider: "Viettel",
  packageId: "",
  packageName: "",
  monthlyFee: "",
  cycle: "monthly" as BillGoCycle,
  startDate: previousMonthFirstInput(),
  dueDate: "",
  note: "",
  isLegacyCustomer: false,
  paidThroughMonth: "",
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

const getBillGoRowCycle = (item: Receivable) =>
  (String(item.id || "").startsWith("not_due_")
    ? item.subscription?.current_cycle || item.subscription?.cycle || item.cycle_at_collection || "monthly"
    : item.cycle_at_collection || item.subscription?.current_cycle || item.subscription?.cycle || "monthly") as BillGoCycle;

const getSignupCycleValues = (allowedCycles?: BillGoCycle[] | null) =>
  new Set([...(allowedCycles || []), ...BILLGO_SIGNUP_CYCLES]);

const subAreaNameCollator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

const upfrontSignupCycles = new Set<BillGoCycle>(["two_months", "three_months", "six_months", "yearly"]);

const applySignupCycleDefaults = <T extends { cycle: BillGoCycle; startDate: string; dueDate: string }>(form: T, cycle: BillGoCycle): T => {
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
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<BillGoImportRow[]>([]);
  const [importPreview, setImportPreview] = useState<BillGoImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [packageSearch, setPackageSearch] = useState("");
  const [collecting, setCollecting] = useState<Receivable | null>(null);
  const [actionTarget, setActionTarget] = useState<Receivable | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<Receivable | null>(null);
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
          dueFilter: string;
          areaStatusFilter: string;
          selectedAreaId: string;
          selectedSubAreaId: string;
          query: string;
        }>;
        if (saved.viewMode) setViewMode(saved.viewMode);
        if (saved.activeTab) setActiveTab(saved.activeTab);
        if (saved.monthFilter === monthInput()) setMonthFilter(saved.monthFilter);
        if (saved.statusFilter && saved.statusFilter !== "not_due") setStatusFilter(saved.statusFilter);
        if (saved.dueFilter && saved.dueFilter !== "not_due") setDueFilter(saved.dueFilter);
        if (saved.areaStatusFilter && saved.areaStatusFilter !== "not_due") setAreaStatusFilter(saved.areaStatusFilter);
        if (typeof saved.selectedAreaId === "string") setSelectedAreaId(saved.selectedAreaId);
        if (typeof saved.selectedSubAreaId === "string") setSelectedSubAreaId(saved.selectedSubAreaId);
        if (typeof saved.query === "string") setQuery(saved.query);
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
    }));
  }, [activeTab, areaStatusFilter, dueFilter, monthFilter, query, selectedAreaId, selectedSubAreaId, statusFilter, viewMode, viewStateHydrated]);

  const fetchAreas = useCallback(async () => {
    const response = await fetch("/api/worker/areas");
    if (!response.ok) {
      setAreas([]);
      return;
    }
    const result = await response.json();
    setAreas((result.areas || []) as AreaOption[]);
  }, []);

  const fetchPackages = useCallback(async () => {
    const { data, error } = await supabase
      .from("billgo_packages")
      .select("id, code, name, type, provider, monthly_price, setup_price, allowed_cycles, description, is_active, sort_order")
      .eq("is_active", true)
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    setPackages(error ? [] : (data || []) as BillGoPackage[]);
  }, [supabase]);

  const fetchBillGo = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
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
      const response = await fetch(`/api/worker/billgo?${params.toString()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể tải BillGo.");
      setRows(normalizeRows(result.rows || []));
      setPage(Number(result.page || 1));
      setPageCount(Number(result.pageCount || 1));
      setTotalRows(Number(result.total || 0));
      setServerTotals({ ...emptyBillGoTotals, ...(result.totals || {}) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải BillGo.");
      setRows([]);
      setPageCount(1);
      setTotalRows(0);
      setServerTotals(emptyBillGoTotals);
    } finally {
      setLoading(false);
    }
  }, [activeTab, areaStatusFilter, dueFilter, monthFilter, page, query, selectedAreaId, selectedSubAreaId, statusFilter, viewMode]);

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

  const filteredRows = useMemo(() => rowViews.filter(row => {
    if (activeTab !== BILLGO_ALL_TAB && row.cycle !== activeTab) return false;
    if (!matchesBillGoStatusFilter(row.summary.status, statusFilter)) return false;
    if (!matchesDueFilter(row)) return false;
    return matchesSearch(row);
  }), [activeTab, matchesDueFilter, matchesSearch, rowViews, statusFilter]);

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
    if (!matchesBillGoStatusFilter(row.summary.status, areaStatusFilter)) return false;
    if (!matchesDueFilter(row)) return false;
    return matchesSearch(row);
  }).sort((a, b) => {
    const order: Record<string, number> = { unpaid: 0, partial: 1, overdue: 2, paid: 3, promo: 4 };
    return (order[a.summary.status] ?? 9) - (order[b.summary.status] ?? 9) || a.customerName.localeCompare(b.customerName);
  }), [areaStatusFilter, matchesDueFilter, matchesSearch, rowViews, selectedArea, selectedAreaId, selectedAreaSubAreas, selectedSubAreaId]);

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
  const overduePeriodLabels = useMemo(() => Array.from(new Set(visibleRows
    .flatMap(row => getPreviousUnpaidReceivables(row.item))
    .map(previous => monthYearLabel(previous.period_start || previous.collection_month || `${monthFilter}-01`))))
    .sort((a, b) => a.localeCompare(b, "vi")), [monthFilter, visibleRows]);

  const processedCount = areaStats.paid;
  const remainingCount = areaStats.unpaid + areaStats.partial + areaStats.overdue;

  const totals = serverTotals;
  const totalUncollectedCustomers = totals.unpaid + totals.partial + totals.overdue;

  const selectedSubAreaIndex = selectedAreaSubAreas.findIndex(subArea => subArea.id === selectedSubAreaId);
  const previousSubArea = selectedSubAreaIndex > 0 ? selectedAreaSubAreas[selectedSubAreaIndex - 1] : null;
  const nextSubArea = selectedSubAreaIndex >= 0 && selectedSubAreaIndex < selectedAreaSubAreas.length - 1 ? selectedAreaSubAreas[selectedSubAreaIndex + 1] : null;

  const formBilling = useMemo(() => getBillGoBillingPeriod(form.startDate, form.cycle), [form.cycle, form.startDate]);
  const formDueDate = form.dueDate || formBilling.dueDate;
  const formTotal = useMemo(() => getBillGoCollectableAmount(form.monthlyFee, form.cycle), [form.cycle, form.monthlyFee]);
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
  const packageSearchDigits = packageSearch.replace(/\D/g, "");
  const packageSearchText = packageSearch.trim().toLocaleLowerCase("vi");
  const formPackageOptions = useMemo(
    () => {
      if (packageSearchDigits) {
        return packages.filter(item => String(Number(item.monthly_price || 0)).startsWith(packageSearchDigits));
      }
      if (!packageSearchText) return packages;
      return packages.filter(item => {
        const label = [getBillGoPackageTypeLabel(item.type), item.name, item.provider, formatBillGoCurrency(item.monthly_price)]
          .join(" ")
          .toLocaleLowerCase("vi");
        return label.includes(packageSearchText);
      });
    },
    [packageSearchDigits, packageSearchText, packages],
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
      if (key === "isLegacyCustomer") return { ...prev, isLegacyCustomer: value === "true", paidThroughMonth: value === "true" ? prev.paidThroughMonth : "" };
      if (key === "cycle") return applySignupCycleDefaults(prev, value as BillGoCycle);
      if (key === "packageId") {
        const selectedPackage = packages.find(item => item.id === value);
        if (!selectedPackage) return { ...prev, packageId: "", packageName: "", monthlyFee: "" };
        const allowedCycles = getSignupCycleValues(selectedPackage.allowed_cycles);
        const nextCycle = allowedCycles.has(prev.cycle) ? prev.cycle : BILLGO_SIGNUP_CYCLES[0] || "monthly";
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
    updateForm("packageId", packageOption.id);
  };

  const updatePackageSearch = (value: string) => {
    setPackageSearch(value);
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
      setActiveTab(addedCycle);
      setStatusFilter("all");
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
      cycle: (subscription?.current_cycle || subscription?.cycle || "monthly") as BillGoCycle,
      effectivePeriodStart: getNextPeriodStartDisplay(subscription, item.period_start) || todayInput(),
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
        setActiveTab(editForm.cycle);
      }
      await refreshBillGoKeepingScroll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu thay đổi BillGo.");
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

  const renderRow = (row: RowView) => {
    const { item, summary } = row;
    const cycle = getBillGoCycleOption(row.cycle);
    const canCollect = summary.status !== "not_due" && summary.status !== "paid" && summary.status !== "promo";
    const receiptEntries = getReceiptEntries(item);
    const previousUnpaidReceivables = getPreviousUnpaidReceivables(item);
    const hasPreviousUnpaidPeriod = previousUnpaidReceivables.length > 0;
    const firstPreviousUnpaid = previousUnpaidReceivables[0];

    return (
      <article key={item.id} className="grid gap-3 rounded-lg border border-outline-variant/40 bg-white p-3 shadow-sm lg:grid-cols-[minmax(190px,1.5fr)_120px_190px_130px_130px_110px] lg:items-center">
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
            {receiptEntries.length > 0 && (
              <button type="button" onClick={() => setReceiptTarget(item)} className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 bg-white px-3 py-2 text-xs font-extrabold text-primary">
                Phiếu thu
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
                  <PauseCircle size={16} /> {item.subscription?.status === "paused" ? "Kích hoạt lại" : "Ngừng thu"}
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
          <p>Chu kỳ: {cycle.label}</p>
          <p>Sử dụng: {item.service_months || ((item.billing_months || 0) + (item.bonus_months || 0)) || cycle.paidMonths + cycle.bonusMonths} tháng</p>
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
          <button type="button" onClick={() => { if (showForm) setPackageSearch(""); setShowForm(value => !value); }} className="btn-primary !w-auto flex-1 sm:flex-none">
            <Plus size={18} /> Thêm khách hàng
          </button>
        </div>
      </header>

      {message && <div className="mt-4 rounded-lg bg-primary-fixed p-3 text-sm font-bold text-primary">{message}</div>}
      {importError && <div className="mt-4 rounded-lg bg-error-container p-3 text-sm font-bold text-error">{importError}</div>}
      {overduePeriodLabels.length > 0 && (
        <div className="mt-4 rounded-lg border border-error/30 bg-error-container/60 p-3 text-sm font-extrabold text-error">
          {overduePeriodLabels.map(label => `Còn kỳ cước ${label} chưa thu`).join(" ; ")}
        </div>
      )}
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
        <form onSubmit={submitCustomer} className="mt-4 grid h-[calc(100dvh-16rem)] max-h-[calc(100dvh-16rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-outline-variant/50 bg-white shadow-sm">
          <div className="border-b border-outline-variant/25 bg-white px-4 py-3">
            <h2 className="text-base font-extrabold">Thêm khách hàng</h2>
          </div>
          <div className="min-h-0 overflow-y-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
              <input required list="billgo-customer-address-suggestions" className="input-field sm:col-span-2 xl:col-span-1" placeholder="Địa chỉ khách hàng" value={form.address} onChange={e => updateForm("address", e.target.value)} />
              <datalist id="billgo-customer-address-suggestions">
                {customerAddressSuggestions.map(address => <option key={address} value={address} />)}
              </datalist>
              <div className="relative grid gap-1 text-xs font-bold text-on-surface-variant">
                Chọn gói cước
                <input
                  required
                  inputMode="numeric"
                  className="input-field"
                  placeholder="Nhập giá tiền để tìm gói cước"
                  value={packageSearch}
                  onChange={e => updatePackageSearch(e.target.value)}
                />
                {packageSearch.trim() && (
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
              <input required readOnly={Boolean(selectedFormPackage)} className="input-field" placeholder="Tên gói tại thời điểm đăng ký" value={form.packageName} onChange={e => updateForm("packageName", e.target.value)} />
              <input required readOnly={Boolean(selectedFormPackage)} type="number" min="0" inputMode="numeric" className="input-field" placeholder="Số tiền cước một tháng" value={form.monthlyFee} onChange={e => updateForm("monthlyFee", e.target.value)} />
              <select className="input-field" value={form.cycle} onChange={e => updateForm("cycle", e.target.value)}>
                {signupCycleOptions
                  .filter(option => getSignupCycleValues(selectedFormPackage?.allowed_cycles).has(option.value))
                  .map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input readOnly className="input-field bg-surface-container-low font-bold" value={formatBillGoCurrency(formTotal)} aria-label="Số tiền cần thu" />
              <label className="flex items-center gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-sm font-bold text-on-surface sm:col-span-2 xl:col-span-3">
                <input type="checkbox" checked={form.isLegacyCustomer} onChange={e => updateForm("isLegacyCustomer", e.target.checked ? "true" : "false")} className="h-5 w-5 accent-primary" />
                Nhập khách hàng cũ
              </label>
              <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
                Kỳ cước {monthLabel(form.startDate)}
                <input required type="date" className="input-field" value={form.startDate} onChange={e => updateForm("startDate", e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs font-bold text-on-surface-variant">
                Hạn nộp tiền
                <input type="date" className="input-field" value={formDueDate} onChange={e => updateForm("dueDate", e.target.value)} />
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
              Kỳ cước {monthLabel(form.startDate)}: {dateLabel(formBilling.periodStart)} - {dateLabel(formBilling.periodEnd)}. Hạn nộp tiền: {dateLabel(formDueDate)}. {form.isLegacyCustomer && form.paidThroughMonth ? `Đã thu đến kỳ tháng ${form.paidThroughMonth.slice(5, 7)}/${form.paidThroughMonth.slice(0, 4)}; hệ thống tự xác định kỳ tiếp theo.` : "Khách hàng mới sẽ được tạo kỳ cước hiện tại ở trạng thái Chưa thu."} {form.cycle === "yearly" ? "Khách trả 12 tháng và được dùng 13 tháng." : ""}
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-outline-variant/25 bg-white p-4 shadow-[0_-10px_24px_rgba(15,23,42,0.08)]">
            <button type="button" onClick={() => { setPackageSearch(""); setShowForm(false); }} className="btn-outline !w-auto">Hủy</button>
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
          <input type="month" className="input-field" value={monthFilter} onChange={e => setMonthFilter(e.target.value || monthInput())} />
          <button type="button" title="Tháng hiện tại" onClick={() => setMonthFilter(monthInput())} className="btn-outline !w-auto !px-3">
            <RotateCcw size={16} />
          </button>
        </div>
        <label className="relative block">
          <select className="input-field appearance-none pr-10" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        </label>
        <label className="relative block">
          <select className="input-field appearance-none pr-10" value={dueFilter} onChange={e => setDueFilter(e.target.value)}>
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

      {loading ? (
        <div className="py-16 text-center text-sm text-on-surface-variant">Đang tải BillGo...</div>
      ) : visibleRows.length === 0 ? (
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
                  {getReceiptEntries(receiptTarget).map(({ payment, receipt }) => (
                    <details key={`${payment?.id || "receipt"}-${receipt.lookup_code}`} className="group rounded-lg border border-outline-variant/40 bg-white text-sm">
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
                          </div>
                          <span className="text-xs font-bold text-primary group-open:hidden">Mở</span>
                          <span className="hidden text-xs font-bold text-primary group-open:inline">Đóng</span>
                        </div>
                      </summary>
                      <div className="border-t border-outline-variant/30 p-3 pt-2">
                        <div className="grid grid-cols-4 gap-2">
                          <a href={`/billgo/receipt/${receipt.lookup_code}`} target="_blank" rel="noreferrer" className="btn-outline !w-full !px-2 !py-2 text-xs">Xem</a>
                          <a href={`/billgo/receipt/${receipt.lookup_code}?print=1`} target="_blank" rel="noreferrer" className="btn-outline !w-full !px-2 !py-2 text-xs">PDF/In</a>
                          <button type="button" onClick={() => void shareReceipt(receipt)} className="btn-outline !w-full !px-2 !py-2 text-xs">Chia sẻ</button>
                          <button type="button" onClick={() => void shareReceipt(receipt)} className="btn-outline !w-full !px-2 !py-2 text-xs">Zalo</button>
                        </div>
                        {(receipt.note || payment?.note) && <p className="mt-2 text-xs text-on-surface-variant">{receipt.note || payment?.note}</p>}
                      </div>
                    </details>
                  ))}
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
