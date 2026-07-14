import { NextResponse } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type WorkerContext = {
  admin: SupabaseClient;
  userId: string;
  workerId: string;
  isAdmin: boolean;
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
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("workers").select("id").eq("user_id", user.id).maybeSingle(),
  ]);

  const admin = getAdmin();
  if (!admin) return jsonError("Máy chủ chưa cấu hình SUPABASE_SERVICE_ROLE_KEY.", 500);
  if (!worker && profile?.role !== "admin") return jsonError("Không tìm thấy hồ sơ thợ.", 403);

  return { admin, userId: user.id, workerId: worker?.id || "", isAdmin: profile?.role === "admin" };
};

export async function GET() {
  const context = await getContext();
  if (context instanceof NextResponse) return context;
  const { admin, userId, isAdmin } = context;

  const { data: areas, error } = await admin
    .from("areas")
    .select("id, name, area_type, owner_id, is_active, sort_order, sub_areas(id, area_id, name, sub_area_type, is_active, sort_order)")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return jsonError(error.message);

  const { data: assignments } = await admin
    .from("collector_assignments")
    .select("area_id, sub_area_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  const assignedAreaIds = new Set((assignments || []).map(item => item.area_id).filter(Boolean));
  const assignedSubAreaIds = new Set((assignments || []).map(item => item.sub_area_id).filter(Boolean));

  const visibleAreas = isAdmin
    ? areas || []
    : (areas || []).filter(area =>
        area.owner_id === userId
        || assignedAreaIds.has(area.id)
        || (area.sub_areas || []).some((subArea: { id: string }) => assignedSubAreaIds.has(subArea.id))
      );

  return NextResponse.json({ areas: visibleAreas });
}

export async function POST(request: Request) {
  const context = await getContext();
  if (context instanceof NextResponse) return context;
  const { admin, userId } = context;
  const body = await request.json();
  const action = asText(body.action);

  if (action === "area") {
    const name = asText(body.name);
    if (!name) return jsonError("Vui lòng nhập tên xã/phường/thị trấn.");
    const { data, error } = await admin
      .from("areas")
      .insert({
        name,
        area_type: asText(body.areaType) || "commune",
        owner_id: userId,
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
    const { data, error } = await admin
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
    const { data, error } = await admin
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
  const { admin } = context;
  const body = await request.json();
  const action = asText(body.action);
  const id = asText(body.id);
  if (!id) return jsonError("Thiếu mã địa bàn.");

  if (action === "area") {
    const { error } = await admin
      .from("areas")
      .update({
        name: asText(body.name),
        sort_order: asNumber(body.sortOrder),
        is_active: body.isActive !== false,
      })
      .eq("id", id);
    if (error) return jsonError(error.message);
    return NextResponse.json({ ok: true });
  }

  if (action === "sub_area") {
    const { error } = await admin
      .from("sub_areas")
      .update({
        area_id: asText(body.areaId) || undefined,
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
