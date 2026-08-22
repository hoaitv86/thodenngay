"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Edit, Package, Plus, Search, Trash2, X } from "lucide-react";
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

type WorkerProfileCache = {
  worker?: { id?: string | null } | null;
  storeId?: string | null;
};

export default function WorkerInventoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editingCategory, setEditingCategory] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

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

  const categories = useMemo(
    () => [...new Set(products.map(product => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")),
    [products]
  );

  const categoryCounts = useMemo(
    () => categories.map(item => ({
      name: item,
      count: products.filter(product => product.category === item).length,
    })),
    [categories, products]
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
          <h1 className="text-2xl font-extrabold text-on-surface">Danh sách sản phẩm</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Quản lý vật tư, linh kiện và hàng tồn riêng của thợ. Kho hàng chỉ phục vụ bán hàng cho thợ.
          </p>
        </div>
        <Link href="/worker/inventory/new" className="btn-primary !w-auto !px-4">
          <Plus size={18} />
          Thêm sản phẩm
        </Link>
      </header>

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

      <section className="my-4 grid gap-3 rounded-lg border border-outline-variant/30 bg-white p-3 shadow-sm md:grid-cols-[1fr_240px]">
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

      {categoryCounts.length > 0 && (
        <section className="mb-4 rounded-lg border border-outline-variant/30 bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase text-on-surface-variant">Danh mục đang dùng</p>
              <p className="text-sm text-on-surface-variant">Sửa tên danh mục nếu nhập nhầm, sản phẩm cùng danh mục sẽ đổi theo.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryCounts.map(item => (
              <div key={item.name} className="flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-2.5 py-2">
                {editingCategory === item.name ? (
                  <>
                    <input
                      value={categoryDraft}
                      onChange={event => setCategoryDraft(event.target.value)}
                      className="h-8 w-40 rounded-md border border-outline-variant/60 bg-white px-2 text-sm font-bold outline-none focus:border-primary"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={saveCategoryName}
                      disabled={categorySaving}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-success text-white disabled:opacity-50"
                      title="Lưu danh mục"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditCategory}
                      disabled={categorySaving}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant/50 text-on-surface-variant disabled:opacity-50"
                      title="Hủy sửa"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-extrabold text-on-surface">{item.name}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">{item.count}</span>
                    <button
                      type="button"
                      onClick={() => startEditCategory(item.name)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant/50 text-primary transition-colors hover:bg-primary-fixed"
                      title="Sửa tên danh mục"
                    >
                      <Edit size={15} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
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
            {filteredProducts.map(product => (
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
    </div>
  );
}
