export type AccountRole = "customer" | "worker" | "admin" | "unit_owner" | "lead_worker" | "assistant_worker";
export type LegacyProfileRole = "customer" | "worker" | "admin";

export type WorkerAccountRecord = {
  status?: string | null;
} | null;

export type UserRoleRecord = {
  role?: string | null;
  is_active?: boolean | null;
} | null;

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function buildPhoneLoginEmail(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  return normalizedPhone ? `${normalizedPhone}@phone.thodenngay.local` : "";
}

export function uniqueRoles(legacyRole?: string | null, userRoles: UserRoleRecord[] = []) {
  const roles = new Set<AccountRole>();

  if (legacyRole === "admin" || legacyRole === "worker" || legacyRole === "customer") {
    roles.add(legacyRole);
  }

  for (const item of userRoles) {
    if (item?.is_active === false) continue;
    const role = item?.role;
    if (
      role === "customer" ||
      role === "worker" ||
      role === "admin" ||
      role === "unit_owner" ||
      role === "lead_worker" ||
      role === "assistant_worker"
    ) {
      roles.add(role);
    }
  }

  if (!roles.size) roles.add("customer");
  return [...roles];
}

export function resolvePostLoginDestination(params: {
  legacyRole?: string | null;
  worker?: WorkerAccountRecord;
  userRoles?: UserRoleRecord[];
}) {
  const roles = uniqueRoles(params.legacyRole, params.userRoles);

  if (roles.includes("admin")) return "/admin/dashboard";
  if (params.worker || roles.includes("worker") || roles.includes("lead_worker") || roles.includes("assistant_worker")) {
    return "/worker";
  }
  return "/customer/home";
}
