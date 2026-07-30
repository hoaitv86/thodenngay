import { NextResponse } from "next/server";
import { createServiceSupabaseClient, logAdminAction, requireAdmin } from "@/lib/admin-server";

type CreateBackupBody = {
  label?: string;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Khong xac dinh");

async function requireSuperAdmin() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (!auth.profile.is_super_admin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Chi Super Admin duoc sao luu va khoi phuc du lieu." }, { status: 403 }),
    };
  }

  return auth;
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const service = createServiceSupabaseClient();
    const { data, error } = await service
      .from("admin_database_backups")
      .select("id, label, status, table_count, row_count, created_at, restored_at, metadata, creator:profiles!created_by(full_name, email), restorer:profiles!restored_by(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      return NextResponse.json({ error: "Khong the tai danh sach backup: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ backups: data || [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: "Loi he thong: " + getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateBackupBody;
    const label = body.label?.trim() || null;
    const service = createServiceSupabaseClient();

    const { data: backupId, error: rpcError } = await service.rpc("create_admin_database_backup", {
      p_label: label,
      p_created_by: auth.profile.id,
    });

    if (rpcError || !backupId) {
      return NextResponse.json(
        {
          error:
            "Khong the tao backup PostgreSQL. Hay kiem tra da chay supabase/migration_admin_backup_restore.sql. " +
            (rpcError?.message || ""),
        },
        { status: 500 },
      );
    }

    const { data: backup } = await service
      .from("admin_database_backups")
      .select("id, label, status, table_count, row_count, created_at, restored_at, metadata, creator:profiles!created_by(full_name, email), restorer:profiles!restored_by(full_name, email)")
      .eq("id", backupId)
      .single();

    await logAdminAction(service, {
      actorId: auth.profile.id,
      action: "database.backup",
      module: "security",
      summary: `Tao backup PostgreSQL ${backup?.label || backupId}`,
      metadata: {
        backupId,
        tableCount: backup?.table_count,
        rowCount: backup?.row_count,
      },
    });

    return NextResponse.json({ success: true, backup });
  } catch (error: unknown) {
    return NextResponse.json({ error: "Loi he thong: " + getErrorMessage(error) }, { status: 500 });
  }
}
