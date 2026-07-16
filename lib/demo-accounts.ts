export const DEMO_CUSTOMER_PHONE = "0912345678";
export const DEMO_WORKER_PHONE = "0912345679";
export const DEMO_SESSION_STORAGE_KEY = "alo-tho-demo-session";
export const DEMO_ACTION_BLOCK_MESSAGE =
  "Tai khoan demo chi dung de trai nghiem, khong the doi mat khau, xoa du lieu hoac thuc hien thao tac anh huong du lieu that.";

export type DemoRole = "customer" | "worker";

export const DEMO_ACCOUNTS: Record<DemoRole, { phone: string; label: string }> = {
  customer: {
    phone: DEMO_CUSTOMER_PHONE,
    label: "Khach hang",
  },
  worker: {
    phone: DEMO_WORKER_PHONE,
    label: "Tho",
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
  DEMO_WORKER_PHONE === normalizePhone(String(email || "").split("@")[0]);

export const isDemoAccount = (profile: { phone?: string | null; email?: string | null } | null | undefined) =>
  Boolean(profile && (isDemoPhone(profile.phone) || isDemoEmail(profile.email)));
