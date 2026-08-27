ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS recovery_email TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'requested_role', NEW.raw_user_meta_data->>'role', 'customer');
  phone_value TEXT := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone);
  worker_specs TEXT[] := '{}';
BEGIN
  INSERT INTO public.profiles (id, email, recovery_email, phone, normalized_phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'recovery_email', ''))), ''),
    phone_value,
    public.normalize_phone(phone_value),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nguoi dung'),
    CASE WHEN requested_role = 'admin' THEN 'admin' ELSE 'customer' END
  );

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (NEW.id, 'customer', TRUE)
  ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

  IF requested_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (NEW.id, 'admin', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;

  IF requested_role = 'worker' THEN
    IF NEW.raw_user_meta_data ? 'specialties' AND NEW.raw_user_meta_data->'specialties' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'specialties') = 'array' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'specialties')) INTO worker_specs;
    END IF;

    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (NEW.id, 'worker', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

    INSERT INTO public.workers (user_id, status, specialties)
    VALUES (NEW.id, 'pending', worker_specs);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
