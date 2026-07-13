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
  "Mạng internet",
  "Camera",
  "Máy tính",
  "Máy in",
  "Vật tư điện",
  "Vật tư nước",
  "Thiết bị mạng",
  "Linh kiện điện lạnh",
  "Phụ kiện lắp đặt",
  "Dụng cụ thi công",
];

export const inventoryUnitSuggestions = ["cái", "bộ", "mét", "cuộn", "hộp", "kg", "lít"];

export const missingWorkerInventorySchemaMessage =
  "Kho hàng và bán hàng chưa được khởi tạo trên database. Vui lòng chạy migration kho/bán hàng trước khi sử dụng.";

export function isMissingWorkerInventorySchemaError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message || "";
  return (
    error?.code === "PGRST205" ||
    (
      /worker_inventory_products|worker_sales_orders|worker_sales_order_items/.test(message) &&
      /schema cache|Could not find|does not exist/i.test(message)
    )
  );
}

export const inventoryCurrencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatInventoryCurrency(value: number | string | null | undefined) {
  return inventoryCurrencyFormatter.format(Number(value || 0));
}

function normalizeInventoryProductCodeText(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

const inventoryProductCodeWordAliases: Record<string, string> = {
  wifi: "WF",
};

export function getInventoryProductCodePrefix(productName: string) {
  const words = productName
    .trim()
    .split(/\s+/)
    .map(word => normalizeInventoryProductCodeText(word).replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .map(value => ({
      value,
      normalized: value.toLowerCase(),
      isShortCode: /^[A-Z0-9]{1,3}$/.test(value),
    }));

  return words
    .map((word, index) => {
      if (word.normalized === "hikvision" && words.length === 2 && index === 1) return "HV";
      if (inventoryProductCodeWordAliases[word.normalized]) return inventoryProductCodeWordAliases[word.normalized];
      if (word.isShortCode || /^[0-9]+$/.test(word.value)) return word.value;
      return word.value.charAt(0);
    })
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function formatInventoryProductCode(prefix: string, sequence: number) {
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

export function getNextInventoryProductCode(productName: string, existingSkus: Array<string | null | undefined>) {
  const prefix = getInventoryProductCodePrefix(productName);
  if (!prefix) return "";

  const matcher = new RegExp(`^${prefix}(\\d+)$`, "i");
  const maxSequence = existingSkus.reduce((max, sku) => {
    const match = String(sku || "").trim().toUpperCase().match(matcher);
    if (!match) return max;
    const sequence = Number(match[1]);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return formatInventoryProductCode(prefix, maxSequence + 1);
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
    isRecurringBillGo: false,
    recurringCycle: "monthly",
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
    is_recurring_billgo: false,
    recurring_cycle: "monthly",
    note: values.note.trim() || null,
  };
}

export function validateInventoryProduct(values: InventoryProductFormValues) {
  if (!values.name.trim()) return "Vui lòng nhập tên sản phẩm.";
  if (!values.sku.trim()) return "Vui lòng nhập mã sản phẩm.";
  if (!values.category.trim()) return "Vui lòng nhập danh mục.";
  if (!values.unit.trim()) return "Vui lòng nhập đơn vị tính.";

  const numericFields = [
    ["Giá nhập", values.purchasePrice],
    ["Giá bán mặc định", values.defaultSalePrice],
    ["Số lượng tồn", values.stockQuantity],
    ["Thời gian bảo hành", values.warrantyMonths],
  ] as const;

  for (const [label, value] of numericFields) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return `${label} phải là số không âm.`;
    }
  }

  return "";
}
