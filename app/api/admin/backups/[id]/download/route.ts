import { NextResponse } from "next/server";
import { createServiceSupabaseClient, logAdminAction, requireAdmin } from "@/lib/admin-server";

type DownloadRouteContext = {
  params: Promise<{ id: string }>;
};

type BackupHeader = {
  id: string;
  label: string;
  status: "completed" | "failed";
  table_count: number;
  row_count: number;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type BackupTable = {
  schema_name: string;
  table_name: string;
  ordinal_position: number;
  row_count: number;
  payload: unknown[];
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Khong xac dinh");

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function makeSafeFilename(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "backup";
}

function buildDataOnlySql(backup: BackupHeader, tables: BackupTable[]) {
  const lines: string[] = [
    "-- Tho Den Ngay data-only SQL backup export.",
    "-- This file is generated from admin_database_backups JSONB snapshots.",
    "-- It is NOT a full PostgreSQL dump: it does not include roles, grants, extensions, policies, triggers, indexes, or schema DDL.",
    "-- Restore only into a database that already has a compatible schema.",
    "-- The script intentionally does not include DROP, TRUNCATE, or DELETE statements.",
    `-- Backup id: ${backup.id}`,
    `-- Label: ${backup.label}`,
    `-- Created at: ${backup.created_at}`,
    `-- Tables: ${backup.table_count}`,
    `-- Rows: ${backup.row_count}`,
    "",
    "BEGIN;",
    "SET CONSTRAINTS ALL DEFERRED;",
    "",
  ];

  for (const table of tables) {
    const qualifiedTable = `${quoteIdentifier(table.schema_name)}.${quoteIdentifier(table.table_name)}`;
    lines.push(`-- ${qualifiedTable}: ${table.row_count} rows`);

    if (!Array.isArray(table.payload) || table.payload.length === 0) {
      lines.push(`-- No rows for ${qualifiedTable}.`, "");
      continue;
    }

    lines.push(
      `INSERT INTO ${qualifiedTable} OVERRIDING SYSTEM VALUE`,
      `SELECT * FROM jsonb_populate_recordset(NULL::${qualifiedTable}, ${quoteLiteral(JSON.stringify(table.payload))}::jsonb);`,
      "",
    );
  }

  lines.push("COMMIT;", "");
  return lines.join("\n");
}

export async function GET(_request: Request, { params }: DownloadRouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!auth.profile.is_super_admin) {
    return NextResponse.json({ error: "Chi Super Admin duoc tai backup SQL." }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Thieu ma backup." }, { status: 400 });
  }

  try {
    const service = createServiceSupabaseClient();
    const { data: backup, error: backupError } = await service
      .from("admin_database_backups")
      .select("id, label, status, table_count, row_count, created_at, metadata")
      .eq("id", id)
      .single();

    if (backupError || !backup) {
      return NextResponse.json({ error: "Khong tim thay backup." }, { status: 404 });
    }

    if (backup.status !== "completed") {
      return NextResponse.json({ error: "Chi backup hoan tat moi co the tai SQL." }, { status: 409 });
    }

    const { data: tables, error: tablesError } = await service
      .from("admin_database_backup_tables")
      .select("schema_name, table_name, ordinal_position, row_count, payload")
      .eq("backup_id", id)
      .order("ordinal_position", { ascending: true });

    if (tablesError) {
      return NextResponse.json({ error: "Khong the tai du lieu backup: " + tablesError.message }, { status: 500 });
    }

    const sql = buildDataOnlySql(backup as BackupHeader, (tables || []) as BackupTable[]);
    const filename = `${makeSafeFilename(backup.label)}-${backup.id.slice(0, 8)}-data-only.sql`;

    await logAdminAction(service, {
      actorId: auth.profile.id,
      action: "database.backup_download",
      module: "security",
      summary: `Tai backup SQL data-only ${backup.label || id}`,
      metadata: {
        backupId: id,
        tableCount: backup.table_count,
        rowCount: backup.row_count,
        format: "data_only_sql",
      },
    });

    return new Response(sql, {
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: "Loi he thong: " + getErrorMessage(error) }, { status: 500 });
  }
}
