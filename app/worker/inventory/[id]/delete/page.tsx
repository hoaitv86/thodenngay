"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCachedDataset, logOfflineDebug } from "@/lib/offline/cache";
import { isBrowserOffline, makeWorkerDatasetKey, makeWorkerUserDatasetKey, type WorkerOfflineScope } from "@/lib/offline/worker-data";
import { findCachedWorkerRecordById } from "@/lib/offline/worker-detail-cache";
import {
  formatInventoryCurrency,
  type InventoryProduct,
} from "@/lib/worker-inventory";

type WorkerProfileCache = {
  worker?: { id?: string | null } | null;
  storeId?: string | null;
};

export default function DeleteInventoryProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [product, setProduct] = useState<InventoryProduct | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage(isBrowserOffline() ? "Chưa có dữ liệu offline cho mục này" : "Bạn chưa đăng nhập.");
      setLoading(false);
      return;
    }

    const cachedProfile = await getCachedDataset<WorkerProfileCache>(makeWorkerUserDatasetKey("worker-profile", user.id));
    const cachedScope: WorkerOfflineScope | null = cachedProfile?.data.worker?.id
      ? { userId: user.id, workerId: cachedProfile.data.worker.id, storeId: cachedProfile.data.storeId || null }
      : null;

    if (isBrowserOffline()) {
      const cachedProductResult = await findCachedWorkerRecordById<InventoryProduct>({
        dataset: "inventory",
        userId: user.id,
        recordId: id,
        scopes: cachedScope ? [cachedScope] : [],
        variants: [null],
      });
      const cachedProduct = cachedProductResult?.record || null;
      if (cachedProduct) {
        const cachedWorkerId = typeof cachedProductResult?.dataset.meta?.workerId === "string" ? cachedProductResult.dataset.meta.workerId : cachedScope?.workerId || "";
        setWorkerId(cachedWorkerId);
        setProduct(cachedProduct);
        logOfflineDebug("hydrated from cache", { dataset: "inventory", cacheKey: cachedProductResult?.cacheKey || null, recordCount: 1, route: `/worker/inventory/${id}/delete` });
      } else {
        setMessage("Chưa có dữ liệu offline cho mục này");
        logOfflineDebug("dataset load", { dataset: "inventory", cacheKey: cachedScope ? makeWorkerDatasetKey("inventory", cachedScope) : null, snapshotFound: false, route: `/worker/inventory/${id}/delete` });
      }
      logOfflineDebug("server fetch skipped", { dataset: "inventory", userId: user.id, reason: "offline", route: `/worker/inventory/${id}/delete` });
      setLoading(false);
      return;
    }

    const { data: worker } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!worker) {
      setMessage("Không tìm thấy hồ sơ thợ.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("worker_inventory_products")
      .select("*")
      .eq("worker_id", worker.id)
      .eq("id", id)
      .single();

    if (error || !data) {
      setMessage(error?.message || "Không tìm thấy sản phẩm.");
    } else {
      setWorkerId(worker.id);
      setProduct(data as InventoryProduct);
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchProduct(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchProduct]);

  const deleteProduct = async () => {
    if (!product) return;
    setDeleting(true);
    setMessage("");

    const { error } = await supabase
      .from("worker_inventory_products")
      .delete()
      .eq("worker_id", workerId)
      .eq("id", product.id);

    if (error) {
      setMessage(error.message);
      setDeleting(false);
      return;
    }

    router.push("/worker/inventory");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-surface p-4 lg:p-6">
      <div className="mx-auto max-w-2xl rounded-lg border border-outline-variant/30 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-error-container text-error">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-error">Xóa sản phẩm</p>
            <h1 className="mt-1 text-2xl font-extrabold text-on-surface">Xác nhận xóa sản phẩm</h1>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Sản phẩm sẽ bị xóa khỏi kho riêng của thợ. Thao tác này chỉ ảnh hưởng dữ liệu kho hàng.
            </p>
          </div>
        </div>

        {message && (
          <div className="mt-4 rounded-lg border border-error/20 bg-error-container p-3 text-sm font-bold text-error">
            {message}
          </div>
        )}

        {product && (
          <div className="mt-5 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
            <h2 className="font-extrabold text-on-surface">{product.name}</h2>
            <p className="mt-1 font-mono text-xs font-bold text-primary-container">{product.sku}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase text-on-surface-variant">Danh mục</p>
                <p className="font-bold text-on-surface">{product.category}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-on-surface-variant">Tồn kho</p>
                <p className="font-bold text-on-surface">{product.stock_quantity} {product.unit}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-on-surface-variant">Giá nhập</p>
                <p className="font-bold text-on-surface">{formatInventoryCurrency(product.purchase_price)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-on-surface-variant">Giá bán</p>
                <p className="font-bold text-on-surface">{formatInventoryCurrency(product.default_sale_price)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/worker/inventory" className="btn-outline">Hủy</Link>
          <button type="button" onClick={() => void deleteProduct()} disabled={!product || deleting} className="btn-primary !bg-error hover:!bg-error">
            <Trash2 size={18} />
            {deleting ? "Đang xóa..." : "Xóa sản phẩm"}
          </button>
        </div>
      </div>
    </div>
  );
}
