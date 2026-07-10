export type InventoryProduct = {
  id: string;
  worker_id: string;
  name: string;
  sku: string;
  category: string;
  purchase_price: number | string;
  default_sale_price: number | string;
  stock_quantity: number;
  unit: string;
  warranty_months: number;
  is_recurring_billgo?: boolean | null;
  recurring_cycle?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type InventoryProductFormValues = {
  name: string;
  sku: string;
  category: string;
  purchasePrice: string;
  defaultSalePrice: string;
  stockQuantity: string;
  unit: string;
  warrantyMonths: string;
  isRecurringBillGo: boolean;
  recurringCycle: string;
  note: string;
};

export const emptyInventoryProductForm: InventoryProductFormValues = {
  name: "",
  sku: "",
  category: "",
  purchasePrice: "",
  defaultSalePrice: "",
  stockQuantity: "",
  unit: "",
  warrantyMonths: "",
  isRecurringBillGo: false,
  recurringCycle: "monthly",
  note: "",
};

export const inventoryCategorySuggestions = [
  "Vat tu dien",
  "Vat tu nuoc",
  "Thiet bi mang",
  "Linh kien dien lanh",
  "Phu kien lap dat",
  "Dung cu thi cong",
];

export const inventoryUnitSuggestions = ["cai", "bo", "met", "cuon", "hop", "kg", "lit"];

export const inventoryCurrencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatInventoryCurrency(value: number | string | null | undefined) {
  return inventoryCurrencyFormatter.format(Number(value || 0));
}

export function productToFormValues(product: InventoryProduct): InventoryProductFormValues {
  return {
    name: product.name || "",
    sku: product.sku || "",
    category: product.category || "",
    purchasePrice: String(Number(product.purchase_price || 0)),
    defaultSalePrice: String(Number(product.default_sale_price || 0)),
    stockQuantity: String(Number(product.stock_quantity || 0)),
    unit: product.unit || "",
    warrantyMonths: String(Number(product.warranty_months || 0)),
    isRecurringBillGo: Boolean(product.is_recurring_billgo),
    recurringCycle: product.recurring_cycle || "monthly",
    note: product.note || "",
  };
}

export function buildInventoryProductPayload(values: InventoryProductFormValues, workerId: string) {
  return {
    worker_id: workerId,
    name: values.name.trim(),
    sku: values.sku.trim().toUpperCase(),
    category: values.category.trim(),
    purchase_price: Number(values.purchasePrice || 0),
    default_sale_price: Number(values.defaultSalePrice || 0),
    stock_quantity: Number(values.stockQuantity || 0),
    unit: values.unit.trim(),
    warranty_months: Number(values.warrantyMonths || 0),
    is_recurring_billgo: values.isRecurringBillGo,
    recurring_cycle: values.isRecurringBillGo ? values.recurringCycle : "monthly",
    note: values.note.trim() || null,
  };
}

export function validateInventoryProduct(values: InventoryProductFormValues) {
  if (!values.name.trim()) return "Vui long nhap ten san pham.";
  if (!values.sku.trim()) return "Vui long nhap ma san pham.";
  if (!values.category.trim()) return "Vui long nhap danh muc.";
  if (!values.unit.trim()) return "Vui long nhap don vi tinh.";

  const numericFields = [
    ["Gia nhap", values.purchasePrice],
    ["Gia ban mac dinh", values.defaultSalePrice],
    ["So luong ton", values.stockQuantity],
    ["Thoi gian bao hanh", values.warrantyMonths],
  ] as const;

  for (const [label, value] of numericFields) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return `${label} phai la so khong am.`;
    }
  }

  return "";
}
