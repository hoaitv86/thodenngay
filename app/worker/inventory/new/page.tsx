"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buildInventoryProductPayload,
  emptyInventoryProductForm,
  validateInventoryProduct,
  type InventoryProductFormValues,
} from "@/lib/worker-inventory";
import { InventoryProductForm } from "../InventoryProductForm";

export default function NewInventoryProductPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [values, setValues] = useState<InventoryProductFormValues>(emptyInventoryProductForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationMessage = validateInventoryProduct(values);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setSaving(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Bạn chưa đăng nhập.");
      setSaving(false);
      return;
    }

    const { data: worker } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!worker) {
      setMessage("Không tìm thấy hồ sơ thợ.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("worker_inventory_products")
      .insert(buildInventoryProductPayload(values, worker.id));

    if (error) {
      setMessage(error.code === "23505" ? "Mã sản phẩm này đã tồn tại trong kho." : error.message);
      setSaving(false);
      return;
    }

    router.push("/worker/inventory");
    router.refresh();
  };

  return (
    <InventoryProductForm
      title="Thêm sản phẩm"
      description="Tạo sản phẩm kho riêng của thợ để theo dõi giá nhập, giá bán, tồn kho và bảo hành mặc định."
      values={values}
      saving={saving}
      submitLabel="Thêm sản phẩm"
      message={message}
      onChange={setValues}
      onSubmit={handleSubmit}
    />
  );
}
