import { NextResponse } from "next/server";
import { createServiceSupabaseClient, logAdminAction, requireAdmin } from "@/lib/admin-server";

type RestoreRouteContext = {
  params: Promise<{ id: string }>;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Khong xac dinh");

export async function POST(_request: Request, { params }: RestoreRouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!auth.profile.is_super_admin) {
    return NextResponse.json({ error: "Chi Super Admin duoc khoi phuc du lieu." }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Thieu ma backup." }, { status: 400 });
  }

  try {
    const service = createServiceSupabaseClient();
    const { data: backup } = await service
      .from("admin_database_backups")
      .select("id, label, table_count, row_count")
      .eq("id", id)
      .single();

    const { data: result, error: rpcError } = await service.rpc("restore_admin_database_backup", {
      p_backup_id: id,
      p_restored_by: auth.profile.id,
    });

    if (rpcError) {
      return NextResponse.json(
        {
          error:
            "Khong the khoi phuc backup PostgreSQL. Hay kiem tra migration va rang buoc du lieu. " +
            rpcError.message,
        },
        { status: 500 },
      );
    }

    await logAdminAction(service, {
      actorId: auth.profile.id,
      action: "database.restore",
      module: "security",
      summary: `Khoi phuc backup PostgreSQL ${backup?.label || id}`,
      metadata: {
        backupId: id,
        tableCount: backup?.table_count,
        rowCount: backup?.row_count,
        result,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    return NextResponse.json({ error: "Loi he thong: " + getErrorMessage(error) }, { status: 500 });
  }
}
