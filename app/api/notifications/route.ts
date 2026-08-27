import { NextResponse } from "next/server";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

type MarkReadBody = { notificationIds?: string[]; all?: boolean };

export async function GET() {
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Khong duoc phep truy cap." }, { status: 401 });

  const { data, error } = await supabase
    .from("notifications")
    .select("id, audience, type, title, body, level, priority, status, job_id, worker_id, customer_id, target_url, created_at, read_at, expires_at, metadata")
    .eq("target_user_id", user.id)
    .is("dismissed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message, notifications: [], unreadCount: 0 }, { status: 200 });
  const notifications = data || [];
  return NextResponse.json({ notifications, unreadCount: notifications.filter((item) => !item.read_at).length });
}

export async function PATCH(request: Request) {
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Khong duoc phep truy cap." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as MarkReadBody;
  const now = new Date().toISOString();
  let query = supabase.from("notifications").update({ read_at: now }).eq("target_user_id", user.id).is("read_at", null);
  if (!body.all) {
    const ids = Array.isArray(body.notificationIds) ? body.notificationIds.filter(Boolean) : [];
    if (ids.length === 0) return NextResponse.json({ ok: true });
    query = query.in("id", ids);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
