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

export type BillGoSummary = {
  receivable: number;
  paid: number;
  debt: number;
  status: "unpaid" | "partial" | "paid";
  statusLabel: string;
};

export const toMoneyNumber = (value?: number | string | null) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

export const formatBillGoCurrency = (amount?: number | string | null) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(toMoneyNumber(amount));

export const getBillGoReceivable = (job: Pick<BillGoJobLike, "quoted_price" | "final_amount">) => {
  const finalAmount = toMoneyNumber(job.final_amount);
  return finalAmount > 0 ? finalAmount : toMoneyNumber(job.quoted_price);
};

export const getBillGoPaid = (payments: BillGoPayment[] = []) =>
  payments
    .filter(payment => (payment.status || "paid") === "paid")
    .reduce((sum, payment) => sum + toMoneyNumber(payment.amount), 0);

export const getBillGoSummary = (job: BillGoJobLike): BillGoSummary => {
  const receivable = getBillGoReceivable(job);
  const paid = getBillGoPaid(job.payments || []);
  const debt = Math.max(receivable - paid, 0);

  if (receivable > 0 && debt <= 0) {
    return { receivable, paid, debt, status: "paid", statusLabel: "Đã thu đủ" };
  }

  if (paid > 0 && debt > 0) {
    return { receivable, paid, debt, status: "partial", statusLabel: "Còn nợ" };
  }

  return { receivable, paid, debt, status: "unpaid", statusLabel: receivable > 0 ? "Chưa thu" : "Chưa có khoản thu" };
};
