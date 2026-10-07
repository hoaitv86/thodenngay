"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Check, Edit, Package, Plus, Search, ShieldCheck, ShoppingCart, Trash2, Truck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCachedDataset, logOfflineDebug, setCachedDataset } from "@/lib/offline/cache";
import { makeWorkerDatasetKey, makeWorkerUserDatasetKey, type WorkerOfflineScope } from "@/lib/offline/worker-data";
import { resolveWorkerUnitScope } from "@/lib/worker-unit-server";
import {
  formatInventoryCurrency,
  isMissingWorkerInventorySchemaError,
  missingWorkerInventorySchemaMessage,
  type InventoryProduct,
} from "@/lib/worker-inventory";
import {
  formatSalesCurrency,
  getWarrantyStatusLabel,
  type WorkerSalesOrder,
} from "@/lib/worker-sales";

const INVENTORY_PAGE_SIZE = 20;
const WORKER_SALES_ORDER_LIMIT = 100;

type InventorySection = "stock" | "receiving" | "sales" | "warranty" | "suppliers";

const inventorySections: Array<{ id: InventorySection; label: string; description: string }> = [
  { id: "stock", label: "Tồn kho", description: "Sản phẩm, tồn hiện tại và giá vốn." },
  { id: "receiving", label: "Nhập hàng", description: "Khung cho phiếu nhập và điều chỉnh tồn." },
  { id: "sales", label: "Bán hàng", description: "Tạo đơn bán và xem lịch sử bán từ kho." },
  { id: "warranty", label: "Bảo hành", description: "Khung theo dõi bảo hành sản phẩm đã bán." },
  { id: "suppliers", label: "Nhà cung cấp", description: "Khung lưu nguồn hàng và thông tin liên hệ." },
];

function getInitialSection(value: string | null): InventorySection {
  return inventorySections.some(section => section.id === value) ? value as InventorySection : "stock";
}

type WorkerProfileCache = {
  worker?: { id?: string | null } | null;
  storeId?: string | null;
};

export default function WorkerInventoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [activeSection, setActiveSection] = useState<InventorySection>("stock");
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [orders, setOrders] = useState<WorkerSalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [ordersMessage, setOrdersMessage] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visibleProductCount, setVisibleProductCount] = useState(INVENTORY_PAGE_SIZE);
  const [salesQuery, setSalesQuery] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveSection(getInitialSection(new URLSearchParams(window.location.search).get("section")));
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const cachedProfile = await getCachedDataset<WorkerProfileCache>(makeWorkerUserDatasetKey("worker-profile", user.id));
    const cachedScope: WorkerOfflineScope | null = cachedProfile?.data.worker?.id
      ? { userId: user.id, workerId: cachedProfile.data.worker.id, storeId: cachedProfile.data.storeId || null }
      : null;
    const cachedProducts = cachedScope ? await getCachedDataset<InventoryProduct[]>(makeWorkerDatasetKey("inventory", cachedScope)) : null;

    if (cachedProducts) {
      setProducts(cachedProducts.data);
      setWorkerId(cachedScope?.workerId || "");
      logOfflineDebug("hydrated from cache", { dataset: "inventory", cacheKey: cachedProducts.key, recordCount: cachedProducts.data.length });
      setLoading(false);
    }

    if (typeof window !== "undefined" && !window.navigator.onLine) {
      logOfflineDebug("server fetch skipped", { dataset: "inventory", userId: user.id, reason: "offline" });
      return;
    }

    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (workerError || !worker) {
      if (cachedProducts) {
        logOfflineDebug("server fetch error", { dataset: "worker-profile", userId: user.id, reason: workerError?.message || "missing-worker" });
        return;
      }
      setMessage("Không tìm thấy hồ sơ thợ.");
      setWorkerId("");
      setProducts([]);
      setLoading(false);
      return;
    }

    const scope = await resolveWorkerUnitScope(supabase, user.id, worker.id);
    const scopedWorkerId = scope?.scopedWorkerId || worker.id;
    const storeId = scope?.unitId || cachedProfile?.data.storeId || null;
    const cacheScope: WorkerOfflineScope = { userId: user.id, workerId: scopedWorkerId, storeId };
    setWorkerId(scopedWorkerId);

    const { data, error } = await supabase
      .from("worker_inventory_products")
      .select("*")
      .eq("worker_id", scopedWorkerId)
      .order("updated_at", { ascending: false });

    if (error) {
      if (cachedProducts) {
        logOfflineDebug("skipped cache overwrite", { dataset: "inventory", cacheKey: makeWorkerDatasetKey("inventory", cacheScope), reason: error.message });
        return;
      }
      setMessage(isMissingWorkerInventorySchemaError(error)
        ? missingWorkerInventorySchemaMessage
        : "Không thể tải danh sách sản phẩm: " + error.message);
      setProducts([]);
    } else {
      const nextProducts = (data || []) as InventoryProduct[];
      setProducts(nextProducts);
      await Promise.allSettled([
        setCachedDataset(makeWorkerDatasetKey("inventory", cacheScope), nextProducts, { dataset: "inventory", userId: user.id, workerId: scopedWorkerId, storeId }),
        scopedWorkerId !== worker.id
          ? setCachedDataset(makeWorkerDatasetKey("inventory", { userId: user.id, workerId: worker.id, storeId }), nextProducts, { dataset: "inventory", userId: user.id, workerId: worker.id, storeId, aliasFor: scopedWorkerId })
          : Promise.resolve(),
      ]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchProducts(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchProducts]);

  const fetchSalesOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    const cachedProfile = await getCachedDataset<WorkerProfileCache>(makeWorkerUserDatasetKey("worker-profile", user.id));
    const cachedScope: WorkerOfflineScope | null = cachedProfile?.data.worker?.id
      ? { userId: user.id, workerId: cachedProfile.data.worker.id, storeId: cachedProfile.data.storeId || null }
      : null;
    const cachedOrders = cachedScope ? await getCachedDataset<WorkerSalesOrder[]>(makeWorkerDatasetKey("sales", cachedScope)) : null;

    if (cachedOrders) {
      setOrders(cachedOrders.data);
      logOfflineDebug("hydrated from cache", { dataset: "sales", cacheKey: cachedOrders.key, recordCount: cachedOrders.data.length });
      setOrdersLoading(false);
    }

    if (typeof window !== "undefined" && !window.navigator.onLine) {
      logOfflineDebug("server fetch skipped", { dataset: "sales", userId: user.id, reason: "offline" });
      return;
    }

    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (workerError || !worker) {
      if (cachedOrders) return;
      setOrdersMessage("Không tìm thấy hồ sơ thợ.");
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    const scope = await resolveWorkerUnitScope(supabase, user.id, worker.id);
    const scopedWorkerId = scope?.scopedWorkerId || worker.id;
    const storeId = scope?.unitId || cachedProfile?.data.storeId || null;
    const cacheScope: WorkerOfflineScope = { userId: user.id, workerId: scopedWorkerId, storeId };

    const { data, error } = await supabase
      .from("worker_sales_orders")
      .select(`
        id,
        worker_id,
        customer_id,
        sale_code,
        status,
        total_amount,
        note,
        sold_at,
        customer:profiles!customer_id(full_name, phone, address),
        items:worker_sales_order_items(id, order_id, product_id, product_name, product_sku, category, unit, quantity, unit_price, line_total),
        warranties:worker_product_warranties(id, product_name, product_sku, warranty_end, status)
      `)
      .eq("worker_id", scopedWorkerId)
      .order("sold_at", { ascending: false })
      .range(0, WORKER_SALES_ORDER_LIMIT - 1);

    if (error) {
      if (cachedOrders) return;
      setOrdersMessage(isMissingWorkerInventorySchemaError(error)
        ? missingWorkerInventorySchemaMessage
        : "Không thể tải lịch sử bán hàng: " + error.message);
      setOrders([]);
    } else {
      const nextOrders = (data || []) as WorkerSalesOrder[];
      setOrders(nextOrders);
      await Promise.allSettled([
        setCachedDataset(makeWorkerDatasetKey("sales", cacheScope), nextOrders, { dataset: "sales", userId: user.id, workerId: scopedWorkerId, storeId }),
        scopedWorkerId !== worker.id
          ? setCachedDataset(makeWorkerDatasetKey("sales", { userId: user.id, workerId: worker.id, storeId }), nextOrders, { dataset: "sales", userId: user.id, workerId: worker.id, storeId, aliasFor: scopedWorkerId })
          : Promise.resolve(),
      ]);
    }
    setOrdersLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchSalesOrders(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchSalesOrders]);

  const categories = useMemo(
    () => [...new Set(products.map(product => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return products.filter(product => {
      const matchesCategory = category === "all" || product.category === category;
      const haystack = [
        product.name,
        product.sku,
        product.category,
        product.unit,
        product.note,
      ].filter(Boolean).join(" ").toLocaleLowerCase("vi");
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [category, products, query]);

  useEffect(() => {
    setVisibleProductCount(INVENTORY_PAGE_SIZE);
  }, [category, query]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductCount),
    [filteredProducts, visibleProductCount]
  );

  const filteredOrders = useMemo(() => {
    const normalized = salesQuery.trim().toLocaleLowerCase("vi");
    if (!normalized) return orders;

    return orders.filter(order => {
      const haystack = [
        order.sale_code,
        order.customer?.full_name,
        order.customer?.phone,
        order.customer?.address,
        order.note,
        ...(order.items || []).map(item => item.product_name + " " + item.product_sku + " " + item.category),
      ].filter(Boolean).join(" ").toLocaleLowerCase("vi");

      return haystack.includes(normalized);
    });
  }, [orders, salesQuery]);

  const stats = useMemo(() => products.reduce(
    (acc, product) => {
      acc.totalProducts += 1;
      acc.totalUnits += Number(product.stock_quantity || 0);
      acc.stockValue += Number(product.stock_quantity || 0) * Number(product.purchase_price || 0);
      if (Number(product.stock_quantity || 0) <= 0) acc.outOfStock += 1;
      return acc;
    },
    { totalProducts: 0, totalUnits: 0, stockValue: 0, outOfStock: 0 }
  ), [products]);

  const salesStats = useMemo(() => orders.reduce(
    (acc, order) => {
      acc.totalOrders += 1;
      acc.totalRevenue += Number(order.total_amount || 0);
      acc.totalItems += (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      return acc;
    },
    { totalOrders: 0, totalRevenue: 0, totalItems: 0 }
  ), [orders]);

  const warrantyCount = useMemo(
    () => orders.reduce((sum, order) => sum + (order.warranties || []).length, 0),
    [orders]
  );

  const startEditCategory = (name: string) => {
    setEditingCategory(name);
    setCategoryDraft(name);
    setMessage("");
  };

  const cancelEditCategory = () => {
    setEditingCategory("");
    setCategoryDraft("");
  };

  const saveCategoryName = async () => {
    const oldName = editingCategory.trim();
    const nextName = categoryDraft.trim();
    if (!oldName) return;
    if (!nextName) {
      setMessage("Vui lòng nhập tên danh mục.");
      return;
    }
    if (nextName === oldName) {
      cancelEditCategory();
      return;
    }
    if (!workerId) {
      setMessage("Không tìm thấy hồ sơ thợ để cập nhật danh mục.");
      return;
    }

    setCategorySaving(true);
    setMessage("");

    const { error } = await supabase
      .from("worker_inventory_products")
      .update({ category: nextName })
      .eq("worker_id", workerId)
      .eq("category", oldName);

    if (error) {
      setMessage("Không thể sửa danh mục: " + error.message);
      setCategorySaving(false);
      return;
    }

    setProducts(current => current.map(product =>
      product.category === oldName ? { ...product, category: nextName } : product
    ));
    if (category === oldName) setCategory(nextName);
    cancelEditCategory();
    setCategorySaving(false);
  };

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-surface p-4 animate-fade-in lg:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Kho hàng</p>
          <h1 className="text-2xl font-extrabold text-on-surface">Quản lý kho hàng</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Quản lý tồn kho và bán hàng trên cùng một khu vực. Nhập hàng, bảo hành và nhà cung cấp đang giữ khung để hoàn thiện tiếp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/worker/sales/new" className="btn-outline !w-auto !px-4">
            <ShoppingCart size={18} />
            Tạo đơn bán
          </Link>
          <Link href="/worker/inventory/new" className="btn-primary !w-auto !px-4">
            <Plus size={18} />
            Thêm sản phẩm
          </Link>
        </div>
      </header>

      <nav className="mb-4 flex gap-2 overflow-x-auto rounded-lg border border-outline-variant/30 bg-white p-2 shadow-sm" aria-label="Nhóm chức năng kho hàng">
        {inventorySections.map(section => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`min-w-fit rounded-lg px-3 py-2 text-left transition-colors ${isActive ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"}`}
            >
              <span className="block text-sm font-extrabold">{section.label}</span>
              <span className={`mt-0.5 block text-[11px] font-bold ${isActive ? "text-white/80" : "text-on-surface-variant"}`}>{section.description}</span>
            </button>
          );
        })}
      </nav>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Sản phẩm", String(stats.totalProducts)],
          ["Tổng tồn", String(stats.totalUnits)],
          ["Giá trị nhập", formatInventoryCurrency(stats.stockValue)],
          ["Hết hàng", String(stats.outOfStock)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
            <Package size={18} className="text-primary" />
            <p className="mt-3 text-xs font-bold uppercase text-on-surface-variant">{label}</p>
            <p className="mt-1 text-xl font-extrabold text-on-surface">{value}</p>
          </div>
        ))}
      </section>

      {activeSection === "stock" && (<>
      <section className="my-4 grid gap-3 rounded-lg border border-outline-variant/30 bg-white p-3 shadow-sm md:grid-cols-[1fr_240px_auto]">
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="input-field !pl-10"
            placeholder="Tìm theo tên, mã sản phẩm, danh mục, ghi chú..."
          />
        </label>
        <select value={category} onChange={event => setCategory(event.target.value)} className="input-field">
          <option value="all">Tất cả danh mục</option>
          {categories.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </section>

      {editingCategory && (
        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant/30 bg-white p-3 shadow-sm">
          <span className="text-xs font-bold uppercase text-on-surface-variant">Đổi tên danh mục đang chọn</span>
          <input value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)} className="h-10 min-w-52 rounded-md border border-outline-variant/60 bg-white px-3 text-sm font-bold outline-none focus:border-primary" autoFocus />
          <button type="button" onClick={saveCategoryName} disabled={categorySaving} className="flex h-10 w-10 items-center justify-center rounded-md bg-success text-white disabled:opacity-50" title="Lưu danh mục"><Check size={16} /></button>
          <button type="button" onClick={cancelEditCategory} disabled={categorySaving} className="flex h-10 w-10 items-center justify-center rounded-md border border-outline-variant/50 text-on-surface-variant disabled:opacity-50" title="Hủy sửa"><X size={16} /></button>
        </section>
      )}

      {message && (
        <div className="mb-4 rounded-lg border border-error/20 bg-error-container p-3 text-sm font-bold text-error">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant bg-white p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary-fixed text-primary">
            <Package size={28} />
          </div>
          <p className="mt-4 font-bold text-on-surface">Chưa có sản phẩm phù hợp</p>
          <p className="mt-1 text-sm text-on-surface-variant">Thêm sản phẩm đầu tiên hoặc thử thay đổi bộ lọc.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-outline-variant/30 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.8fr_104px] gap-3 border-b border-outline-variant/30 bg-surface-container-low px-4 py-3 text-xs font-bold uppercase text-on-surface-variant">
            <span>Sản phẩm</span>
            <span>Danh mục</span>
            <span>Giá nhập</span>
            <span>Tồn kho</span>
            <span>Giá bán</span>
            <span className="text-right">Thao tác</span>
              </div>
              <div className="divide-y divide-outline-variant/20">
            {visibleProducts.map(product => (
                  <article key={product.id} className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.8fr_104px] items-center gap-3 p-4">
                <div className="min-w-0">
                  <h2 className="truncate font-extrabold text-on-surface">{product.name}</h2>
                  <p className="mt-1 font-mono text-xs font-bold text-primary-container">{product.sku}</p>
                  {product.note && <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant">{product.note}</p>}
                </div>
                <span className="w-fit rounded-full bg-primary-fixed px-2.5 py-1 text-xs font-bold text-primary-container">{product.category}</span>
                <div>
                  <p className="hidden text-xs font-bold uppercase text-on-surface-variant">Giá nhập</p>
                  <p className="font-bold text-on-surface">{formatInventoryCurrency(product.purchase_price)}</p>
                </div>
                <div>
                  <p className="hidden text-xs font-bold uppercase text-on-surface-variant">Tồn kho</p>
                  <p className={`font-extrabold ${Number(product.stock_quantity || 0) <= 0 ? "text-error" : "text-success"}`}>
                    {product.stock_quantity} {product.unit}
                  </p>
                  <p className="text-xs text-on-surface-variant">BH {product.warranty_months} tháng</p>
                </div>
                <div>
                  <p className="hidden text-xs font-bold uppercase text-on-surface-variant">Giá bán</p>
                  <p className="font-bold text-on-surface">{formatInventoryCurrency(product.default_sale_price)}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Link href={`/worker/inventory/${product.id}/edit`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/50 text-primary transition-colors hover:bg-primary-fixed" title="Sửa sản phẩm">
                    <Edit size={17} />
                  </Link>
                  <Link href={`/worker/inventory/${product.id}/delete`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-error/25 text-error transition-colors hover:bg-error-container" title="Xóa sản phẩm">
                    <Trash2 size={17} />
                  </Link>
                </div>
                  </article>
            ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {visibleProductCount < filteredProducts.length && (
        <div className="mt-3 text-center">
          <button type="button" onClick={() => setVisibleProductCount(count => count + INVENTORY_PAGE_SIZE)} className="btn-outline !w-auto !px-4">
            Load thêm sản phẩm ({visibleProducts.length}/{filteredProducts.length})
          </button>
        </div>
      )}

      </>)}

      {activeSection === "sales" && (
        <section className="mt-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {[["Đơn bán", String(salesStats.totalOrders), ShoppingCart], ["Sản phẩm đã bán", String(salesStats.totalItems), Package], ["Doanh thu bán hàng", formatSalesCurrency(salesStats.totalRevenue), ShoppingCart]].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
                <Icon size={18} className="text-primary" />
                <p className="mt-3 text-xs font-bold uppercase text-on-surface-variant">{label as string}</p>
                <p className="mt-1 text-xl font-extrabold text-on-surface">{value as string}</p>
              </div>
            ))}
          </div>
          <div className="mb-4 grid gap-3 rounded-lg border border-outline-variant/30 bg-white p-3 shadow-sm md:grid-cols-[1fr_auto]">
            <label className="relative block"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" /><input value={salesQuery} onChange={event => setSalesQuery(event.target.value)} className="input-field !pl-10" placeholder="Tìm mã đơn, khách hàng, sản phẩm..." /></label>
            <Link href="/worker/sales/new" className="btn-primary !w-auto !px-4"><Plus size={18} />Tạo đơn bán</Link>
          </div>
          {ordersMessage && <div className="mb-4 rounded-lg border border-error/20 bg-error-container p-3 text-sm font-bold text-error">{ordersMessage}</div>}
          {ordersLoading ? <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" /></div> : filteredOrders.length === 0 ? <div className="rounded-lg border border-dashed border-outline-variant bg-white p-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary-fixed text-primary"><ShoppingCart size={28} /></div><p className="mt-4 font-bold text-on-surface">Chưa có đơn bán phù hợp</p><p className="mt-1 text-sm text-on-surface-variant">Tạo đơn bán đầu tiên từ sản phẩm trong kho hàng.</p></div> : (
            <div className="space-y-3">
              {filteredOrders.map(order => (
                <article key={order.id} className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-mono text-sm font-extrabold text-primary-container">{order.sale_code}</h2><span className="rounded-full bg-success-container px-2.5 py-1 text-xs font-bold text-success">Đã lưu</span></div><p className="mt-2 font-bold text-on-surface">{order.customer?.full_name || "Khách hàng"}</p><p className="text-sm text-on-surface-variant">{order.customer?.phone || "Chưa có số điện thoại"} · {new Date(order.sold_at).toLocaleString("vi-VN")}</p></div><p className="text-xl font-extrabold text-primary">{formatSalesCurrency(order.total_amount)}</p></div>
                  <div className="mt-3 overflow-hidden rounded-lg border border-outline-variant/30">{(order.items || []).map(item => <div key={item.id} className="grid gap-2 border-b border-outline-variant/20 px-3 py-2 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-bold text-on-surface">{item.product_name}</p><p className="font-mono text-xs text-on-surface-variant">{item.product_sku}</p></div><p className="text-sm font-bold text-on-surface-variant">{item.quantity} {item.unit} x {formatSalesCurrency(item.unit_price)}</p><p className="text-sm font-extrabold text-on-surface">{formatSalesCurrency(item.line_total)}</p></div>)}</div>
                  {order.warranties && order.warranties.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{order.warranties.map(warranty => <span key={warranty.id} className="rounded-full bg-success-container px-2.5 py-1 text-xs font-bold text-success">{warranty.product_name}: {getWarrantyStatusLabel(warranty)}</span>)}</div>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeSection !== "stock" && activeSection !== "sales" && <section className="mt-4 rounded-lg border border-dashed border-outline-variant bg-white p-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary-fixed text-primary">{activeSection === "receiving" ? <Truck size={28} /> : activeSection === "warranty" ? <ShieldCheck size={28} /> : <Boxes size={28} />}</div><p className="mt-4 font-bold text-on-surface">{inventorySections.find(section => section.id === activeSection)?.label}</p><p className="mt-1 text-sm text-on-surface-variant">Đã tạo khung trong Kho hàng. Phiên này ưu tiên hoàn thiện Tồn kho và gộp Bán hàng.</p></section>}
    </div>
  );
}
