"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { InventoryProduct } from "@/lib/worker-inventory";
import {
  buildSalesRpcItems,
  createEmptySalesDraftItem,
  formatSalesCurrency,
  getDraftLineTotal,
  getDraftProduct,
  getSalesDraftTotal,
  validateSalesDraft,
  type SalesDraftItem,
  type WorkerSalesCustomer,
} from "@/lib/worker-sales";

type RawKnownCustomerJob = {
  customer_id: string;
  address?: string | null;
  customer?: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | Array<{
    id: string;
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
  }> | null;
};

const getCustomerProfile = (customer: RawKnownCustomerJob["customer"]) => {
  if (Array.isArray(customer)) return customer[0] || null;
  return customer || null;
};

export default function NewWorkerSalesOrderPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState<WorkerSalesCustomer[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<SalesDraftItem[]>([createEmptySalesDraftItem()]);
  const [note, setNote] = useState("");
  const [createBillGo, setCreateBillGo] = useState(false);
  const [billGoCycle, setBillGoCycle] = useState("monthly");
  const [billGoStartDate, setBillGoStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Ban chua dang nhap.");
      setLoading(false);
      return;
    }

    const { data: worker } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!worker) {
      setMessage("Khong tim thay ho so tho.");
      setLoading(false);
      return;
    }

    const [productsResult, jobsResult] = await Promise.all([
      supabase
        .from("worker_inventory_products")
        .select("*")
        .eq("worker_id", worker.id)
        .gt("stock_quantity", 0)
        .order("name", { ascending: true }),
      supabase
        .from("jobs")
        .select("customer_id, address, customer:profiles!customer_id(id, full_name, phone, address)")
        .eq("worker_id", worker.id)
        .order("updated_at", { ascending: false }),
    ]);

    if (productsResult.error) {
      setMessage("Khong the tai kho hang: " + productsResult.error.message);
      setProducts([]);
    } else {
      setProducts((productsResult.data || []) as InventoryProduct[]);
    }

    if (jobsResult.error) {
      setMessage("Khong the tai danh sach khach hang: " + jobsResult.error.message);
      setCustomers([]);
    } else {
      const customerMap = new Map<string, WorkerSalesCustomer>();
      ((jobsResult.data || []) as RawKnownCustomerJob[]).forEach(job => {
        const profile = getCustomerProfile(job.customer);
        const id = profile?.id || job.customer_id;
        if (!customerMap.has(id)) {
          customerMap.set(id, {
            id,
            name: profile?.full_name || "Khach hang",
            phone: profile?.phone,
            address: profile?.address || job.address,
          });
        }
      });
      setCustomers([...customerMap.values()]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchFormData(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchFormData]);

  const totalAmount = useMemo(() => getSalesDraftTotal(items), [items]);
  const hasRecurringProducts = useMemo(
    () => items.some(item => products.find(product => product.id === item.productId)?.is_recurring_billgo),
    [items, products]
  );

  const updateItem = (draftId: string, patch: Partial<SalesDraftItem>) => {
    setItems(current => current.map(item => {
      if (item.draftId !== draftId) return item;
      const next = { ...item, ...patch };
      if (patch.productId) {
        const product = products.find(entry => entry.id === patch.productId);
        next.unitPrice = product ? String(Number(product.default_sale_price || 0)) : "";
      }
      return next;
    }));
  };

  const addItem = () => {
    setItems(current => [...current, createEmptySalesDraftItem()]);
  };

  const removeItem = (draftId: string) => {
    setItems(current => current.length === 1 ? current : current.filter(item => item.draftId !== draftId));
  };

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationMessage = validateSalesDraft(customerId, items, products);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("create_worker_sales_order", {
      p_customer_id: customerId,
      p_note: note,
      p_items: buildSalesRpcItems(items),
      p_create_billgo: createBillGo && hasRecurringProducts,
      p_billgo_cycle: billGoCycle,
      p_billgo_start_date: billGoStartDate,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    router.push("/worker/sales");
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
    <form onSubmit={submitOrder} className="min-h-[calc(100dvh-8rem)] bg-surface p-4 animate-fade-in lg:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Ban hang</p>
          <h1 className="text-2xl font-extrabold text-on-surface">Tao don ban</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Chon khach hang, chon san pham tu kho, nhap so luong va gia ban thuc te. Khi luu, he thong se tu dong tru ton kho.
          </p>
        </div>
        <Link href="/worker/sales" className="btn-outline !w-auto !px-4">
          <X size={18} />
          Huy
        </Link>
      </header>

      {message && (
        <div className="mb-4 rounded-lg border border-error/20 bg-error-container p-3 text-sm font-bold text-error">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Khach hang</span>
              <select required value={customerId} onChange={event => setCustomerId(event.target.value)} className="input-field">
                <option value="">Chon khach hang da phuc vu</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}{customer.phone ? ` - ${customer.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {customers.length === 0 && (
              <p className="mt-2 text-sm text-error">Chua co khach hang nao trong danh sach phuc vu cua tho.</p>
            )}
          </div>

          <div className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-extrabold text-on-surface">San pham ban</h2>
                <p className="text-sm text-on-surface-variant">Co the sua gia ban cho tung dong hang neu can.</p>
              </div>
              <button type="button" onClick={addItem} className="btn-outline !w-auto !px-3">
                <Plus size={18} />
                Them dong
              </button>
            </div>

            {products.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant">
                Kho hang chua co san pham con ton de ban.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map(item => {
                  const product = getDraftProduct(item, products);
                  return (
                    <div key={item.draftId} className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
                      <div className="grid gap-3 lg:grid-cols-[1fr_120px_150px_44px] lg:items-end">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">San pham</span>
                          <select required value={item.productId} onChange={event => updateItem(item.draftId, { productId: event.target.value })} className="input-field">
                            <option value="">Chon san pham</option>
                            {products.map(productOption => (
                              <option key={productOption.id} value={productOption.id}>
                                {productOption.name} - ton {productOption.stock_quantity} {productOption.unit}{productOption.is_recurring_billgo ? " - thu dinh ky" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">So luong</span>
                          <input required min="1" max={product?.stock_quantity || undefined} step="1" type="number" value={item.quantity} onChange={event => updateItem(item.draftId, { quantity: event.target.value })} className="input-field" />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Gia ban</span>
                          <input required min="0" type="number" value={item.unitPrice} onChange={event => updateItem(item.draftId, { unitPrice: event.target.value })} className="input-field" />
                        </label>
                        <button type="button" onClick={() => removeItem(item.draftId)} disabled={items.length === 1} className="flex h-11 w-11 items-center justify-center rounded-lg border border-error/25 text-error transition-colors hover:bg-error-container disabled:opacity-40" title="Xoa dong">
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <p className="text-on-surface-variant">
                          {product ? `${product.sku} · ${product.category} · Ton ${product.stock_quantity} ${product.unit}` : "Chua chon san pham"}
                        </p>
                        <p className="font-extrabold text-on-surface">{formatSalesCurrency(getDraftLineTotal(item))}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <label className="block rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
            <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">Ghi chu</span>
            <textarea value={note} onChange={event => setNote(event.target.value)} className="input-field min-h-24 resize-y" placeholder="Ghi chu ve don ban, giao hang, thanh toan..." />
          </label>

          {hasRecurringProducts && (
            <section className="rounded-lg border border-primary-container/25 bg-white p-4 shadow-sm">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={createBillGo}
                  onChange={event => setCreateBillGo(event.target.checked)}
                  className="mt-1 h-5 w-5"
                />
                <span>
                  <strong className="block text-sm text-on-surface">Tạo lịch thu BillGo</strong>
                  <span className="mt-1 block text-sm text-on-surface-variant">
                    Dùng thông tin khách hàng đã chọn, không cần nhập lại.
                  </span>
                </span>
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select className="input-field" value={billGoCycle} onChange={event => setBillGoCycle(event.target.value)} disabled={!createBillGo}>
                  <option value="monthly">Hàng tháng</option>
                  <option value="three_months">3 tháng</option>
                  <option value="six_months">6 tháng</option>
                  <option value="yearly">Hàng năm</option>
                </select>
                <input className="input-field" type="date" value={billGoStartDate} onChange={event => setBillGoStartDate(event.target.value)} disabled={!createBillGo} />
              </div>
            </section>
          )}
        </section>

        <aside className="h-fit rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm lg:sticky lg:top-24">
          <p className="text-xs font-bold uppercase text-on-surface-variant">Tong tien</p>
          <p className="mt-2 text-3xl font-extrabold text-primary">{formatSalesCurrency(totalAmount)}</p>
          <div className="mt-4 space-y-2 text-sm text-on-surface-variant">
            <div className="flex justify-between gap-3">
              <span>So dong hang</span>
              <strong className="text-on-surface">{items.length}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span>Tong so luong</span>
              <strong className="text-on-surface">{items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</strong>
            </div>
          </div>
          <button disabled={saving || products.length === 0 || customers.length === 0} className="btn-primary mt-5 w-full">
            <Save size={18} />
            {saving ? "Dang luu..." : "Luu don va tru ton"}
          </button>
          <p className="mt-3 text-xs leading-5 text-on-surface-variant">
            Don ban se duoc luu vao lich su ban hang, tu dong tao bao hanh neu co va co the tao lich BillGo cho san pham dinh ky.
          </p>
        </aside>
      </div>
    </form>
  );
}
