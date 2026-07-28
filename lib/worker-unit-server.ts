import type { SupabaseClient } from "@supabase/supabase-js";
import { isWorkerUnitMemberRole, type WorkerUnitMemberRole } from "@/lib/worker-unit-permissions";

type MembershipRow = {
  member_role?: string | null;
  unit?: {
    id?: string | null;
    owner_id?: string | null;
  } | Array<{
    id?: string | null;
    owner_id?: string | null;
  }> | null;
};

export type WorkerUnitScope = {
  userId: string;
  selfWorkerId: string;
  scopedWorkerId: string;
  unitId: string | null;
  unitOwnerId: string;
  role: WorkerUnitMemberRole | "worker";
};

const rolePriority: WorkerUnitMemberRole[] = ["owner", "manager", "technician", "bill_collector", "sales_inventory"];

function firstUnit(row: MembershipRow) {
  return Array.isArray(row.unit) ? row.unit[0] : row.unit;
}

export async function resolveWorkerUnitScope(
  db: SupabaseClient,
  userId: string,
  selfWorkerId: string,
): Promise<WorkerUnitScope> {
  const { data: memberships } = await db
    .from("worker_unit_members")
    .select("member_role, unit:worker_units(id, owner_id)")
    .eq("user_id", userId)
    .eq("status", "active");

  const rows = ((memberships || []) as MembershipRow[]).filter((row) => isWorkerUnitMemberRole(row.member_role));
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

  return {
    userId,
    selfWorkerId,
    scopedWorkerId,
    unitId: unit?.id || null,
    unitOwnerId,
    role,
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
