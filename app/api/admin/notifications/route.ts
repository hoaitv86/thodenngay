import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-server";
import { getServiceRoleSupabase } from "@/lib/notifications/core";

type PatchBody = { id?: string; status?: "open" | "in_progress" | "resolved"; reason?: string | null };

export async function GET() {
  const adminCheck = await requireAdminPermission("analytics", "view");
  if (!adminCheck.ok) return adminCheck.response;

  const supabase = getServiceRoleSupabase();
  if (!supabase) return NextResponse.json({ notifications: [], stats: { open: 0, in_progress: 0, auto_resolved: 0, resolved: 0 }, error: "Missing service role" }, { status: 200 });

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, level, priority, status, job_id, target_url, resolution_reason, created_at, handled_at")
    .eq("audience", "admin")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ notifications: [], stats: { open: 0, in_progress: 0, auto_resolved: 0, resolved: 0 }, error: error.message }, { status: 200 });
  const notifications = data || [];
  const stats = notifications.reduce((acc, item) => {
    acc[item.status as keyof typeof acc] = (acc[item.status as keyof typeof acc] || 0) + 1;
    return acc;
  }, { open: 0, in_progress: 0, auto_resolved: 0, resolved: 0 });

  return NextResponse.json({ notifications, stats });
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAdminPermission("analytics", "manage");
  if (!adminCheck.ok) return adminCheck.response;

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  if (!body.id || !body.status) return NextResponse.json({ error: "Thieu id/status." }, { status: 400 });

  const supabase = getServiceRoleSupabase();
  if (!supabase) return NextResponse.json({ error: "Missing service role" }, { status: 500 });

  const { error } = await supabase
    .from("notifications")
    .update({ status: body.status, resolution_reason: body.reason || null, handled_by: adminCheck.user.id, handled_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("audience", "admin");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
