"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Edit, Package, Plus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  formatInventoryCurrency,
  type InventoryProduct,
} from "@/lib/worker-inventory";

export default function WorkerInventoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProducts([]);
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
      setProducts([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("worker_inventory_products")
      .select("*")
      .eq("worker_id", worker.id)
      .order("updated_at", { ascending: false });

    if (error) {
      setMessage("Khong the tai danh sach san pham: " + error.message);
      setProducts([]);
    } else {
      setProducts((data || []) as InventoryProduct[]);
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

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-surface p-4 animate-fade-in lg:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Kho hang</p>
          <h1 className="text-2xl font-extrabold text-on-surface">Danh sach san pham</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Quan ly vat tu, linh kien va hang ton rieng cua tho. Module nay chua lien ket voi cong viec, BillGo hay bao hanh.
          </p>
        </div>
        <Link href="/worker/inventory/new" className="btn-primary !w-auto !px-4">
          <Plus size={18} />
          Them san pham
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["San pham", String(stats.totalProducts)],
          ["Tong ton", String(stats.totalUnits)],
          ["Gia tri nhap", formatInventoryCurrency(stats.stockValue)],
          ["Het hang", String(stats.outOfStock)],
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
            placeholder="Tim theo ten, ma san pham, danh muc, ghi chu..."
          />
        </label>
        <select value={category} onChange={event => setCategory(event.target.value)} className="input-field">
          <option value="all">Tat ca danh muc</option>
          {categories.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </section>

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
          <p className="mt-4 font-bold text-on-surface">Chua co san pham phu hop</p>
          <p className="mt-1 text-sm text-on-surface-variant">Them san pham dau tien hoac thu thay doi bo loc.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-outline-variant/30 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.8fr_104px] gap-3 border-b border-outline-variant/30 bg-surface-container-low px-4 py-3 text-xs font-bold uppercase text-on-surface-variant lg:grid">
            <span>San pham</span>
            <span>Danh muc</span>
            <span>Gia nhap</span>
            <span>Ton kho</span>
            <span>Gia ban</span>
            <span className="text-right">Thao tac</span>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {filteredProducts.map(product => (
              <article key={product.id} className="grid gap-3 p-4 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.8fr_104px] lg:items-center">
                <div className="min-w-0">
                  <h2 className="truncate font-extrabold text-on-surface">{product.name}</h2>
                  <p className="mt-1 font-mono text-xs font-bold text-primary-container">{product.sku}</p>
                  {product.note && <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant">{product.note}</p>}
                </div>
                <span className="w-fit rounded-full bg-primary-fixed px-2.5 py-1 text-xs font-bold text-primary-container">{product.category}</span>
                <div>
                  <p className="text-xs font-bold uppercase text-on-surface-variant lg:hidden">Gia nhap</p>
                  <p className="font-bold text-on-surface">{formatInventoryCurrency(product.purchase_price)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-on-surface-variant lg:hidden">Ton kho</p>
                  <p className={`font-extrabold ${Number(product.stock_quantity || 0) <= 0 ? "text-error" : "text-success"}`}>
                    {product.stock_quantity} {product.unit}
                  </p>
                  <p className="text-xs text-on-surface-variant">BH {product.warranty_months} thang</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-on-surface-variant lg:hidden">Gia ban</p>
                  <p className="font-bold text-on-surface">{formatInventoryCurrency(product.default_sale_price)}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Link href={`/worker/inventory/${product.id}/edit`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/50 text-primary transition-colors hover:bg-primary-fixed" title="Sua san pham">
                    <Edit size={17} />
                  </Link>
                  <Link href={`/worker/inventory/${product.id}/delete`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-error/25 text-error transition-colors hover:bg-error-container" title="Xoa san pham">
                    <Trash2 size={17} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
