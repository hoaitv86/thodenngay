"use client";

import type React from "react";
import Link from "next/link";
import { Save, X } from "lucide-react";
import {
  inventoryCategorySuggestions,
  inventoryUnitSuggestions,
  type InventoryProductFormValues,
} from "@/lib/worker-inventory";

type InventoryProductFormProps = {
  title: string;
  description: string;
  values: InventoryProductFormValues;
  saving: boolean;
  submitLabel: string;
  message?: string;
  onChange: (values: InventoryProductFormValues) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function InventoryProductForm({
  title,
  description,
  values,
  saving,
  submitLabel,
  message,
  onChange,
  onSubmit,
}: InventoryProductFormProps) {
  const updateField = (field: keyof InventoryProductFormValues, value: string) => {
    onChange({ ...values, [field]: value });
  };

  return (
    <form onSubmit={onSubmit} className="min-h-[calc(100dvh-8rem)] bg-surface p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Kho hàng</p>
          <h1 className="text-2xl font-extrabold text-on-surface">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">{description}</p>
        </div>
        <Link href="/worker/inventory" className="btn-outline !w-auto !px-4">
          <X size={18} />
          Hủy
        </Link>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-error/20 bg-error-container p-3 text-sm font-bold text-error">
          {message}
        </div>
      )}

      <section className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm lg:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Tên sản phẩm</span>
            <input required className="input-field" value={values.name} onChange={e => updateField("name", e.target.value)} placeholder="VD: Dây điện Cadivi 2.5" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Mã sản phẩm</span>
            <input required className="input-field uppercase" value={values.sku} onChange={e => updateField("sku", e.target.value)} placeholder="VD: DAY-CAD-25" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Danh mục</span>
            <input required list="inventory-categories" className="input-field" value={values.category} onChange={e => updateField("category", e.target.value)} placeholder="Chọn hoặc nhập danh mục" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Đơn vị tính</span>
            <input required list="inventory-units" className="input-field" value={values.unit} onChange={e => updateField("unit", e.target.value)} placeholder="cái, bộ, mét..." />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Giá nhập</span>
            <input required min="0" type="number" className="input-field" value={values.purchasePrice} onChange={e => updateField("purchasePrice", e.target.value)} placeholder="0" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Giá bán mặc định</span>
            <input required min="0" type="number" className="input-field" value={values.defaultSalePrice} onChange={e => updateField("defaultSalePrice", e.target.value)} placeholder="0" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Số lượng tồn</span>
            <input required min="0" step="1" type="number" className="input-field" value={values.stockQuantity} onChange={e => updateField("stockQuantity", e.target.value)} placeholder="0" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Bảo hành (tháng)</span>
            <input required min="0" step="1" type="number" className="input-field" value={values.warrantyMonths} onChange={e => updateField("warrantyMonths", e.target.value)} placeholder="0" />
          </label>
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={values.isRecurringBillGo}
                onChange={e => onChange({ ...values, isRecurringBillGo: e.target.checked })}
                className="mt-1 h-5 w-5"
              />
              <span>
                <span className="block text-xs font-bold uppercase text-on-surface-variant">Thu tiền định kỳ</span>
                <span className="mt-1 block text-sm text-on-surface-variant">Cho phép tạo lịch thu BillGo sau khi bán sản phẩm này.</span>
              </span>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Chu kỳ BillGo</span>
            <select
              className="input-field"
              value={values.recurringCycle}
              onChange={e => updateField("recurringCycle", e.target.value)}
              disabled={!values.isRecurringBillGo}
            >
              <option value="monthly">Hàng tháng</option>
              <option value="three_months">3 tháng</option>
              <option value="six_months">6 tháng</option>
              <option value="yearly">Hàng năm</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Ghi chú</span>
            <textarea className="input-field min-h-28 resize-y" value={values.note} onChange={e => updateField("note", e.target.value)} placeholder="Thông tin nhà cung cấp, vị trí cất giữ, lưu ý lắp đặt..." />
          </label>
        </div>

        <datalist id="inventory-categories">
          {inventoryCategorySuggestions.map(category => <option key={category} value={category} />)}
        </datalist>
        <datalist id="inventory-units">
          {inventoryUnitSuggestions.map(unit => <option key={unit} value={unit} />)}
        </datalist>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/worker/inventory" className="btn-outline">Hủy</Link>
          <button disabled={saving} className="btn-primary">
            <Save size={18} />
            {saving ? "Đang lưu..." : submitLabel}
          </button>
        </div>
      </section>
    </form>
  );
}
