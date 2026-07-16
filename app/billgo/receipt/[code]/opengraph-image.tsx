import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { formatBillGoCurrency } from "@/lib/billgo";

export const runtime = "edge";
export const alt = "Phiếu thu BillGo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type OpenGraphImageProps = {
  params: Promise<{ code: string }>;
};

type ReceiptPreview = {
  receipt_code: string;
  lookup_code: string;
  customer_name?: string | null;
  internet_account?: string | null;
  package_name?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  paid_at?: string | null;
};

const getAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const dateLabel = (value?: string | null) => {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
};

export default async function Image({ params }: OpenGraphImageProps) {
  const { code } = await params;
  const admin = getAdmin();
  const normalizedCode = decodeURIComponent(code || "").trim().toUpperCase();
  const { data } = admin
    ? await admin
      .from("billgo_receipts")
      .select("receipt_code, lookup_code, customer_name, internet_account, package_name, period_start, period_end, paid_amount, remaining_amount, paid_at")
      .or(`lookup_code.eq.${normalizedCode},receipt_code.eq.${normalizedCode}`)
      .maybeSingle()
    : { data: null };
  const receipt = data as ReceiptPreview | null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f8fafc",
          color: "#0f172a",
          padding: 56,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: "#0f766e", fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>BillGo</div>
            <div style={{ marginTop: 12, fontSize: 64, fontWeight: 900 }}>Phiếu thu</div>
            <div style={{ marginTop: 14, color: "#475569", fontSize: 28, fontWeight: 700 }}>
              {receipt?.receipt_code || normalizedCode}
            </div>
          </div>
          <div style={{ borderRadius: 20, background: "#ccfbf1", color: "#0f766e", padding: "18px 24px", fontSize: 28, fontWeight: 900 }}>
            Đã lưu
          </div>
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ flex: 1, borderRadius: 24, background: "#ffffff", padding: 28, border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#64748b", fontSize: 22, fontWeight: 800 }}>Khách hàng</div>
            <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900 }}>{receipt?.customer_name || "Khách BillGo"}</div>
            <div style={{ marginTop: 12, color: "#475569", fontSize: 24, fontWeight: 700 }}>
              {receipt?.internet_account || "Chưa có account"}
            </div>
            <div style={{ marginTop: 12, color: "#475569", fontSize: 24, fontWeight: 700 }}>
              {receipt?.package_name || "Cước Internet"}
            </div>
          </div>
          <div style={{ width: 390, borderRadius: 24, background: "#ffffff", padding: 28, border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#64748b", fontSize: 22, fontWeight: 800 }}>Số tiền đã thu</div>
            <div style={{ marginTop: 10, color: "#15803d", fontSize: 42, fontWeight: 900 }}>{formatBillGoCurrency(receipt?.paid_amount)}</div>
            <div style={{ marginTop: 18, color: "#64748b", fontSize: 22, fontWeight: 800 }}>Còn lại</div>
            <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 30, fontWeight: 900 }}>{formatBillGoCurrency(receipt?.remaining_amount)}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontSize: 24, fontWeight: 800 }}>
          <div>Kỳ cước: {dateLabel(receipt?.period_start)} - {dateLabel(receipt?.period_end)}</div>
          <div>Ngày thu: {dateLabel(receipt?.paid_at)}</div>
        </div>
      </div>
    ),
    size,
  );
}
