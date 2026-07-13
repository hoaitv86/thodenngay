"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buildInventoryProductPayload,
  emptyInventoryProductForm,
  getInventoryCategorySuggestionsForSpecialties,
  getInventoryProductCodePrefix,
  getNextInventoryProductCode,
  validateInventoryProduct,
  type InventoryProductFormValues,
} from "@/lib/worker-inventory";
import { InventoryProductForm } from "../InventoryProductForm";

export default function NewInventoryProductPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [values, setValues] = useState<InventoryProductFormValues>(emptyInventoryProductForm);
  const [workerId, setWorkerId] = useState("");
  const [customSku, setCustomSku] = useState(false);
  const [skuLoading, setSkuLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [categorySuggestions, setCategorySuggestions] = useState(() => getInventoryCategorySuggestionsForSpecialties());

  const fetchWorkerProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { id: "", specialties: [] as string[] };

    const { data: worker } = await supabase
      .from("workers")
      .select("id, specialties")
      .eq("user_id", user.id)
      .single();

    return {
      id: worker?.id || "",
      specialties: Array.isArray(worker?.specialties) ? worker.specialties : [],
    };
  }, [supabase]);

  const fetchNextSku = useCallback(async (productName: string, currentWorkerId: string) => {
    const trimmedName = productName.trim();
    if (!trimmedName || !currentWorkerId) return "";

    const prefix = getInventoryProductCodePrefix(trimmedName);
    if (!prefix) return "";

    const { data, error } = await supabase
      .from("worker_inventory_products")
      .select("sku")
      .eq("worker_id", currentWorkerId)
      .ilike("sku", `${prefix}%`);

    if (error) throw error;
    return getNextInventoryProductCode(trimmedName, (data || []).map(product => product.sku));
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    fetchWorkerProfile().then(worker => {
      if (!cancelled) {
        setWorkerId(worker.id);
        setCategorySuggestions(getInventoryCategorySuggestionsForSpecialties(worker.specialties));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchWorkerProfile]);

  useEffect(() => {
    let cancelled = false;

    async function syncAutoSku() {
      if (customSku) return;
      if (!values.name.trim()) {
        setValues(current => current.sku ? { ...current, sku: "" } : current);
        return;
      }
      if (values.sku.trim()) return;
      if (!workerId) return;

      setSkuLoading(true);
      try {
        const nextSku = await fetchNextSku(values.name, workerId);
        if (!cancelled) {
          setValues(current => current.sku === nextSku ? current : { ...current, sku: nextSku });
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Không thể tạo mã sản phẩm tự động.");
        }
      } finally {
        if (!cancelled) setSkuLoading(false);
      }
    }

    void syncAutoSku();
    return () => {
      cancelled = true;
    };
  }, [customSku, fetchNextSku, values.name, values.sku, workerId]);

  const updateCustomSku = (enabled: boolean) => {
    setCustomSku(enabled);
    if (!enabled && values.name.trim() && workerId) {
      setValues(current => ({ ...current, sku: "" }));
    }
  };

  const regenerateSku = async () => {
    if (!values.name.trim() || !workerId || skuLoading || saving) return;

    setSkuLoading(true);
    setMessage("");
    setCustomSku(false);
    try {
      const nextSku = await fetchNextSku(values.name, workerId);
      setValues(current => ({ ...current, sku: nextSku }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo mã sản phẩm tự động.");
    } finally {
      setSkuLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationValues = !customSku && values.name.trim() && !values.sku.trim()
      ? { ...values, sku: "AUTO" }
      : values;
    const validationMessage = validateInventoryProduct(validationValues);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setSaving(true);
    setMessage("");

    const currentWorker = workerId ? { id: workerId, specialties: [] as string[] } : await fetchWorkerProfile();
    const currentWorkerId = currentWorker.id;
    if (!currentWorkerId) {
      setMessage("Bạn chưa đăng nhập hoặc chưa có hồ sơ thợ.");
      setSaving(false);
      return;
    }
    if (!workerId) {
      setCategorySuggestions(getInventoryCategorySuggestionsForSpecialties(currentWorker.specialties));
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const draftValues = { ...values };
      if (!customSku) {
        try {
          draftValues.sku = attempt === 0 && values.sku.trim()
            ? values.sku.trim()
            : await fetchNextSku(values.name, currentWorkerId);
          setValues(current => ({ ...current, sku: draftValues.sku }));
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Không thể tạo mã sản phẩm tự động.");
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from("worker_inventory_products")
        .insert(buildInventoryProductPayload(draftValues, currentWorkerId));

      if (!error) {
        router.push("/worker/inventory");
        router.refresh();
        return;
      }

      if (error.code !== "23505" || customSku || attempt === 1) {
        setMessage(error.code === "23505"
          ? "Mã sản phẩm này đã tồn tại trong kho. Vui lòng thử lưu lại hoặc nhập mã riêng khác."
          : error.message);
        setSaving(false);
        return;
      }
    }
  };

  return (
    <InventoryProductForm
      title="Thêm sản phẩm"
      description="Tạo sản phẩm kho riêng của thợ để theo dõi giá nhập, giá bán, tồn kho và bảo hành mặc định."
      values={values}
      saving={saving}
      submitLabel="Thêm sản phẩm"
      message={message}
      customSku={customSku}
      skuLoading={skuLoading}
      canRegenerateSku
      skuRegenerateDisabled={!values.name.trim() || skuLoading || saving}
      categorySuggestions={categorySuggestions}
      onCustomSkuChange={updateCustomSku}
      onRegenerateSku={regenerateSku}
      onChange={setValues}
      onSubmit={handleSubmit}
    />
  );
}
