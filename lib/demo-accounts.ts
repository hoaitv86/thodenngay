export const DEMO_CUSTOMER_PHONE = "0912345678";
export const DEMO_WORKER_PHONE = "0912345679";
export const DEMO_LOCAL_CUSTOMER_EMAIL = "customer@alotho.local";
export const DEMO_LOCAL_WORKER_EMAIL = "worker@alotho.local";
export const DEMO_ACCOUNT_PASSWORD = "123456";
export const DEMO_SESSION_STORAGE_KEY = "alo-tho-demo-session";
export const DEMO_ACTION_BLOCK_MESSAGE =
  "Tài khoản demo chỉ dùng để trải nghiệm, không thể đổi mật khẩu, xoá dữ liệu hoặc thực hiện thao tác ảnh hưởng dữ liệu thật.";

export type DemoRole = "customer" | "worker";

export const DEMO_ACCOUNTS: Record<DemoRole, { phone: string; email: string; label: string }> = {
  customer: {
    phone: DEMO_CUSTOMER_PHONE,
    email: `${DEMO_CUSTOMER_PHONE}@thodenngay.vn`,
    label: "Khách hàng",
  },
  worker: {
    phone: DEMO_WORKER_PHONE,
    email: `${DEMO_WORKER_PHONE}@thodenngay.vn`,
    label: "Thợ",
  },
};

export const normalizePhone = (phone: string | null | undefined) =>
  String(phone || "").replace(/\D/g, "");

export const isDemoPhone = (phone: string | null | undefined) => {
  const normalizedPhone = normalizePhone(phone);
  return normalizedPhone === DEMO_CUSTOMER_PHONE || normalizedPhone === DEMO_WORKER_PHONE;
};

export const isDemoEmail = (email: string | null | undefined) =>
  DEMO_CUSTOMER_PHONE === normalizePhone(String(email || "").split("@")[0]) ||
  DEMO_WORKER_PHONE === normalizePhone(String(email || "").split("@")[0]) ||
  String(email || "").toLowerCase() === DEMO_LOCAL_CUSTOMER_EMAIL ||
  String(email || "").toLowerCase() === DEMO_LOCAL_WORKER_EMAIL;

export const isDemoAccount = (profile: { phone?: string | null; email?: string | null } | null | undefined) =>
  Boolean(profile && (isDemoPhone(profile.phone) || isDemoEmail(profile.email)));
