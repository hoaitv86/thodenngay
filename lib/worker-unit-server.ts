import type { SupabaseClient } from "@supabase/supabase-js";
import { isWorkerUnitMemberRole, type WorkerUnitMemberRole } from "@/lib/worker-unit-permissions";
import { resolveWorkerFeatureModuleState, type WorkerFeatureModuleState } from "@/lib/worker-modules";

type MembershipRow = {
  member_role?: string | null;
  unit?: {
    id?: string | null;
    owner_id?: string | null;
    module_flags?: unknown;
  } | Array<{
    id?: string | null;
    owner_id?: string | null;
    module_flags?: unknown;
  }> | null;
};

type WorkerModuleRow = {
  module_flags?: unknown;
  specialties?: unknown;
};

export type WorkerUnitScope = {
  userId: string;
  selfWorkerId: string;
  scopedWorkerId: string;
  unitId: string | null;
  unitOwnerId: string;
  role: WorkerUnitMemberRole | "worker";
  enabledFeatures: WorkerFeatureModuleState;
};

const rolePriority: WorkerUnitMemberRole[] = ["owner", "manager", "technician", "bill_collector", "sales_inventory"];

function firstUnit(row: MembershipRow | undefined) {
  return Array.isArray(row?.unit) ? row.unit[0] : row?.unit;
}

function isMissingModuleFlagsError(message?: string) {
  return Boolean(message && message.includes("module_flags"));
}

async function loadMemberships(db: SupabaseClient, userId: string) {
  const withModules = await db
    .from("worker_unit_members")
    .select("member_role, unit:worker_units(id, owner_id, module_flags)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!withModules.error) return (withModules.data || []) as MembershipRow[];
  if (!isMissingModuleFlagsError(withModules.error.message)) return [];

  const fallback = await db
    .from("worker_unit_members")
    .select("member_role, unit:worker_units(id, owner_id)")
    .eq("user_id", userId)
    .eq("status", "active");

  return (fallback.data || []) as MembershipRow[];
}

async function loadWorkerModules(db: SupabaseClient, workerId: string) {
  const withModules = await db
    .from("workers")
    .select("specialties, module_flags")
    .eq("id", workerId)
    .maybeSingle();

  if (!withModules.error) return (withModules.data || {}) as WorkerModuleRow;
  if (!isMissingModuleFlagsError(withModules.error.message)) return {};

  const fallback = await db
    .from("workers")
    .select("specialties")
    .eq("id", workerId)
    .maybeSingle();

  return (fallback.data || {}) as WorkerModuleRow;
}

export async function resolveWorkerUnitScope(
  db: SupabaseClient,
  userId: string,
  selfWorkerId: string,
): Promise<WorkerUnitScope> {
  const [memberships, selfWorker] = await Promise.all([
    loadMemberships(db, userId),
    loadWorkerModules(db, selfWorkerId),
  ]);

  const rows = memberships.filter((row) => isWorkerUnitMemberRole(row.member_role));
  const selected = rolePriority
    .map((role) => rows.find((row) => row.member_role === role))
    .find(Boolean);

  const unit = selected ? firstUnit(selected) : null;
  const role = isWorkerUnitMemberRole(selected?.member_role) ? selected.member_role : "worker";
  const unitOwnerId = unit?.owner_id || userId;
  let scopedWorkerId = selfWorkerId;

  if (unitOwnerId !== userId) {
    const { data: ownerWorker } = await db
      .from("workers")
      .select("id")
      .eq("user_id", unitOwnerId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    scopedWorkerId = ownerWorker?.id || selfWorkerId;
  }

  const enabledFeatures = resolveWorkerFeatureModuleState({
    accountFlags: selfWorker.module_flags,
    unitFlags: unit?.module_flags,
    role,
    specialties: selfWorker.specialties,
  });

  return {
    userId,
    selfWorkerId,
    scopedWorkerId,
    unitId: unit?.id || null,
    unitOwnerId,
    role,
    enabledFeatures,
  };
}

export async function getAssignedBillGoAreaFilters(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("collector_assignments")
    .select("area_id, sub_area_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  const areaIds = new Set<string>();
  const subAreaIds = new Set<string>();
  for (const item of data || []) {
    if (item.area_id) areaIds.add(item.area_id as string);
    if (item.sub_area_id) subAreaIds.add(item.sub_area_id as string);
  }

  return { areaIds, subAreaIds };
}

export function isBillGoSubscriptionInAssignedArea(
  subscription: { area_id?: string | null; sub_area_id?: string | null } | null | undefined,
  filters: { areaIds: Set<string>; subAreaIds: Set<string> },
) {
  if (!subscription) return false;
  if (subscription.sub_area_id && filters.subAreaIds.has(subscription.sub_area_id)) return true;
  if (subscription.area_id && filters.areaIds.has(subscription.area_id)) return true;
  return false;
}
