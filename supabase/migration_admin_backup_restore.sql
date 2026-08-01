-- Super Admin database backup and restore manager.
-- Stores PostgreSQL snapshots in database tables instead of exporting JSON/CSV files.


CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.admin_database_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  table_count INTEGER NOT NULL DEFAULT 0,
  row_count BIGINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restored_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.admin_database_backup_tables (
  backup_id UUID NOT NULL REFERENCES public.admin_database_backups(id) ON DELETE CASCADE,
  schema_name TEXT NOT NULL DEFAULT 'public',
  table_name TEXT NOT NULL,
  ordinal_position INTEGER NOT NULL,
  row_count BIGINT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (backup_id, schema_name, table_name)
);

CREATE INDEX IF NOT EXISTS admin_database_backups_created_at_idx
  ON public.admin_database_backups(created_at DESC);

CREATE INDEX IF NOT EXISTS admin_database_backup_tables_backup_idx
  ON public.admin_database_backup_tables(backup_id, ordinal_position);

ALTER TABLE public.admin_database_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_database_backup_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins view database backups" ON public.admin_database_backups;
DROP POLICY IF EXISTS "Super admins view database backup tables" ON public.admin_database_backup_tables;

CREATE POLICY "Super admins view database backups" ON public.admin_database_backups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.status <> 'blocked'
        AND profiles.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins view database backup tables" ON public.admin_database_backup_tables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.status <> 'blocked'
        AND profiles.is_super_admin = TRUE
    )
  );

CREATE OR REPLACE FUNCTION public.create_admin_database_backup(
  p_label TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backup_id UUID := uuid_generate_v4();
  v_table_count INTEGER := 0;
  v_row_count BIGINT := 0;
  v_table_rows BIGINT := 0;
  v_payload JSONB := '[]'::jsonb;
  v_started_at TIMESTAMPTZ := clock_timestamp();
  v_table RECORD;
BEGIN
  INSERT INTO public.admin_database_backups (id, label, created_by, metadata)
  VALUES (
    v_backup_id,
    COALESCE(NULLIF(BTRIM(p_label), ''), 'Backup ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')),
    p_created_by,
    jsonb_build_object('source', 'postgresql', 'format', 'jsonb_table_snapshot')
  );

  FOR v_table IN
    SELECT
      table_schema,
      table_name,
      ROW_NUMBER() OVER (ORDER BY table_schema, table_name)::INTEGER AS ordinal_position
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('admin_database_backups', 'admin_database_backup_tables')
    ORDER BY table_schema, table_name
  LOOP
    EXECUTE FORMAT(
      'SELECT COALESCE(jsonb_agg(to_jsonb(src) ORDER BY to_jsonb(src)::text), ''[]''::jsonb), COUNT(*) FROM %I.%I AS src',
      v_table.table_schema,
      v_table.table_name
    )
    INTO v_payload, v_table_rows;

    INSERT INTO public.admin_database_backup_tables (
      backup_id,
      schema_name,
      table_name,
      ordinal_position,
      row_count,
      payload
    )
    VALUES (
      v_backup_id,
      v_table.table_schema,
      v_table.table_name,
      v_table.ordinal_position,
      v_table_rows,
      v_payload
    );

    v_table_count := v_table_count + 1;
    v_row_count := v_row_count + v_table_rows;
  END LOOP;

  UPDATE public.admin_database_backups
  SET
    table_count = v_table_count,
    row_count = v_row_count,
    metadata = metadata || jsonb_build_object(
      'duration_ms',
      ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started_at)) * 1000),
      'completed_at',
      NOW()
    )
  WHERE id = v_backup_id;

  RETURN v_backup_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_admin_database_backup(
  p_backup_id UUID,
  p_restored_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backup public.admin_database_backups%ROWTYPE;
  v_truncate_sql TEXT;
  v_table_count INTEGER := 0;
  v_row_count BIGINT := 0;
  v_started_at TIMESTAMPTZ := clock_timestamp();
  v_table RECORD;
BEGIN
  SELECT * INTO v_backup
  FROM public.admin_database_backups
  WHERE id = p_backup_id
    AND status = 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backup % was not found or is not restorable', p_backup_id;
  END IF;

  SELECT STRING_AGG(FORMAT('%I.%I', table_schema, table_name), ', ' ORDER BY table_schema, table_name)
  INTO v_truncate_sql
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN ('admin_database_backups', 'admin_database_backup_tables');

  IF v_truncate_sql IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || v_truncate_sql || ' RESTART IDENTITY CASCADE';
  END IF;

  FOR v_table IN
    WITH RECURSIVE backup_tables AS (
      SELECT
        b.schema_name,
        b.table_name,
        b.payload,
        b.row_count,
        c.oid
      FROM public.admin_database_backup_tables b
      JOIN pg_namespace n ON n.nspname = b.schema_name
      JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = b.table_name AND c.relkind = 'r'
      WHERE b.backup_id = p_backup_id
    ),
    fk_edges AS (
      SELECT
        con.conrelid AS child_oid,
        con.confrelid AS parent_oid
      FROM pg_constraint con
      JOIN backup_tables child ON child.oid = con.conrelid
      JOIN backup_tables parent ON parent.oid = con.confrelid
      WHERE con.contype = 'f'
        AND con.conrelid <> con.confrelid
    ),
    restore_depth AS (
      SELECT oid, 0 AS depth, ARRAY[oid] AS path
      FROM backup_tables
      UNION ALL
      SELECT fk.child_oid, restore_depth.depth + 1, restore_depth.path || fk.child_oid
      FROM restore_depth
      JOIN fk_edges fk ON fk.parent_oid = restore_depth.oid
      WHERE NOT fk.child_oid = ANY(restore_depth.path)
        AND restore_depth.depth < 50
    ),
    ordered_tables AS (
      SELECT oid, MAX(depth) AS depth
      FROM restore_depth
      GROUP BY oid
    )
    SELECT b.schema_name, b.table_name, b.payload, b.row_count
    FROM backup_tables b
    JOIN ordered_tables o ON o.oid = b.oid
    ORDER BY o.depth, b.schema_name, b.table_name
  LOOP
    IF jsonb_array_length(v_table.payload) > 0 THEN
      EXECUTE FORMAT(
        'INSERT INTO %I.%I OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_recordset(NULL::%I.%I, $1)',
        v_table.schema_name,
        v_table.table_name,
        v_table.schema_name,
        v_table.table_name
      )
      USING v_table.payload;
    END IF;

    v_table_count := v_table_count + 1;
    v_row_count := v_row_count + v_table.row_count;
  END LOOP;

  UPDATE public.admin_database_backups
  SET
    restored_by = p_restored_by,
    restored_at = NOW(),
    metadata = metadata || jsonb_build_object(
      'last_restore_duration_ms',
      ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started_at)) * 1000),
      'last_restored_at',
      NOW()
    )
  WHERE id = p_backup_id;

  RETURN jsonb_build_object(
    'backup_id',
    p_backup_id,
    'table_count',
    v_table_count,
    'row_count',
    v_row_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_database_backup(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_admin_database_backup(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_database_backup(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_admin_database_backup(UUID, UUID) TO service_role;