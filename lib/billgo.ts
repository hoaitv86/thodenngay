export type BillGoPayment = {
  id?: string | null;
  amount?: number | string | null;
  status?: string | null;
};

export type BillGoJobLike = {
  quoted_price?: number | string | null;
  final_amount?: number | string | null;
  payments?: BillGoPayment[] | null;
};

export type BillGoReceivableLike = {
  total_amount?: number | string | null;
  due_date?: string | null;
  status?: string | null;
  paid_amount?: number | string | null;
  payments?: BillGoPayment[] | null;
};

export type BillGoCycle = "monthly" | "two_months" | "three_months" | "six_months" | "yearly";
export type BillGoComputedStatus = "not_due" | "unpaid" | "partial" | "overdue" | "paid" | "promo";
export type BillGoStoredStatus = BillGoComputedStatus | "not_due" | "due" | "cancelled" | "deleted";

export type BillGoSummary = {
  receivable: number;
  paid: number;
  debt: number;
  status: BillGoComputedStatus;
  statusLabel: string;
};

export const BILLGO_CYCLE_OPTIONS: Array<{
  value: BillGoCycle;
  label: string;
  shortLabel: string;
  paidMonths: number;
  bonusMonths: number;
}> = [
  { value: "monthly", label: "Hàng tháng", shortLabel: "Hàng tháng", paidMonths: 1, bonusMonths: 0 },
  { value: "two_months", label: "2 tháng", shortLabel: "2 tháng", paidMonths: 2, bonusMonths: 0 },
  { value: "three_months", label: "3 tháng", shortLabel: "3 tháng", paidMonths: 3, bonusMonths: 0 },
  { value: "six_months", label: "6 tháng", shortLabel: "6 tháng", paidMonths: 6, bonusMonths: 0 },
  { value: "yearly", label: "12 tháng + 1", shortLabel: "12 tháng + 1", paidMonths: 12, bonusMonths: 1 },
];

export const BILLGO_ALL_TAB = "all";
export const BILLGO_ACCOUNT_SUGGESTIONS = ["n350_gftth_", "nbh_gftth_"];

export const buildBillGoReceiptCode = (paymentId: string, paidAt: string | Date = new Date()) => {
  const date = paidAt instanceof Date ? paidAt : new Date(paidAt);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const datePart = `${safeDate.getFullYear()}${String(safeDate.getMonth() + 1).padStart(2, "0")}${String(safeDate.getDate()).padStart(2, "0")}`;
  const suffix = paymentId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `BG-${datePart}-${suffix}`;
};

export const buildBillGoReceiptLookupCode = (receiptCode: string) =>
  receiptCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export const toMoneyNumber = (value?: number | string | null) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

export const formatBillGoCurrency = (amount?: number | string | null) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(toMoneyNumber(amount));

export const addBillGoMonths = (value: string | Date, months: number) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return date;
};

export const toBillGoDateInput = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getBillGoCycleOption = (cycle: string) =>
  BILLGO_CYCLE_OPTIONS.find(option => option.value === cycle) || BILLGO_CYCLE_OPTIONS[0];

export const getBillGoCollectableAmount = (monthlyFee?: number | string | null, cycle = "monthly") => {
  const option = getBillGoCycleOption(cycle);
  return Math.max(toMoneyNumber(monthlyFee), 0) * option.paidMonths;
};

export const getBillGoPeriodEndDate = (startDate: string | Date, cycle: string) => {
  const option = getBillGoCycleOption(cycle);
  const periodStart = startDate instanceof Date ? new Date(startDate) : new Date(startDate);
  const safeStart = Number.isNaN(periodStart.getTime()) ? new Date() : periodStart;
  const serviceMonths = option.paidMonths + option.bonusMonths;
  return toBillGoDateInput(new Date(safeStart.getFullYear(), safeStart.getMonth() + serviceMonths, 0));
};

export const getBillGoPostpaidDueDate = (periodEndDate: string | Date) => {
  const periodEnd = periodEndDate instanceof Date ? new Date(periodEndDate) : new Date(periodEndDate);
  if (Number.isNaN(periodEnd.getTime())) return toBillGoDateInput(new Date());
  return toBillGoDateInput(new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 19));
};

export const getBillGoBillingPeriod = (startDate: string | Date, cycle: string) => {
  const periodStart = toBillGoDateInput(startDate);
  const periodEnd = getBillGoPeriodEndDate(periodStart, cycle);
  const option = getBillGoCycleOption(cycle);
  const isMonthly = option.value === "monthly";
  const dueDate = isMonthly
    ? getBillGoPostpaidDueDate(periodEnd)
    : toBillGoDateInput(new Date(new Date(periodStart).getFullYear(), new Date(periodStart).getMonth(), 19));
  const collectionMonth = isMonthly
    ? toBillGoDateInput(new Date(new Date(periodEnd).getFullYear(), new Date(periodEnd).getMonth() + 1, 1))
    : toBillGoDateInput(new Date(new Date(periodStart).getFullYear(), new Date(periodStart).getMonth(), 1));

  return {
    periodStart,
    periodEnd,
    dueDate,
    collectionMonth,
    usageMonth: toBillGoDateInput(new Date(new Date(periodStart).getFullYear(), new Date(periodStart).getMonth(), 1)),
    billingMonths: option.paidMonths,
    bonusMonths: option.bonusMonths,
    totalServiceMonths: option.paidMonths + option.bonusMonths,
  };
};

export const getBillGoNextDueDate = (startDate: string | Date, cycle: string) =>
  getBillGoBillingPeriod(startDate, cycle).dueDate;

export const getBillGoNextPeriodStartDate = (periodEndDate: string | Date) => {
  const periodEnd = periodEndDate instanceof Date ? new Date(periodEndDate) : new Date(periodEndDate);
  if (Number.isNaN(periodEnd.getTime())) return toBillGoDateInput(new Date());
  periodEnd.setDate(periodEnd.getDate() + 1);
  return toBillGoDateInput(periodEnd);
};

export const getBillGoFirstOfMonth = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return toBillGoDateInput(new Date());
  return toBillGoDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
};

export const getBillGoBillingParts = (collectionMonth: string | Date) => {
  const date = collectionMonth instanceof Date ? new Date(collectionMonth) : new Date(collectionMonth);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    billingMonth: safeDate.getMonth() + 1,
    billingYear: safeDate.getFullYear(),
  };
};

export const buildBillGoCoverageMonths = (periodStart: string | Date, paidMonths: number, bonusMonths: number) => [
  ...Array.from({ length: Math.max(paidMonths, 0) }, (_, index) => ({
    covered_month: getBillGoFirstOfMonth(addBillGoMonths(periodStart, index)),
    coverage_type: "paid" as const,
  })),
  ...Array.from({ length: Math.max(bonusMonths, 0) }, (_, index) => ({
    covered_month: getBillGoFirstOfMonth(addBillGoMonths(periodStart, paidMonths + index)),
    coverage_type: "promo" as const,
  })),
];

export const getBillGoReceivable = (job: Pick<BillGoJobLike, "quoted_price" | "final_amount">) => {
  const finalAmount = toMoneyNumber(job.final_amount);
  return finalAmount > 0 ? finalAmount : toMoneyNumber(job.quoted_price);
};

export const getBillGoPaid = (payments: BillGoPayment[] = []) =>
  payments
    .filter(payment => (payment.status || "paid") === "paid")
    .reduce((sum, payment) => sum + toMoneyNumber(payment.amount), 0);

export const getBillGoStatusLabel = (status: BillGoComputedStatus) => {
  if (status === "not_due") return "Chưa đến kỳ";
  if (status === "paid") return "Đã thu";
  if (status === "partial") return "Thu thiếu";
  if (status === "overdue") return "Quá hạn";
  if (status === "promo") return "Khuyến mại";
  return "Chưa thu";
};

export const getBillGoComputedStatus = (total: number, paid: number, dueDate?: string | null) => {
  const debt = Math.max(total - paid, 0);
  const dueTime = dueDate ? new Date(dueDate).getTime() : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (total > 0 && debt <= 0) return "paid" as const;
  if (paid > 0 && debt > 0) return "partial" as const;
  if (dueTime !== null && dueTime < today.getTime() && debt > 0) return "overdue" as const;
  return "unpaid" as const;
};

export const getBillGoStoredStatus = (total: number, paid: number, dueDate?: string | null): BillGoStoredStatus => {
  const status = getBillGoComputedStatus(total, paid, dueDate);
  if (status === "overdue" || status === "paid" || status === "partial" || status === "unpaid") return status;
  return "unpaid";
};

export const getBillGoReceivableSummary = (receivable: BillGoReceivableLike): BillGoSummary => {
  const total = toMoneyNumber(receivable.total_amount);
  const storedPaid = toMoneyNumber(receivable.paid_amount);
  const paid = storedPaid > 0 ? storedPaid : getBillGoPaid(receivable.payments || []);
  const debt = Math.max(total - paid, 0);
  const computedStatus = getBillGoComputedStatus(total, paid, receivable.due_date);
  const status = computedStatus === "paid" || computedStatus === "partial" || computedStatus === "overdue"
    ? computedStatus
    : receivable.status === "paid"
      ? "paid"
      : receivable.status === "not_due"
        ? "not_due"
        : receivable.status === "promo"
          ? "promo"
          : computedStatus;

  return { receivable: total, paid, debt, status, statusLabel: getBillGoStatusLabel(status) };
};

export const getBillGoSummary = (job: BillGoJobLike): BillGoSummary => {
  const receivable = getBillGoReceivable(job);
  const paid = getBillGoPaid(job.payments || []);
  const debt = Math.max(receivable - paid, 0);

  if (receivable > 0 && debt <= 0) {
    return { receivable, paid, debt, status: "paid", statusLabel: getBillGoStatusLabel("paid") };
  }

  return {
    receivable,
    paid,
    debt,
    status: "unpaid",
    statusLabel: receivable > 0 ? getBillGoStatusLabel("unpaid") : "Chưa có khoản thu",
  };
};
