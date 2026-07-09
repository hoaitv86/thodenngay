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
      setMessage("Ban chua dang nhap.");
      setSaving(false);
      return;
    }

    const { data: worker } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!worker) {
      setMessage("Khong tim thay ho so tho.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("worker_inventory_products")
      .insert(buildInventoryProductPayload(values, worker.id));

    if (error) {
      setMessage(error.code === "23505" ? "Ma san pham nay da ton tai trong kho." : error.message);
      setSaving(false);
      return;
    }

    router.push("/worker/inventory");
    router.refresh();
  };

  return (
    <InventoryProductForm
      title="Them san pham"
      description="Tao san pham kho rieng cua tho de theo doi gia nhap, gia ban, ton kho va bao hanh mac dinh."
      values={values}
      saving={saving}
      submitLabel="Them san pham"
      message={message}
      onChange={setValues}
      onSubmit={handleSubmit}
    />
  );
}
