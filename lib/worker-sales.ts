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

export function validateSalesDraft(customerId: string, items: SalesDraftItem[], products: InventoryProduct[]) {
  if (!customerId) return "Vui long chon khach hang.";
  if (items.length === 0) return "Vui long chon it nhat mot san pham.";

  const selectedProductIds = new Set<string>();

  for (const item of items) {
    if (!item.productId) return "Moi dong hang can chon san pham.";
    if (selectedProductIds.has(item.productId)) return "Moi san pham chi nen xuat hien mot lan trong don.";
    selectedProductIds.add(item.productId);

    const product = getDraftProduct(item, products);
    if (!product) return "San pham khong ton tai trong kho.";

    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);

    if (!Number.isInteger(quantity) || quantity <= 0) return "So luong phai la so nguyen lon hon 0.";
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return "Gia ban phai la so khong am.";
    if (quantity > Number(product.stock_quantity || 0)) return `${product.name} khong du ton kho.`;
  }

  return "";
}
