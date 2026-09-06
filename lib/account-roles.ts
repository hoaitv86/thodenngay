export type AccountRole = "customer" | "worker" | "admin" | "unit_owner" | "lead_worker" | "assistant_worker";
export type LegacyProfileRole = "customer" | "worker" | "admin";
export const ACTIVE_ROLE_COOKIE = "alo_active_role";

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

export function getPhoneLoginCandidates(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const candidates = new Set<string>();

  if (normalizedPhone) {
    candidates.add(normalizedPhone);
  }

  if (normalizedPhone.startsWith("84") && normalizedPhone.length > 2) {
    candidates.add(`0${normalizedPhone.slice(2)}`);
  }

  if (normalizedPhone.startsWith("0") && normalizedPhone.length > 1) {
    candidates.add(`84${normalizedPhone.slice(1)}`);
  }

  return [...candidates];
}

export function buildPhoneLoginEmail(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  return normalizedPhone ? `${normalizedPhone}@phone.thodenngay.local` : "";
}

export function isUnregisteredApiKeyError(error: { message?: string } | null | undefined) {
  return String(error?.message || "").toLowerCase().includes("unregistered api key");
}

export function isSyntheticPhoneEmail(email?: string | null) {
  if (!email) return true;
  const normalizedEmail = email.trim().toLowerCase();
  const [localPart, domain] = normalizedEmail.split("@");
  if (!localPart || !domain) return true;

  return (
    domain === "phone.thodenngay.local" ||
    (domain === "thodenngay.vn" && /^\d{8,15}$/.test(localPart))
  );
}

export function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
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

export function isAccountRole(role?: string | null): role is AccountRole {
  return (
    role === "customer" ||
    role === "worker" ||
    role === "admin" ||
    role === "unit_owner" ||
    role === "lead_worker" ||
    role === "assistant_worker"
  );
}

export function isWorkerRole(role?: string | null) {
  return role === "worker" || role === "unit_owner" || role === "lead_worker" || role === "assistant_worker";
}

export function canUseAccountRole(role: AccountRole, roles: AccountRole[], worker?: WorkerAccountRecord) {
  if (role === "customer") return roles.includes("customer") || Boolean(worker) || roles.includes("worker");
  if (role === "admin") return roles.includes("admin");
  if (isWorkerRole(role)) return Boolean(worker) || roles.includes(role) || roles.includes("worker");
  return roles.includes(role);
}

export function resolveActiveRole(params: {
  legacyRole?: string | null;
  worker?: WorkerAccountRecord;
  userRoles?: UserRoleRecord[];
  preferredRole?: string | null;
}) {
  const roles = uniqueRoles(params.legacyRole, params.userRoles);
  const preferredRole = isAccountRole(params.preferredRole) ? params.preferredRole : null;

  if (preferredRole && canUseAccountRole(preferredRole, roles, params.worker)) {
    return preferredRole;
  }

  if (roles.includes("admin")) return "admin";
  if (params.worker || roles.includes("worker")) return "worker";
  if (roles.includes("lead_worker")) return "lead_worker";
  if (roles.includes("assistant_worker")) return "assistant_worker";
  return "customer";
}

export function resolvePostLoginDestination(params: {
  legacyRole?: string | null;
  worker?: WorkerAccountRecord;
  userRoles?: UserRoleRecord[];
  preferredRole?: string | null;
}) {
  const activeRole = resolveActiveRole(params);

  if (activeRole === "admin") return "/admin/dashboard";
  if (isWorkerRole(activeRole)) {
    return "/worker";
  }
  return "/customer/home";
}
