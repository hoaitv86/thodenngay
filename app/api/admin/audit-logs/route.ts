import { NextResponse } from "next/server";
import { createServiceSupabaseClient, requireAdmin } from "@/lib/admin-server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const service = createServiceSupabaseClient();
    const { data, error } = await service
      .from("admin_audit_logs")
      .select("id, actor_id, target_admin_id, action, module, summary, metadata, created_at, actor:profiles!actor_id(full_name, email), target:profiles!target_admin_id(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "Không thể tải nhật ký admin: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}
