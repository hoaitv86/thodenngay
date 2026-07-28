export type WorkerUnitMemberRole = "owner" | "manager" | "technician" | "bill_collector" | "sales_inventory";

export const WORKER_UNIT_MEMBER_ROLES: WorkerUnitMemberRole[] = [
  "owner",
  "manager",
  "technician",
  "bill_collector",
  "sales_inventory",
];

export const WORKER_UNIT_ROLE_LABELS: Record<WorkerUnitMemberRole, string> = {
  owner: "Ch\u1ee7 \u0111\u01a1n v\u1ecb",
  manager: "Qu\u1ea3n l\u00fd",
  technician: "Th\u1ee3 k\u1ef9 thu\u1eadt",
  bill_collector: "Nh\u00e2n vi\u00ean thu c\u01b0\u1edbc",
  sales_inventory: "Nh\u00e2n vi\u00ean b\u00e1n h\u00e0ng/kho",
};

export const WORKER_UNIT_ASSIGNABLE_ROLES = WORKER_UNIT_MEMBER_ROLES.filter(
  (role): role is Exclude<WorkerUnitMemberRole, "owner"> => role !== "owner"
);

export function isWorkerUnitMemberRole(role?: string | null): role is WorkerUnitMemberRole {
  return WORKER_UNIT_MEMBER_ROLES.includes(role as WorkerUnitMemberRole);
}

export function canManageWorkerUnit(role?: string | null) {
  return role === "owner" || role === "manager";
}

export function canUseBillGo(role?: string | null) {
  return canManageWorkerUnit(role) || role === "bill_collector";
}

export function canManageBillGo(role?: string | null) {
  return canManageWorkerUnit(role);
}

export function canCollectBillGo(role?: string | null) {
  return canManageWorkerUnit(role) || role === "bill_collector";
}

export function canUseInventory(role?: string | null) {
  return canManageWorkerUnit(role) || role === "sales_inventory";
}

export function canUseSales(role?: string | null) {
  return canManageWorkerUnit(role) || role === "sales_inventory";
}

export function canUseJobs(role?: string | null) {
  return canManageWorkerUnit(role) || role === "technician";
}
