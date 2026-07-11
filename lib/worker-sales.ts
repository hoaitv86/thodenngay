import { formatInventoryCurrency, type InventoryProduct } from "./worker-inventory";

export type WorkerSalesCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
};

export type WorkerSalesOrderItem = {
  id: string;
  order_id: string;
  product_id?: string | null;
  product_name: string;
  product_sku: string;
  category: string;
  unit: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
};

export type WorkerSalesOrder = {
  id: string;
  worker_id: string;
  customer_id: string;
  sale_code: string;
  status: string;
  total_amount: number | string;
  note?: string | null;
  sold_at: string;
  customer?: { full_name?: string | null; phone?: string | null; address?: string | null } | null;
  items?: WorkerSalesOrderItem[] | null;
  warranties?: WorkerProductWarranty[] | null;
};

export type WorkerProductWarranty = {
  id: string;
  product_name: string;
  product_sku: string;
  warranty_end: string;
  status: string;
};

export type SalesDraftItem = {
  draftId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

export type SalesOrderRpcItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export const formatSalesCurrency = formatInventoryCurrency;

export function createEmptySalesDraftItem() {
  return {
    draftId: crypto.randomUUID(),
    productId: "",
    quantity: "1",
    unitPrice: "",
  };
}

export function getDraftProduct(item: SalesDraftItem, products: InventoryProduct[]) {
  return products.find(product => product.id === item.productId) || null;
}

export function getDraftLineTotal(item: SalesDraftItem) {
  return Number(item.quantity || 0) * Number(item.unitPrice || 0);
}

export function getSalesDraftTotal(items: SalesDraftItem[]) {
  return items.reduce((sum, item) => sum + getDraftLineTotal(item), 0);
}

export function buildSalesRpcItems(items: SalesDraftItem[]): SalesOrderRpcItem[] {
  return items.map(item => ({
    productId: item.productId,
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unitPrice || 0),
  }));
}

export function getWarrantyStatusLabel(warranty: Pick<WorkerProductWarranty, "status" | "warranty_end">) {
  if (warranty.status === "serviced") return "Đã bảo hành";
  if (warranty.status === "active" && new Date(warranty.warranty_end) >= new Date(new Date().toISOString().slice(0, 10))) {
    return "Còn bảo hành";
  }
  return "Hết bảo hành";
}

export function validateSalesDraft(customerId: string, items: SalesDraftItem[], products: InventoryProduct[]) {
  if (!customerId) return "Vui lòng chọn khách hàng.";
  if (items.length === 0) return "Vui lòng chọn ít nhất một sản phẩm.";

  const selectedProductIds = new Set<string>();

  for (const item of items) {
    if (!item.productId) return "Mỗi dòng hàng cần chọn sản phẩm.";
    if (selectedProductIds.has(item.productId)) return "Mỗi sản phẩm chỉ nên xuất hiện một lần trong đơn.";
    selectedProductIds.add(item.productId);

    const product = getDraftProduct(item, products);
    if (!product) return "Sản phẩm không tồn tại trong kho.";

    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);

    if (!Number.isInteger(quantity) || quantity <= 0) return "Số lượng phải là số nguyên lớn hơn 0.";
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return "Giá bán phải là số không âm.";
    if (quantity > Number(product.stock_quantity || 0)) return `${product.name} không đủ tồn kho.`;
  }

  return "";
}
