import { NextResponse } from "next/server";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

type PreferenceInput = { audience?: "worker" | "customer" | "admin"; category?: string; enabled?: boolean; priority?: number };

export async function GET() {
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Khong duoc phep truy cap." }, { status: 401 });

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("audience, category, enabled, priority, quiet_start, quiet_end, updated_at")
    .eq("user_id", user.id)
    .order("priority", { ascending: true });

  if (error) return NextResponse.json({ preferences: [], error: error.message }, { status: 200 });
  return NextResponse.json({ preferences: data || [] });
}

export async function PUT(request: Request) {
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Khong duoc phep truy cap." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { preferences?: PreferenceInput[] };
  const rows = (body.preferences || []).filter((item) => item.audience && item.category).map((item, index) => ({
    user_id: user.id,
    audience: item.audience,
    category: item.category,
    enabled: item.enabled !== false,
    priority: Number.isFinite(item.priority) ? item.priority : index + 1,
  }));

  if (rows.length === 0) return NextResponse.json({ ok: true });
  const { error } = await supabase.from("notification_preferences").upsert(rows, { onConflict: "user_id,audience,category" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
