import { NextResponse } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACTION_BLOCK_MESSAGE, isDemoAccount } from "@/lib/demo-accounts";
import { canManageWorkerUnit } from "@/lib/worker-unit-permissions";
import { getAssignedBillGoAreaFilters, resolveWorkerUnitScope, type WorkerUnitScope } from "@/lib/worker-unit-server";

type WorkerContext = {
  db: SupabaseClient;
  userId: string;
  workerId: string;
  isAdmin: boolean;
  isDemo: boolean;
  scope: WorkerUnitScope;
};

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const asText = (value: unknown) => String(value || "").trim();
const asNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const getAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const getContext = async (): Promise<WorkerContext | NextResponse> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Bạn chưa đăng nhập.", 401);

  const [{ data: profile }, { data: worker }] = await Promise.all([
    supabase.from("profiles").select("role, phone, email").eq("id", user.id).single(),
    supabase.from("workers").select("id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!worker && profile?.role !== "admin") return jsonError("Không tìm thấy hồ sơ thợ.", 403);

  const db = getAdmin() || supabase;
  const scope = await resolveWorkerUnitScope(db, user.id, worker?.id || "");

  return {
    db,
    userId: user.id,
    workerId: worker?.id || "",
    isAdmin: profile?.role === "admin",
    isDemo: isDemoAccount(profile),
    scope,
  };
};

export async function GET() {
  const context = await getContext();
  if (context instanceof NextResponse) return context;
  const { db, userId, isAdmin, scope } = context;

  const { data: areas, error } = await db
    .from("areas")
    .select("id, name, area_type, owner_id, is_active, sort_order, sub_areas(id, area_id, name, sub_area_type, is_active, sort_order)")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return jsonError(error.message);

  const { data: assignments } = await db
    .from("collector_assignments")
    .select("area_id, sub_area_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  const assignedAreaIds = new Set((assignments || []).map(item => item.area_id).filter(Boolean));
  const assignedSubAreaIds = new Set((assignments || []).map(item => item.sub_area_id).filter(Boolean));
  const assignedFilters = await getAssignedBillGoAreaFilters(db, userId);
  assignedFilters.areaIds.forEach(id => assignedAreaIds.add(id));
  assignedFilters.subAreaIds.forEach(id => assignedSubAreaIds.add(id));

  const visibleAreas = isAdmin || canManageWorkerUnit(scope.role)
    ? (areas || []).filter(area => isAdmin || !area.owner_id || area.owner_id === scope.unitOwnerId || area.owner_id === userId)
    : (areas || [])
        .map(area => {
          const subAreas = (area.sub_areas || []).filter(subArea => assignedSubAreaIds.has(subArea.id));
          if (assignedAreaIds.has(area.id)) return area;
          if (subAreas.length > 0) return { ...area, sub_areas: subAreas };
          return null;
        })
        .filter(Boolean);

  return NextResponse.json({ areas: visibleAreas });
}

export async function POST(request: Request) {
  const context = await getContext();
  if (context instanceof NextResponse) return context;
  if (context.isDemo) return jsonError(DEMO_ACTION_BLOCK_MESSAGE, 403);
  const { db, userId, scope } = context;
  if (!canManageWorkerUnit(scope.role)) return jsonError("B?n kh?ng c? quy?n qu?n l? ??a b?n c?a ??n v?.", 403);
  const body = await request.json();
  const action = asText(body.action);

  if (action === "area") {
    const name = asText(body.name);
    if (!name) return jsonError("Vui lòng nhập tên xã/phường/thị trấn.");
    const { data, error } = await db
      .from("areas")
      .insert({
        name,
        area_type: asText(body.areaType) || "commune",
        owner_id: scope.unitOwnerId,
        sort_order: asNumber(body.sortOrder),
        is_active: body.isActive !== false,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) return jsonError(error.message);
    return NextResponse.json({ id: data.id }, { status: 201 });
  }

  if (action === "sub_area") {
    const areaId = asText(body.areaId);
    const name = asText(body.name);
    if (!areaId || !name) return jsonError("Vui lòng chọn xã và nhập tên xóm.");
    const { data: allowedArea } = await db
      .from("areas")
      .select("id")
      .eq("id", areaId)
      .eq("owner_id", scope.unitOwnerId)
      .maybeSingle();
    if (!allowedArea) return jsonError("B?n kh?ng c? quy?n t?o x?m/th?n trong ??a b?n n?y.", 403);

    const { data, error } = await db
      .from("sub_areas")
      .insert({
        area_id: areaId,
        name,
        sub_area_type: asText(body.subAreaType) || "village",
        sort_order: asNumber(body.sortOrder),
        is_active: body.isActive !== false,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) return jsonError(error.message);
    return NextResponse.json({ id: data.id }, { status: 201 });
  }

  if (action === "assignment") {
    const userId = asText(body.userId);
    const areaId = asText(body.areaId) || null;
    const subAreaId = asText(body.subAreaId) || null;
    if (!userId || (!areaId && !subAreaId)) return jsonError("Vui lòng nhập người thu và địa bàn.");
    const { data, error } = await db
      .from("collector_assignments")
      .insert({
        user_id: userId,
        area_id: areaId,
        sub_area_id: subAreaId,
        is_active: body.isActive !== false,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) return jsonError(error.message);
    return NextResponse.json({ id: data.id }, { status: 201 });
  }

  return jsonError("Hành động địa bàn không hợp lệ.");
}

export async function PATCH(request: Request) {
  const context = await getContext();
  if (context instanceof NextResponse) return context;
  if (context.isDemo) return jsonError(DEMO_ACTION_BLOCK_MESSAGE, 403);
  const { db, scope } = context;
  if (!canManageWorkerUnit(scope.role)) return jsonError("B?n kh?ng c? quy?n s?a ??a b?n c?a ??n v?.", 403);
  const body = await request.json();
  const action = asText(body.action);
  const id = asText(body.id);
  if (!id) return jsonError("Thiếu mã địa bàn.");

  if (action === "area") {
    const { error } = await db
      .from("areas")
      .update({
        name: asText(body.name),
        sort_order: asNumber(body.sortOrder),
        is_active: body.isActive !== false,
      })
      .eq("id", id)
      .eq("owner_id", scope.unitOwnerId);
    if (error) return jsonError(error.message);
    return NextResponse.json({ ok: true });
  }

  if (action === "sub_area") {
    const nextAreaId = asText(body.areaId);
    const { data: currentSubArea } = await db
      .from("sub_areas")
      .select("id, area_id, area:areas!sub_areas_area_id_fkey(owner_id)")
      .eq("id", id)
      .maybeSingle();
    const currentSubAreaRow = currentSubArea as { area_id?: string | null; area?: { owner_id?: string | null } | Array<{ owner_id?: string | null }> | null } | null;
    const currentOwnerId = Array.isArray(currentSubAreaRow?.area) ? currentSubAreaRow?.area[0]?.owner_id : currentSubAreaRow?.area?.owner_id;
    if (!currentSubArea || currentOwnerId !== scope.unitOwnerId) return jsonError("B?n kh?ng c? quy?n s?a x?m/th?n n?y.", 403);
    if (nextAreaId && nextAreaId !== currentSubAreaRow?.area_id) {
      const { data: nextArea } = await db
        .from("areas")
        .select("id")
        .eq("id", nextAreaId)
        .eq("owner_id", scope.unitOwnerId)
        .maybeSingle();
      if (!nextArea) return jsonError("B?n kh?ng c? quy?n chuy?n x?m/th?n sang ??a b?n n?y.", 403);
    }

    const { error } = await db
      .from("sub_areas")
      .update({
        area_id: nextAreaId || undefined,
        name: asText(body.name),
        sort_order: asNumber(body.sortOrder),
        is_active: body.isActive !== false,
      })
      .eq("id", id);
    if (error) return jsonError(error.message);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Hành động địa bàn không hợp lệ.");
}
