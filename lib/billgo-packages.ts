import type { BillGoCycle } from "./billgo";

export type BillGoPackageType = "internet" | "tv360" | "receiver";

export type BillGoPackage = {
  id: string;
  code?: string | null;
  name: string;
  type: BillGoPackageType;
  provider?: string | null;
  monthly_price: number | string;
  setup_price?: number | string | null;
  allowed_cycles?: BillGoCycle[] | null;
  description?: string | null;
  is_active: boolean;
  sort_order?: number | null;
};

export const BILLGO_PACKAGE_TYPES: Array<{ value: BillGoPackageType; label: string }> = [
  { value: "internet", label: "Internet" },
  { value: "tv360", label: "TV360" },
  { value: "receiver", label: "Đầu thu" },
];

export const BILLGO_SIGNUP_CYCLES: BillGoCycle[] = ["monthly", "two_months", "three_months", "six_months", "yearly"];

export const getBillGoPackageTypeLabel = (type: string | null | undefined) =>
  BILLGO_PACKAGE_TYPES.find(option => option.value === type)?.label || "Internet";

export const getBillGoPackagePrice = (pkg: Pick<BillGoPackage, "monthly_price"> | null | undefined) =>
  Number(pkg?.monthly_price || 0);
