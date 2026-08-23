"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCachedDataset, logOfflineDebug } from "@/lib/offline/cache";
import { isBrowserOffline, makeWorkerDatasetKey, makeWorkerUserDatasetKey, type WorkerOfflineScope } from "@/lib/offline/worker-data";
import { findCachedWorkerRecordById } from "@/lib/offline/worker-detail-cache";
import {
  buildInventoryProductPayload,
  emptyInventoryProductForm,
  getInventoryCategorySuggestionsForSpecialties,
  productToFormValues,
  validateInventoryProduct,
  type InventoryProduct,
  type InventoryProductFormValues,
} from "@/lib/worker-inventory";

const InventoryProductForm = dynamic(() =>
  import("../../InventoryProductForm").then(mod => mod.InventoryProductForm)
);

type WorkerProfileCache = {
  worker?: { id?: string | null; specialties?: unknown } | null;
  storeId?: string | null;
};

export default function EditInventoryProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [values, setValues] = useState<InventoryProductFormValues>(emptyInventoryProductForm);
  const [workerId, setWorkerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customSku, setCustomSku] = useState(false);
  const [message, setMessage] = useState("");
  const [categorySuggestions, setCategorySuggestions] = useState(() => getInventoryCategorySuggestionsForSpecialties());

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
        setCategorySuggestions(getInventoryCategorySuggestionsForSpecialties(
          Array.isArray(cachedProfile?.data.worker?.specialties) ? cachedProfile.data.worker.specialties : []
        ));
        setValues(productToFormValues(cachedProduct));
        logOfflineDebug("hydrated from cache", { dataset: "inventory", cacheKey: cachedProductResult?.cacheKey || null, recordCount: 1, route: `/worker/inventory/${id}/edit` });
      } else {
        setMessage("Chưa có dữ liệu offline cho mục này");
        logOfflineDebug("dataset load", { dataset: "inventory", cacheKey: cachedScope ? makeWorkerDatasetKey("inventory", cachedScope) : null, snapshotFound: false, route: `/worker/inventory/${id}/edit` });
      }
      logOfflineDebug("server fetch skipped", { dataset: "inventory", userId: user.id, reason: "offline", route: `/worker/inventory/${id}/edit` });
      setLoading(false);
      return;
    }

    const { data: worker } = await supabase
      .from("workers")
      .select("id, specialties")
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
      setCategorySuggestions(getInventoryCategorySuggestionsForSpecialties(
        Array.isArray(worker.specialties) ? worker.specialties : []
      ));
      setValues(productToFormValues(data as InventoryProduct));
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchProduct(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchProduct]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationMessage = validateInventoryProduct(values);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("worker_inventory_products")
      .update(buildInventoryProductPayload(values, workerId))
      .eq("worker_id", workerId)
      .eq("id", id);

    if (error) {
      setMessage(error.code === "23505" ? "Mã sản phẩm này đã tồn tại trong kho." : error.message);
      setSaving(false);
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
    <InventoryProductForm
      title="Sửa sản phẩm"
      description="Cập nhật thông tin sản phẩm kho. Thay đổi này chỉ ảnh hưởng dữ liệu kho riêng."
      values={values}
      saving={saving}
      submitLabel="Lưu thay đổi"
      message={message}
      customSku={customSku}
      categorySuggestions={categorySuggestions}
      onCustomSkuChange={setCustomSku}
      onChange={setValues}
      onSubmit={handleSubmit}
    />
  );
}
