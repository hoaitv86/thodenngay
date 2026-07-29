import { NextResponse } from "next/server";
import { createServiceSupabaseClient, getAdminPermissions, requireAdmin } from "@/lib/admin-server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const service = createServiceSupabaseClient();
    const permissions = await getAdminPermissions(service, auth.profile.id, auth.profile.is_super_admin);
    return NextResponse.json({
      admin: auth.profile,
      permissions,
      isSuperAdmin: Boolean(auth.profile.is_super_admin),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Không thể tải phân quyền admin: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}
