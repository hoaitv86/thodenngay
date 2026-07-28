export type WorkerUnitMemberRole = "owner" | "manager" | "technician" | "bill_collector" | "sales_inventory";

export const WORKER_UNIT_MEMBER_ROLES: WorkerUnitMemberRole[] = [
  "owner",
  "manager",
  "technician",
  "bill_collector",
  "sales_inventory",
];

export const WORKER_UNIT_ROLE_LABELS: Record<WorkerUnitMemberRole, string> = {
  owner: "Ch? ??n v?",
  manager: "Qu?n l?",
  technician: "Th? k? thu?t",
  bill_collector: "Nh?n vi?n thu c??c",
  sales_inventory: "Nh?n vi?n b?n h?ng/kho",
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
