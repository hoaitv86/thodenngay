"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Edit, Plus, Search, Trash2, Truck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  formatInventoryCurrency,
  isMissingWorkerInventorySchemaError,
  missingWorkerInventorySchemaMessage,
  type InventoryProduct,
} from "@/lib/worker-inventory";

type InventorySupplier = {
  id: string;
  worker_id: string;
  name: string;
  phone?: string | null;
};

type ReceiptStatus = "draft" | "confirmed" | "canceled";

type ReceiptSerial = {
  id: string;
  serial_code?: string | null;
  qr_code?: string | null;
  note?: string | null;
};

type ReceiptItem = {
  id: string;
  product_id?: string | null;
  product_name: string;
  product_sku: string;
  category: string;
  unit: string;
  quantity: number;
  unit_cost: number | string;
  line_total: number | string;
  warranty_months: number;
  serials?: ReceiptSerial[] | null;
};

type Receipt = {
  id: string;
  supplier_id?: string | null;
  receipt_code: string;
  status: ReceiptStatus;
  received_at: string;
  total_amount: number | string;
  note?: string | null;
  stock_applied_at?: string | null;
  supplier?: Pick<InventorySupplier, "id" | "name" | "phone"> | Array<Pick<InventorySupplier, "id" | "name" | "phone">> | null;
  items?: ReceiptItem[] | null;
};

type DraftItem = {
  draftId: string;
  mode: "existing" | "new";
  productId: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity: string;
  unitCost: string;
  defaultSalePrice: string;
  warrantyMonths: string;
  note: string;
  serialsText: string;
};

type ReceiptForm = {
  receiptId: string | null;
  supplierId: string;
  receiptCode: string;
  receivedAt: string;
  note: string;
  items: DraftItem[];
};

type ReceivingSectionProps = {
  workerId: string;
  products: InventoryProduct[];
  suppliers: InventorySupplier[];
  onInventoryChanged: () => Promise<void> | void;
};

const RECEIPT_LIMIT = 100;

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function generateReceiptCode() {
  return "NH-" + new Date().toISOString().replace(/[-:T.Z]/g, "").slice(2, 14);
}

function createEmptyItem(): DraftItem {
  return {
    draftId: createDraftId(),
    mode: "existing",
    productId: "",
    name: "",
    sku: "",
    category: "",
    unit: "",
    quantity: "1",
    unitCost: "0",
    defaultSalePrice: "0",
    warrantyMonths: "0",
    note: "",
    serialsText: "",
  };
}

function createEmptyForm(): ReceiptForm {
  return {
    receiptId: null,
    supplierId: "",
    receiptCode: generateReceiptCode(),
    receivedAt: getTodayInputValue(),
    note: "",
    items: [createEmptyItem()],
  };
}

function parseSerials(value: string) {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const [serialCode, qrCode, note] = line.split(/[|,]/).map(part => part.trim());
    return { serialCode: serialCode || "", qrCode: qrCode || serialCode || "", note: note || "" };
  });
}

function getReceiptSupplier(receipt: Receipt) {
  return Array.isArray(receipt.supplier) ? receipt.supplier[0] : receipt.supplier;
}

function statusLabel(status: ReceiptStatus) {
  if (status === "confirmed") return "Đã xác nhận";
  if (status === "canceled") return "Đã hủy";
  return "Nháp";
}

export function ReceivingSection({ workerId, products, suppliers, onInventoryChanged }: ReceivingSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ReceiptForm>(() => createEmptyForm());
  const [saving, setSaving] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const fetchReceipts = useCallback(async () => {
    if (!workerId) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("worker_inventory_receipts")
      .select(`
        id,
        supplier_id,
        receipt_code,
        status,
        received_at,
        total_amount,
        note,
        stock_applied_at,
        supplier:worker_inventory_suppliers(id, name, phone),
        items:worker_inventory_receipt_items(
          id, product_id, product_name, product_sku, category, unit, quantity, unit_cost, line_total, warranty_months,
          serials:worker_inventory_receipt_item_serials(id, serial_code, qr_code, note)
        )
      `)
      .eq("worker_id", workerId)
      .order("received_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(0, RECEIPT_LIMIT - 1);

    if (error) {
      setMessage(isMissingWorkerInventorySchemaError(error)
        ? missingWorkerInventorySchemaMessage
        : "Không thể tải lịch sử nhập hàng: " + error.message);
      setReceipts([]);
    } else {
      const nextReceipts = (data || []) as unknown as Receipt[];
      setReceipts(nextReceipts);
      setSelectedReceiptId(current => current && nextReceipts.some(receipt => receipt.id === current) ? current : nextReceipts[0]?.id || null);
    }

    setLoading(false);
  }, [supabase, workerId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchReceipts(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchReceipts]);

  const filteredReceipts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    if (!normalized) return receipts;

    return receipts.filter(receipt => {
      const haystack = [
        receipt.receipt_code,
        getReceiptSupplier(receipt)?.name,
        getReceiptSupplier(receipt)?.phone,
        receipt.note,
        receipt.status,
        ...(receipt.items || []).map(item => item.product_name + " " + item.product_sku + " " + item.category),
      ].filter(Boolean).join(" ").toLocaleLowerCase("vi");
      return haystack.includes(normalized);
    });
  }, [query, receipts]);

  const selectedReceipt = useMemo(
    () => receipts.find(receipt => receipt.id === selectedReceiptId) || filteredReceipts[0] || null,
    [filteredReceipts, receipts, selectedReceiptId]
  );

  const draftTotal = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0),
    [form.items]
  );

  const historyTotal = useMemo(
    () => filteredReceipts.reduce((sum, receipt) => sum + Number(receipt.total_amount || 0), 0),
    [filteredReceipts]
  );

  const resetForm = () => {
    setForm(createEmptyForm());
    setMessage("");
  };

  const updateForm = (field: keyof Omit<ReceiptForm, "items" | "receiptId">, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const updateItem = (draftId: string, patch: Partial<DraftItem>) => {
    setForm(current => ({
      ...current,
      items: current.items.map(item => item.draftId === draftId ? { ...item, ...patch } : item),
    }));
  };

  const addItem = () => setForm(current => ({ ...current, items: [...current.items, createEmptyItem()] }));

  const removeItem = (draftId: string) => {
    setForm(current => ({
      ...current,
      items: current.items.length <= 1 ? current.items : current.items.filter(item => item.draftId !== draftId),
    }));
  };

  const selectProduct = (draftId: string, productId: string) => {
    const product = products.find(item => item.id === productId);
    updateItem(draftId, {
      productId,
      name: product?.name || "",
      sku: product?.sku || "",
      category: product?.category || "",
      unit: product?.unit || "",
      unitCost: product ? String(Number(product.purchase_price || 0)) : "0",
      defaultSalePrice: product ? String(Number(product.default_sale_price || 0)) : "0",
      warrantyMonths: product ? String(Number(product.warranty_months || 0)) : "0",
    });
  };

  const loadDraft = (receipt: Receipt) => {
    if (receipt.status !== "draft") {
      setMessage("Chỉ phiếu nháp mới được sửa để tránh cộng kho trùng.");
      return;
    }

    setForm({
      receiptId: receipt.id,
      supplierId: receipt.supplier_id || "",
      receiptCode: receipt.receipt_code || generateReceiptCode(),
      receivedAt: receipt.received_at || getTodayInputValue(),
      note: receipt.note || "",
      items: (receipt.items && receipt.items.length > 0 ? receipt.items : []).map(item => ({
        draftId: createDraftId(),
        mode: item.product_id ? "existing" : "new",
        productId: item.product_id || "",
        name: item.product_name || "",
        sku: item.product_sku || "",
        category: item.category || "",
        unit: item.unit || "",
        quantity: String(Number(item.quantity || 0)),
        unitCost: String(Number(item.unit_cost || 0)),
        defaultSalePrice: "0",
        warrantyMonths: String(Number(item.warranty_months || 0)),
        note: "",
        serialsText: (item.serials || []).map(serial => [serial.serial_code, serial.qr_code, serial.note].filter(Boolean).join(" | ")).join("\n"),
      })),
    });
    setMessage("");
  };

  const validateForm = (nextStatus: ReceiptStatus) => {
    if (!workerId) return "Không tìm thấy hồ sơ thợ để nhập kho.";
    if (!form.receiptCode.trim()) return "Vui lòng nhập mã phiếu nhập.";
    if (!form.receivedAt) return "Vui lòng chọn ngày nhập.";
    if (form.items.length === 0) return "Vui lòng thêm ít nhất một mặt hàng.";

    for (const [index, item] of form.items.entries()) {
      const label = `Dòng ${index + 1}`;
      if (item.mode === "existing" && !item.productId) return `${label}: vui lòng chọn sản phẩm có sẵn.`;
      if (item.mode === "new" && (!item.name.trim() || !item.sku.trim() || !item.category.trim() || !item.unit.trim())) {
        return `${label}: sản phẩm mới cần tên, mã, danh mục và đơn vị.`;
      }
      const quantity = Number(item.quantity || 0);
      const unitCost = Number(item.unitCost || 0);
      if (!Number.isInteger(quantity) || quantity <= 0) return `${label}: số lượng phải là số nguyên dương.`;
      if (!Number.isFinite(unitCost) || unitCost < 0) return `${label}: đơn giá nhập không hợp lệ.`;
      if (parseSerials(item.serialsText).length > quantity) return `${label}: số serial/QR không được lớn hơn số lượng.`;
    }

    if (nextStatus === "confirmed" && !window.confirm("Xác nhận phiếu nhập sẽ cộng tồn kho đúng một lần. Tiếp tục?")) {
      return "Đã hủy xác nhận phiếu nhập.";
    }

    return "";
  };

  const buildItemsPayload = () => form.items.map(item => {
    const product = products.find(productItem => productItem.id === item.productId);
    return {
      productId: item.mode === "existing" ? item.productId : null,
      name: item.mode === "existing" ? product?.name || item.name : item.name.trim(),
      sku: (item.mode === "existing" ? product?.sku || item.sku : item.sku).trim().toUpperCase(),
      category: item.mode === "existing" ? product?.category || item.category : item.category.trim(),
      unit: item.mode === "existing" ? product?.unit || item.unit : item.unit.trim(),
      quantity: Number(item.quantity || 0),
      unitCost: Number(item.unitCost || 0),
      defaultSalePrice: Number(item.defaultSalePrice || 0),
      warrantyMonths: Number(item.warrantyMonths || 0),
      note: item.note.trim(),
      serials: parseSerials(item.serialsText),
    };
  });

  const saveReceipt = async (nextStatus: ReceiptStatus) => {
    const validationMessage = validateForm(nextStatus);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase.rpc("save_worker_inventory_receipt", {
      p_worker_id: workerId,
      p_receipt_id: form.receiptId,
      p_supplier_id: form.supplierId || null,
      p_receipt_code: form.receiptCode.trim(),
      p_received_at: form.receivedAt,
      p_note: form.note.trim() || null,
      p_status: nextStatus,
      p_items: buildItemsPayload(),
    });

    if (error) {
      setMessage(isMissingWorkerInventorySchemaError(error)
        ? missingWorkerInventorySchemaMessage
        : "Không thể lưu phiếu nhập: " + error.message);
      setSaving(false);
      return;
    }

    setSelectedReceiptId(typeof data === "string" ? data : null);
    resetForm();
    await Promise.allSettled([fetchReceipts(), onInventoryChanged()]);
    setMessage(nextStatus === "confirmed" ? "Đã xác nhận phiếu nhập và cộng tồn kho." : "Đã lưu phiếu nhập nháp.");
    setSaving(false);
  };

  const cancelReceipt = async (receipt: Receipt) => {
    const confirmedText = receipt.status === "confirmed" ? " Hệ thống sẽ trừ lại tồn kho nếu còn đủ tồn." : "";
    if (!window.confirm(`Hủy phiếu nhập ${receipt.receipt_code}?${confirmedText}`)) return;

    setSaving(true);
    setMessage("");
    const { error } = await supabase.rpc("cancel_worker_inventory_receipt", { p_receipt_id: receipt.id });

    if (error) {
      setMessage(isMissingWorkerInventorySchemaError(error)
        ? missingWorkerInventorySchemaMessage
        : "Không thể hủy phiếu nhập: " + error.message);
      setSaving(false);
      return;
    }

    await Promise.allSettled([fetchReceipts(), onInventoryChanged()]);
    setMessage("Đã hủy phiếu nhập và xử lý tồn kho an toàn.");
    setSaving(false);
  };

  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <div className="space-y-4">
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-primary">Phiếu nhập</p>
              <h2 className="text-lg font-extrabold text-on-surface">{form.receiptId ? "Sửa phiếu nháp" : "Tạo phiếu nhập"}</h2>
            </div>
            <button type="button" onClick={resetForm} disabled={saving} className="btn-outline !w-auto !px-3">
              <X size={16} />
              Làm mới
            </button>
          </div>

          {message && <div className="mb-4 rounded-lg border border-error/20 bg-error-container p-3 text-sm font-bold text-error">{message}</div>}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Nhà cung cấp</span>
              <select value={form.supplierId} onChange={event => updateForm("supplierId", event.target.value)} className="input-field">
                <option value="">Chưa chọn nhà cung cấp</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Ngày nhập</span>
              <input type="date" value={form.receivedAt} onChange={event => updateForm("receivedAt", event.target.value)} className="input-field" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Mã phiếu</span>
              <input value={form.receiptCode} onChange={event => updateForm("receiptCode", event.target.value)} className="input-field font-mono font-bold uppercase" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Ghi chú</span>
              <input value={form.note} onChange={event => updateForm("note", event.target.value)} className="input-field" placeholder="Số hóa đơn, điều kiện giao hàng..." />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          {form.items.map((item, index) => {
            const selectedProduct = products.find(product => product.id === item.productId);
            return (
              <article key={item.draftId} className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-extrabold text-on-surface">Mặt hàng {index + 1}</h3>
                  <div className="flex items-center gap-2">
                    <select value={item.mode} onChange={event => updateItem(item.draftId, { mode: event.target.value as DraftItem["mode"], productId: "", name: "", sku: "", category: "", unit: "" })} className="h-10 rounded-md border border-outline-variant/60 bg-white px-3 text-sm font-bold outline-none focus:border-primary">
                      <option value="existing">Sản phẩm có sẵn</option>
                      <option value="new">Sản phẩm mới</option>
                    </select>
                    <button type="button" onClick={() => removeItem(item.draftId)} disabled={form.items.length <= 1 || saving} className="flex h-10 w-10 items-center justify-center rounded-lg border border-error/25 text-error disabled:opacity-40" title="Xóa dòng">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {item.mode === "existing" ? (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Chọn sản phẩm</span>
                      <select value={item.productId} onChange={event => selectProduct(item.draftId, event.target.value)} className="input-field">
                        <option value="">Chọn sản phẩm trong kho</option>
                        {products.map(product => <option key={product.id} value={product.id}>{product.name} - {product.sku} - tồn {product.stock_quantity} {product.unit}</option>)}
                      </select>
                    </label>
                    <p className="mt-3 rounded-lg bg-surface-container-low p-3 text-sm font-bold text-on-surface-variant">
                      {selectedProduct ? `${selectedProduct.category} · ${selectedProduct.unit} · Giá vốn hiện tại ${formatInventoryCurrency(selectedProduct.purchase_price)}` : "Chọn sản phẩm để lấy thông tin kho hiện tại."}
                    </p>
                  </>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={item.name} onChange={event => updateItem(item.draftId, { name: event.target.value })} className="input-field" placeholder="Tên sản phẩm mới" />
                    <input value={item.sku} onChange={event => updateItem(item.draftId, { sku: event.target.value })} className="input-field font-mono uppercase" placeholder="Mã sản phẩm" />
                    <input value={item.category} onChange={event => updateItem(item.draftId, { category: event.target.value })} className="input-field" placeholder="Danh mục" />
                    <input value={item.unit} onChange={event => updateItem(item.draftId, { unit: event.target.value })} className="input-field" placeholder="Đơn vị" />
                    <input type="number" min="0" value={item.defaultSalePrice} onChange={event => updateItem(item.draftId, { defaultSalePrice: event.target.value })} className="input-field" placeholder="Giá bán mặc định" />
                    <input type="number" min="0" step="1" value={item.warrantyMonths} onChange={event => updateItem(item.draftId, { warrantyMonths: event.target.value })} className="input-field" placeholder="Bảo hành tháng" />
                  </div>
                )}

                <div className="mt-3 grid gap-3 md:grid-cols-[120px_160px_1fr]">
                  <input type="number" min="1" step="1" value={item.quantity} onChange={event => updateItem(item.draftId, { quantity: event.target.value })} className="input-field" placeholder="SL" />
                  <input type="number" min="0" value={item.unitCost} onChange={event => updateItem(item.draftId, { unitCost: event.target.value })} className="input-field" placeholder="Đơn giá nhập" />
                  <div className="rounded-lg bg-primary-fixed p-3">
                    <p className="text-xs font-bold uppercase text-primary-container">Thành tiền</p>
                    <p className="mt-1 text-lg font-extrabold text-primary">{formatInventoryCurrency(Number(item.quantity || 0) * Number(item.unitCost || 0))}</p>
                  </div>
                </div>

                <textarea value={item.serialsText} onChange={event => updateItem(item.draftId, { serialsText: event.target.value })} className="input-field mt-3 min-h-20 resize-y font-mono text-sm" placeholder="Mỗi dòng một thiết bị: SERIAL | QR | ghi chú" />
              </article>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
          <button type="button" onClick={addItem} disabled={saving} className="btn-outline !w-auto !px-4">
            <Plus size={18} />
            Thêm mặt hàng
          </button>
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-on-surface-variant">Tổng tiền nhập</p>
            <p className="text-2xl font-extrabold text-primary">{formatInventoryCurrency(draftTotal)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveReceipt("draft")} disabled={saving} className="btn-outline !w-auto !px-4">Lưu nháp</button>
            <button type="button" onClick={() => void saveReceipt("confirmed")} disabled={saving} className="btn-primary !w-auto !px-4">
              <Check size={18} />
              Xác nhận nhập
            </button>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-primary">Lịch sử nhập</p>
              <p className="text-lg font-extrabold text-on-surface">{formatInventoryCurrency(historyTotal)}</p>
            </div>
            <Truck size={22} className="text-primary" />
          </div>
          <label className="relative block">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input value={query} onChange={event => setQuery(event.target.value)} className="input-field !pl-10" placeholder="Tìm mã phiếu, NCC, sản phẩm..." />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-lg border border-outline-variant/30 bg-white py-16 shadow-sm"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" /></div>
        ) : filteredReceipts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-white p-8 text-center">
            <Truck size={28} className="mx-auto text-primary" />
            <p className="mt-3 font-bold text-on-surface">Chưa có phiếu nhập phù hợp</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReceipts.map(receipt => (
              <button key={receipt.id} type="button" onClick={() => setSelectedReceiptId(receipt.id)} className={`w-full rounded-lg border p-3 text-left shadow-sm transition-colors ${selectedReceipt?.id === receipt.id ? "border-primary bg-primary-fixed" : "border-outline-variant/30 bg-white hover:bg-surface-container-low"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-extrabold text-primary-container">{receipt.receipt_code}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{getReceiptSupplier(receipt)?.name || "Chưa chọn NCC"}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-on-surface-variant">{statusLabel(receipt.status)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-sm text-on-surface-variant">
                  <span>{new Date(receipt.received_at).toLocaleDateString("vi-VN")}</span>
                  <strong className="text-primary">{formatInventoryCurrency(receipt.total_amount)}</strong>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedReceipt && (
          <div className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-extrabold text-primary-container">{selectedReceipt.receipt_code}</p>
                <p className="mt-1 text-sm font-bold text-on-surface">{statusLabel(selectedReceipt.status)} · {formatInventoryCurrency(selectedReceipt.total_amount)}</p>
              </div>
              <div className="flex gap-2">
                {selectedReceipt.status === "draft" && (
                  <button type="button" onClick={() => loadDraft(selectedReceipt)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/50 text-primary" title="Sửa phiếu nháp"><Edit size={17} /></button>
                )}
                {selectedReceipt.status !== "canceled" && (
                  <button type="button" onClick={() => void cancelReceipt(selectedReceipt)} disabled={saving} className="flex h-10 w-10 items-center justify-center rounded-lg border border-error/25 text-error disabled:opacity-50" title="Hủy phiếu nhập"><X size={17} /></button>
                )}
              </div>
            </div>
            {selectedReceipt.note && <p className="mt-3 rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">{selectedReceipt.note}</p>}
            <div className="mt-3 divide-y divide-outline-variant/20 overflow-hidden rounded-lg border border-outline-variant/30">
              {(selectedReceipt.items || []).map(item => (
                <div key={item.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-on-surface">{item.product_name}</p>
                      <p className="font-mono text-xs text-on-surface-variant">{item.product_sku} · {item.category}</p>
                    </div>
                    <p className="text-right text-sm font-bold text-on-surface">{item.quantity} {item.unit}<br />{formatInventoryCurrency(item.line_total)}</p>
                  </div>
                  {item.serials && item.serials.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.serials.map(serial => <span key={serial.id} className="rounded-full bg-surface-container-low px-2 py-1 font-mono text-[11px] font-bold text-on-surface-variant">{serial.serial_code || serial.qr_code}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}
