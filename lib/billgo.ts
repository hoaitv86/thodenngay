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

export type BillGoSummary = {
  receivable: number;
  paid: number;
  debt: number;
  status: "unpaid" | "partial" | "paid" | "overdue";
  statusLabel: string;
};

export type BillGoCycle = "monthly" | "three_months" | "six_months" | "yearly";

export const BILLGO_CYCLE_OPTIONS: Array<{
  value: BillGoCycle;
  label: string;
  paidMonths: number;
  bonusMonths: number;
}> = [
  { value: "monthly", label: "1 tháng", paidMonths: 1, bonusMonths: 0 },
  { value: "three_months", label: "3 tháng", paidMonths: 3, bonusMonths: 0 },
  { value: "six_months", label: "6 tháng", paidMonths: 6, bonusMonths: 0 },
  { value: "yearly", label: "12 tháng tặng 1 tháng", paidMonths: 12, bonusMonths: 1 },
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

export const getBillGoNextDueDate = (startDate: string | Date, cycle: string) => {
  const option = getBillGoCycleOption(cycle);
  return toBillGoDateInput(addBillGoMonths(startDate, option.paidMonths + option.bonusMonths));
};

export const getBillGoPeriodEndDate = (startDate: string | Date, cycle: string) => {
  const option = getBillGoCycleOption(cycle);
  const nextDue = addBillGoMonths(startDate, option.paidMonths + option.bonusMonths);
  nextDue.setDate(nextDue.getDate() - 1);
  return toBillGoDateInput(nextDue);
};

export const getBillGoReceivable = (job: Pick<BillGoJobLike, "quoted_price" | "final_amount">) => {
  const finalAmount = toMoneyNumber(job.final_amount);
  return finalAmount > 0 ? finalAmount : toMoneyNumber(job.quoted_price);
};

export const getBillGoPaid = (payments: BillGoPayment[] = []) =>
  payments
    .filter(payment => (payment.status || "paid") === "paid")
    .reduce((sum, payment) => sum + toMoneyNumber(payment.amount), 0);

export const getBillGoStatusLabel = (status: BillGoSummary["status"]) => {
  if (status === "paid") return "Đã thu đủ";
  if (status === "partial") return "Đã thu một phần";
  if (status === "overdue") return "Quá hạn";
  return "Chưa thu";
};

export const getBillGoReceivableSummary = (receivable: BillGoReceivableLike): BillGoSummary => {
  const total = toMoneyNumber(receivable.total_amount);
  const paid = getBillGoPaid(receivable.payments || []);
  const debt = Math.max(total - paid, 0);
  const dueTime = receivable.due_date ? new Date(receivable.due_date).getTime() : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (total > 0 && debt <= 0) {
    return { receivable: total, paid, debt, status: "paid", statusLabel: getBillGoStatusLabel("paid") };
  }

  if (paid > 0 && debt > 0) {
    return { receivable: total, paid, debt, status: "partial", statusLabel: getBillGoStatusLabel("partial") };
  }

  if (dueTime !== null && dueTime < today.getTime() && debt > 0) {
    return { receivable: total, paid, debt, status: "overdue", statusLabel: getBillGoStatusLabel("overdue") };
  }

  return { receivable: total, paid, debt, status: "unpaid", statusLabel: getBillGoStatusLabel("unpaid") };
};

export const getBillGoSummary = (job: BillGoJobLike): BillGoSummary => {
  const receivable = getBillGoReceivable(job);
  const paid = getBillGoPaid(job.payments || []);
  const debt = Math.max(receivable - paid, 0);

  if (receivable > 0 && debt <= 0) {
    return { receivable, paid, debt, status: "paid", statusLabel: getBillGoStatusLabel("paid") };
  }

  if (paid > 0 && debt > 0) {
    return { receivable, paid, debt, status: "partial", statusLabel: getBillGoStatusLabel("partial") };
  }

  return {
    receivable,
    paid,
    debt,
    status: "unpaid",
    statusLabel: receivable > 0 ? getBillGoStatusLabel("unpaid") : "Chưa có khoản thu",
  };
};
