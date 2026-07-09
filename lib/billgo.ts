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
  payments?: BillGoPayment[] | null;
};

export type BillGoCycle = "monthly" | "three_months" | "six_months" | "yearly";
export type BillGoComputedStatus = "not_due" | "due" | "overdue" | "paid";
export type BillGoStoredStatus = BillGoComputedStatus | "unpaid" | "partial" | "cancelled";

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
  paidMonths: number;
  bonusMonths: number;
}> = [
  { value: "monthly", label: "1 thang", paidMonths: 1, bonusMonths: 0 },
  { value: "three_months", label: "3 thang", paidMonths: 3, bonusMonths: 0 },
  { value: "six_months", label: "6 thang", paidMonths: 6, bonusMonths: 0 },
  { value: "yearly", label: "12 thang tang 1 thang", paidMonths: 12, bonusMonths: 1 },
];

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
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

export const getBillGoCycleOption = (cycle: string) =>
  BILLGO_CYCLE_OPTIONS.find(option => option.value === cycle) || BILLGO_CYCLE_OPTIONS[0];

export const getBillGoPeriodEndDate = (startDate: string | Date, cycle: string) => {
  const option = getBillGoCycleOption(cycle);
  const periodEnd = addBillGoMonths(startDate, option.paidMonths + option.bonusMonths);
  periodEnd.setDate(periodEnd.getDate() - 1);
  return toBillGoDateInput(periodEnd);
};

export const getBillGoPostpaidDueDate = (periodEndDate: string | Date) => {
  const periodEnd = periodEndDate instanceof Date ? new Date(periodEndDate) : new Date(periodEndDate);
  if (Number.isNaN(periodEnd.getTime())) return toBillGoDateInput(new Date());
  return toBillGoDateInput(new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 20));
};

export const getBillGoBillingPeriod = (startDate: string | Date, cycle: string) => {
  const periodStart = toBillGoDateInput(startDate);
  const periodEnd = getBillGoPeriodEndDate(periodStart, cycle);
  const dueDate = getBillGoPostpaidDueDate(periodEnd);
  const option = getBillGoCycleOption(cycle);

  return {
    periodStart,
    periodEnd,
    dueDate,
    billingMonths: option.paidMonths,
    bonusMonths: option.bonusMonths,
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

export const getBillGoReceivable = (job: Pick<BillGoJobLike, "quoted_price" | "final_amount">) => {
  const finalAmount = toMoneyNumber(job.final_amount);
  return finalAmount > 0 ? finalAmount : toMoneyNumber(job.quoted_price);
};

export const getBillGoPaid = (payments: BillGoPayment[] = []) =>
  payments
    .filter(payment => (payment.status || "paid") === "paid")
    .reduce((sum, payment) => sum + toMoneyNumber(payment.amount), 0);

export const getBillGoStatusLabel = (status: BillGoComputedStatus) => {
  if (status === "paid") return "Da thu";
  if (status === "overdue") return "Qua han";
  if (status === "due") return "Den han";
  return "Chua den han";
};

export const getBillGoComputedStatus = (total: number, paid: number, dueDate?: string | null) => {
  const debt = Math.max(total - paid, 0);
  const dueTime = dueDate ? new Date(dueDate).getTime() : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (total > 0 && debt <= 0) return "paid" as const;
  if (dueTime !== null && dueTime < today.getTime() && debt > 0) return "overdue" as const;
  if (dueTime !== null && dueTime === today.getTime() && debt > 0) return "due" as const;
  return "not_due" as const;
};

export const getBillGoStoredStatus = (total: number, paid: number, dueDate?: string | null): BillGoStoredStatus => {
  const status = getBillGoComputedStatus(total, paid, dueDate);
  if (status === "not_due" || status === "due" || status === "overdue" || status === "paid") return status;
  return "not_due";
};

export const getBillGoReceivableSummary = (receivable: BillGoReceivableLike): BillGoSummary => {
  const total = toMoneyNumber(receivable.total_amount);
  const paid = getBillGoPaid(receivable.payments || []);
  const debt = Math.max(total - paid, 0);
  const status = getBillGoComputedStatus(total, paid, receivable.due_date);

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
    status: "not_due",
    statusLabel: receivable > 0 ? getBillGoStatusLabel("not_due") : "Chua co khoan thu",
  };
};
