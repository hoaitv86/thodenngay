-- Add business roles for worker unit members and allow owners to edit member roles.

UPDATE public.worker_unit_members
SET member_role = 'technician'
WHERE member_role IN ('lead_worker', 'assistant_worker', 'worker');

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.worker_unit_members'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%member_role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.worker_unit_members DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.worker_unit_members
  ALTER COLUMN member_role SET DEFAULT 'technician',
  ADD CONSTRAINT worker_unit_members_member_role_check
  CHECK (member_role IN ('owner', 'manager', 'technician', 'bill_collector', 'sales_inventory'));

CREATE OR REPLACE FUNCTION public.add_worker_unit_member_by_phone(
  p_unit_id UUID,
  p_phone TEXT,
  p_member_role TEXT DEFAULT 'technician',
  p_team_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  target_profile public.profiles;
  target_worker public.workers;
  created_member_id UUID;
  normalized_input_phone TEXT := public.normalize_phone(p_phone);
  safe_member_role TEXT := CASE
    WHEN p_member_role IN ('manager', 'technician', 'bill_collector', 'sales_inventory') THEN p_member_role
    WHEN p_member_role IN ('lead_worker', 'assistant_worker', 'worker') THEN 'technician'
    ELSE 'technician'
  END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_user_owns_unit(p_unit_id) THEN
    RAISE EXCEPTION 'Only the unit owner can add members';
  END IF;

  IF normalized_input_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  SELECT *
  INTO target_profile
  FROM public.profiles
  WHERE normalized_phone = normalized_input_phone
     OR public.normalize_phone(phone) = normalized_input_phone
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'No existing account found for this phone number';
  END IF;

  SELECT *
  INTO target_worker
  FROM public.workers
  WHERE user_id = target_profile.id
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (target_profile.id, 'customer', TRUE)
  ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

  IF safe_member_role IN ('technician', 'bill_collector', 'sales_inventory') THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_profile.id, 'worker', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  IF safe_member_role = 'manager' THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_profile.id, 'unit_owner', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  INSERT INTO public.worker_unit_members (
    unit_id,
    team_id,
    user_id,
    worker_id,
    member_role,
    status,
    invited_phone,
    invited_normalized_phone
  )
  VALUES (
    p_unit_id,
    p_team_id,
    target_profile.id,
    target_worker.id,
    safe_member_role,
    'active',
    p_phone,
    normalized_input_phone
  )
  ON CONFLICT (unit_id, user_id) DO UPDATE
    SET team_id = EXCLUDED.team_id,
        worker_id = EXCLUDED.worker_id,
        member_role = EXCLUDED.member_role,
        status = 'active',
        invited_phone = EXCLUDED.invited_phone,
        invited_normalized_phone = EXCLUDED.invited_normalized_phone
  RETURNING id INTO created_member_id;

  RETURN created_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.add_worker_unit_member_by_phone(UUID, TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_worker_unit_member_role(
  p_member_id UUID,
  p_member_role TEXT
)
RETURNS UUID AS $$
DECLARE
  target_member public.worker_unit_members;
  safe_member_role TEXT := CASE
    WHEN p_member_role IN ('manager', 'technician', 'bill_collector', 'sales_inventory') THEN p_member_role
    WHEN p_member_role IN ('lead_worker', 'assistant_worker', 'worker') THEN 'technician'
    ELSE NULL
  END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF safe_member_role IS NULL THEN
    RAISE EXCEPTION 'Invalid member role';
  END IF;

  SELECT *
  INTO target_member
  FROM public.worker_unit_members
  WHERE id = p_member_id;

  IF target_member.id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF target_member.member_role = 'owner' THEN
    RAISE EXCEPTION 'Owner role cannot be changed';
  END IF;

  IF NOT public.current_user_owns_unit(target_member.unit_id) THEN
    RAISE EXCEPTION 'Only the unit owner can update members';
  END IF;

  UPDATE public.worker_unit_members
  SET member_role = safe_member_role,
      updated_at = NOW()
  WHERE id = p_member_id
  RETURNING * INTO target_member;

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (target_member.user_id, 'customer', TRUE)
  ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

  IF safe_member_role IN ('technician', 'bill_collector', 'sales_inventory') THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_member.user_id, 'worker', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  IF safe_member_role = 'manager' THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_member.user_id, 'unit_owner', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  RETURN target_member.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_worker_unit_member_role(UUID, TEXT) TO authenticated;
