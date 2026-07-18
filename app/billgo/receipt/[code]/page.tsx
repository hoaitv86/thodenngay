import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { formatBillGoCurrency, getBillGoCycleOption } from "@/lib/billgo";
import { readVietnameseMoney } from "@/lib/vietnamese-money";
import ReceiptActions from "./ReceiptActions";

export const dynamic = "force-dynamic";

type ReceiptPageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ print?: string }>;
};

type BillGoReceiptRow = {
  receipt_code: string;
  lookup_code: string;
  qr_payload: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  internet_account?: string | null;
  customer_address?: string | null;
  package_name?: string | null;
  cycle_at_collection?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  collector_name?: string | null;
  note?: string | null;
  created_at?: string | null;
};

const methodLabels: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  transfer: "Chuyển khoản",
  card: "Thẻ",
  momo: "MoMo",
  zalopay: "ZaloPay",
  other: "Khác",
};

const getAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const receiptSelect = "receipt_code, lookup_code, qr_payload, customer_name, customer_phone, internet_account, customer_address, package_name, cycle_at_collection, period_start, period_end, total_amount, paid_amount, remaining_amount, payment_method, paid_at, collector_name, note, created_at";

const normalizeReceiptCode = (code: string) => decodeURIComponent(code || "").trim().toUpperCase();

const loadReceipt = async (code: string) => {
  const admin = getAdmin();
  if (!admin) return null;
  const normalizedCode = normalizeReceiptCode(code);
  const { data } = await admin
    .from("billgo_receipts")
    .select(receiptSelect)
    .or(`lookup_code.eq.${normalizedCode},receipt_code.eq.${normalizedCode}`)
    .maybeSingle();
  return data as BillGoReceiptRow | null;
};

const getPublicBaseUrl = async () => {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const protocol = headerStore.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return host ? `${protocol}://${host}` : "";
};

const buildReceiptUrl = async (receipt: BillGoReceiptRow) => {
  if (receipt.qr_payload?.startsWith("http")) return receipt.qr_payload;
  const baseUrl = await getPublicBaseUrl();
  return `${baseUrl}/billgo/receipt/${encodeURIComponent(receipt.lookup_code)}`;
};

const dateLabel = (value?: string | null) => {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
};

export async function generateMetadata({ params }: Pick<ReceiptPageProps, "params">): Promise<Metadata> {
  const { code } = await params;
  const receipt = await loadReceipt(code);
  if (!receipt) return { title: "Phiếu thu BillGo" };

  const baseUrl = await getPublicBaseUrl();
  const title = `Phiếu thu ${receipt.receipt_code}`;
  const description = `${receipt.customer_name || "Khách BillGo"} đã thu ${formatBillGoCurrency(receipt.paid_amount)}${receipt.period_start ? `, kỳ ${dateLabel(receipt.period_start)} - ${dateLabel(receipt.period_end)}` : ""}.`;
  const imageUrl = `${baseUrl}/billgo/receipt/${encodeURIComponent(receipt.lookup_code)}/opengraph-image`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: baseUrl ? `${baseUrl}/billgo/receipt/${encodeURIComponent(receipt.lookup_code)}` : undefined,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function BillGoReceiptPage({ params, searchParams }: ReceiptPageProps) {
  const { code } = await params;
  const { print } = await searchParams;
  const receipt = await loadReceipt(code);
  if (!receipt) notFound();

  const receiptUrl = await buildReceiptUrl(receipt);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(receiptUrl)}`;
  const paidAmountText = readVietnameseMoney(receipt.paid_amount);

  return (
    <main className="min-h-dvh bg-surface px-4 py-6 text-on-surface">
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4; }
          html, body { width: 100% !important; min-height: 100% !important; background: #fff !important; color: #111827 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          main { min-height: auto !important; background: #fff !important; padding: 0 !important; color: #111827 !important; }
          * { color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .receipt-actions, .receipt-search-link { display: none !important; }
          .receipt-sheet { display: block !important; width: 100% !important; max-width: 100% !important; min-height: auto !important; box-shadow: none !important; border: 0 !important; background: #fff !important; color: #111827 !important; }
          .receipt-sheet * { color: inherit; }
          .receipt-sheet .text-primary { color: #0f766e !important; }
          .receipt-sheet .text-success { color: #15803d !important; }
          .receipt-sheet .text-error { color: #b91c1c !important; }
          .receipt-sheet .text-on-surface-variant { color: #4b5563 !important; }
          .receipt-sheet img { display: block !important; }
        }
      `}</style>
      <section className="receipt-sheet invoice-print-area mx-auto max-w-3xl rounded-lg border border-outline-variant/40 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/30 pb-4">
          <div>
            <p className="text-xs font-bold uppercase text-primary">BillGo</p>
            <h1 className="mt-1 text-2xl font-extrabold">Phiếu thu</h1>
            <p className="mt-1 text-sm text-on-surface-variant">Mã phiếu: <strong>{receipt.receipt_code}</strong></p>
            <p className="text-sm text-on-surface-variant">Mã tra cứu: <strong>{receipt.lookup_code}</strong></p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt={`QR tra cứu phiếu ${receipt.receipt_code}`} width={180} height={180} className="rounded-lg border border-outline-variant/40 p-2" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Khách hàng", receipt.customer_name || "Chưa có"],
            ["Số điện thoại", receipt.customer_phone || "Chưa có"],
            ["Account", receipt.internet_account || "Chưa có"],
            ["Địa chỉ", receipt.customer_address || "Chưa có"],
            ["Gói cước", receipt.package_name || "Cước Internet"],
            ["Chu kỳ", getBillGoCycleOption(receipt.cycle_at_collection || "monthly").label],
            ["Kỳ sử dụng", `${dateLabel(receipt.period_start)} - ${dateLabel(receipt.period_end)}`],
            ["Ngày thu", dateLabel(receipt.paid_at)],
            ["Người thu", receipt.collector_name || "Chưa có"],
            ["Hình thức", methodLabels[receipt.payment_method || ""] || receipt.payment_method || "Chưa có"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-surface-container-low p-3 text-sm">
              <p className="text-xs font-bold uppercase text-on-surface-variant">{label}</p>
              <p className="mt-1 font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-primary-fixed p-4">
            <p className="text-xs font-bold uppercase text-primary">Phải thu</p>
            <p className="mt-2 text-xl font-extrabold text-primary">{formatBillGoCurrency(receipt.total_amount)}</p>
          </div>
          <div className="rounded-lg bg-success/10 p-4">
            <p className="text-xs font-bold uppercase text-success">Đã thu</p>
            <p className="mt-2 text-xl font-extrabold text-success">{formatBillGoCurrency(receipt.paid_amount)}</p>
          </div>
          <div className="rounded-lg bg-error/10 p-4">
            <p className="text-xs font-bold uppercase text-error">Còn lại</p>
            <p className="mt-2 text-xl font-extrabold text-error">{formatBillGoCurrency(receipt.remaining_amount)}</p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-outline-variant/30 bg-white p-4 text-sm">
          <p className="text-xs font-bold uppercase text-on-surface-variant">Số tiền bằng chữ</p>
          <p className="mt-1 text-base font-extrabold text-on-surface">{paidAmountText}</p>
        </div>

        {receipt.note && (
          <div className="mt-5 rounded-lg bg-surface-container-low p-3 text-sm">
            <p className="text-xs font-bold uppercase text-on-surface-variant">Ghi chú</p>
            <p className="mt-1 font-medium">{receipt.note}</p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-4">
          <Link href="/billgo/receipt" className="receipt-search-link text-sm font-bold text-primary">Tra cứu phiếu khác</Link>
          <ReceiptActions receiptCode={receipt.receipt_code} receiptUrl={receiptUrl} autoPrint={print === "1"} />
        </div>
      </section>
    </main>
  );
}
