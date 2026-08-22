"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, Plus, Search, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCachedDataset, logOfflineDebug, setCachedDataset } from "@/lib/offline/cache";
import { makeWorkerDatasetKey, makeWorkerUserDatasetKey, type WorkerOfflineScope } from "@/lib/offline/worker-data";
import { resolveWorkerUnitScope } from "@/lib/worker-unit-server";
import {
  isMissingWorkerInventorySchemaError,
  missingWorkerInventorySchemaMessage,
} from "@/lib/worker-inventory";
import {
  formatSalesCurrency,
  getWarrantyStatusLabel,
  type WorkerSalesOrder,
} from "@/lib/worker-sales";

const WORKER_SALES_ORDER_LIMIT = 100;

type WorkerProfileCache = {
  worker?: { id?: string | null } | null;
  storeId?: string | null;
};

export default function WorkerSalesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<WorkerSalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const fetchSalesOrders = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setOrders([]);
      setLoading(false);
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
      setLoading(false);
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
      if (cachedOrders) {
        logOfflineDebug("server fetch error", { dataset: "worker-profile", userId: user.id, reason: workerError?.message || "missing-worker" });
        return;
      }
      setMessage("Không tìm thấy hồ sơ thợ.");
      setOrders([]);
      setLoading(false);
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
      if (cachedOrders) {
        logOfflineDebug("skipped cache overwrite", { dataset: "sales", cacheKey: makeWorkerDatasetKey("sales", cacheScope), reason: error.message });
        return;
      }
      setMessage(isMissingWorkerInventorySchemaError(error)
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
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchSalesOrders(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchSalesOrders]);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    if (!normalized) return orders;

    return orders.filter(order => {
      const haystack = [
        order.sale_code,
        order.customer?.full_name,
        order.customer?.phone,
        order.customer?.address,
        order.note,
        ...(order.items || []).map(item => `${item.product_name} ${item.product_sku} ${item.category}`),
      ].filter(Boolean).join(" ").toLocaleLowerCase("vi");

      return haystack.includes(normalized);
    });
  }, [orders, query]);

  const stats = useMemo(() => orders.reduce(
    (acc, order) => {
      acc.totalOrders += 1;
      acc.totalRevenue += Number(order.total_amount || 0);
      acc.totalItems += (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      return acc;
    },
    { totalOrders: 0, totalRevenue: 0, totalItems: 0 }
  ), [orders]);

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-surface p-4 animate-fade-in lg:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Bán hàng</p>
          <h1 className="text-2xl font-extrabold text-on-surface">Lịch sử đơn bán</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Theo dõi các đơn bán từ kho hàng riêng của thợ.
          </p>
        </div>
        <Link href="/worker/sales/new" className="btn-primary !w-auto !px-4">
          <Plus size={18} />
          Tạo đơn bán
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Đơn bán", String(stats.totalOrders), ShoppingCart],
          ["Sản phẩm đã bán", String(stats.totalItems), Package],
          ["Doanh thu bán hàng", formatSalesCurrency(stats.totalRevenue), ShoppingCart],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
            <Icon size={18} className="text-primary" />
            <p className="mt-3 text-xs font-bold uppercase text-on-surface-variant">{label as string}</p>
            <p className="mt-1 text-xl font-extrabold text-on-surface">{value as string}</p>
          </div>
        ))}
      </section>

      <label className="relative my-4 block rounded-lg border border-outline-variant/30 bg-white p-3 shadow-sm">
        <Search size={18} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          className="input-field !pl-10"
          placeholder="Tìm mã đơn, khách hàng, sản phẩm..."
        />
      </label>

      {message && (
        <div className="mb-4 rounded-lg border border-error/20 bg-error-container p-3 text-sm font-bold text-error">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant bg-white p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary-fixed text-primary">
            <ShoppingCart size={28} />
          </div>
          <p className="mt-4 font-bold text-on-surface">Chưa có đơn bán phù hợp</p>
          <p className="mt-1 text-sm text-on-surface-variant">Tạo đơn bán đầu tiên từ sản phẩm trong kho hàng.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <article key={order.id} className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-sm font-extrabold text-primary-container">{order.sale_code}</h2>
                    <span className="rounded-full bg-success-container px-2.5 py-1 text-xs font-bold text-success">Đã lưu</span>
                  </div>
                  <p className="mt-2 font-bold text-on-surface">{order.customer?.full_name || "Khách hàng"}</p>
                  <p className="text-sm text-on-surface-variant">
                    {order.customer?.phone || "Chưa có số điện thoại"} · {new Date(order.sold_at).toLocaleString("vi-VN")}
                  </p>
                </div>
                <p className="text-xl font-extrabold text-primary">{formatSalesCurrency(order.total_amount)}</p>
              </div>

              <div className="mt-3 overflow-hidden rounded-lg border border-outline-variant/30">
                {(order.items || []).map(item => (
                  <div key={item.id} className="grid gap-2 border-b border-outline-variant/20 px-3 py-2 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-on-surface">{item.product_name}</p>
                      <p className="font-mono text-xs text-on-surface-variant">{item.product_sku}</p>
                    </div>
                    <p className="text-sm font-bold text-on-surface-variant">{item.quantity} {item.unit} x {formatSalesCurrency(item.unit_price)}</p>
                    <p className="text-sm font-extrabold text-on-surface">{formatSalesCurrency(item.line_total)}</p>
                  </div>
                ))}
              </div>

              {order.note && (
                <p className="mt-3 rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">{order.note}</p>
              )}

              {order.warranties && order.warranties.length > 0 && (
                <div className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
                  <p className="text-xs font-bold uppercase text-on-surface-variant">Bảo hành</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {order.warranties.map(warranty => {
                      const label = getWarrantyStatusLabel(warranty);
                      const statusClass = label === "Đã bảo hành"
                        ? "bg-primary-fixed text-primary-container"
                        : label === "Còn bảo hành"
                          ? "bg-success-container text-success"
                          : "bg-error-container text-error";
                      return (
                        <span key={warranty.id} className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>
                          {warranty.product_name}: {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
