-- Notification Core V1: shared inbox, preferences, push queue, admin workflow, and account email outbox.
-- Safe to run on an existing database: V1 columns are added with IF NOT EXISTS before indexes, policies, and triggers reference them.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('worker', 'customer', 'admin')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'success', 'warning', 'critical')),
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'auto_resolved', 'resolved')),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_url TEXT,
  dedupe_key TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution_reason TEXT,
  handled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'customer';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'system';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Thong bao';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body TEXT DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 50;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS resolution_reason TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS handled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.notifications ALTER COLUMN audience SET DEFAULT 'customer';
ALTER TABLE public.notifications ALTER COLUMN type SET DEFAULT 'system';
ALTER TABLE public.notifications ALTER COLUMN title SET DEFAULT 'Thong bao';
ALTER TABLE public.notifications ALTER COLUMN body SET DEFAULT '';
ALTER TABLE public.notifications ALTER COLUMN level SET DEFAULT 'info';
ALTER TABLE public.notifications ALTER COLUMN priority SET DEFAULT 50;
ALTER TABLE public.notifications ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE public.notifications ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.notifications ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.notifications SET audience = 'customer' WHERE audience IS NULL;
UPDATE public.notifications SET type = 'system' WHERE type IS NULL;
UPDATE public.notifications SET title = 'Thong bao' WHERE title IS NULL;
UPDATE public.notifications SET body = '' WHERE body IS NULL;
UPDATE public.notifications SET level = 'info' WHERE level IS NULL;
UPDATE public.notifications SET priority = 50 WHERE priority IS NULL;
UPDATE public.notifications SET status = 'open' WHERE status IS NULL;
UPDATE public.notifications SET metadata = '{}'::jsonb WHERE metadata IS NULL;
UPDATE public.notifications SET created_at = NOW() WHERE created_at IS NULL;
UPDATE public.notifications SET updated_at = NOW() WHERE updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_audience_v1_check'
  ) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_audience_v1_check CHECK (audience IN ('worker', 'customer', 'admin')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_level_v1_check'
  ) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_level_v1_check CHECK (level IN ('info', 'success', 'warning', 'critical')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_status_v1_check'
  ) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_status_v1_check CHECK (status IN ('open', 'in_progress', 'auto_resolved', 'resolved')) NOT VALID;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uidx ON public.notifications(dedupe_key);
CREATE INDEX IF NOT EXISTS notifications_target_inbox_idx ON public.notifications(target_user_id, read_at, created_at DESC) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_admin_status_idx ON public.notifications(audience, status, priority DESC, created_at DESC) WHERE audience = 'admin';
CREATE INDEX IF NOT EXISTS notifications_job_idx ON public.notifications(job_id, type);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('worker', 'customer', 'admin')),
  category TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100,
  quiet_start TIME,
  quiet_end TIME,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, audience, category)
);

CREATE TABLE IF NOT EXISTS public.notification_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_push_subscriptions_user_active_idx
  ON public.notification_push_subscriptions(user_id, is_active)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.notification_delivery_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'email', 'sms', 'zalo')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  not_before TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_delivery_queue_pending_idx ON public.notification_delivery_queue(status, not_before, expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.notification_dispatch_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_email_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_email TEXT,
  template TEXT NOT NULL CHECK (template IN ('customer_welcome', 'worker_pending', 'worker_approved', 'worker_rejected')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_dispatch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (target_user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Users update own notification reads" ON public.notifications;
CREATE POLICY "Users update own notification reads" ON public.notifications FOR UPDATE USING (target_user_id = auth.uid() OR public.is_admin()) WITH CHECK (target_user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences" ON public.notification_preferences FOR ALL USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Users view own push subscriptions" ON public.notification_push_subscriptions;
CREATE POLICY "Users view own push subscriptions" ON public.notification_push_subscriptions FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage push subscriptions" ON public.notification_push_subscriptions;
CREATE POLICY "Admins manage push subscriptions" ON public.notification_push_subscriptions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins view notification queue" ON public.notification_delivery_queue;
CREATE POLICY "Admins view notification queue" ON public.notification_delivery_queue FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admins view dispatch history" ON public.notification_dispatch_history;
CREATE POLICY "Admins view dispatch history" ON public.notification_dispatch_history FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admins view email outbox" ON public.notification_email_outbox;
CREATE POLICY "Admins view email outbox" ON public.notification_email_outbox FOR SELECT USING (public.is_admin());

DROP TRIGGER IF EXISTS update_notification_push_subscriptions_updated_at ON public.notification_push_subscriptions;
CREATE TRIGGER update_notification_push_subscriptions_updated_at BEFORE UPDATE ON public.notification_push_subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_notification_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.resolution_reason IS DISTINCT FROM NEW.resolution_reason) THEN
    INSERT INTO public.notification_dispatch_history(notification_id, job_id, actor_id, action, reason, metadata)
    VALUES (NEW.id, NEW.job_id, NEW.handled_by, 'status_changed', NEW.resolution_reason, jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_notification_status_change_trigger ON public.notifications;
CREATE TRIGGER log_notification_status_change_trigger AFTER UPDATE ON public.notifications FOR EACH ROW EXECUTE PROCEDURE public.log_notification_status_change();

CREATE OR REPLACE FUNCTION public.auto_resolve_job_notifications()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.worker_id IS NOT NULL AND NEW.status IN ('assigned','in_progress','completed','done') THEN
      UPDATE public.notifications
      SET status = 'auto_resolved', resolution_reason = 'job_has_worker_or_completed', handled_at = NOW()
      WHERE job_id = NEW.id AND audience = 'admin' AND status IN ('open','in_progress') AND type IN ('job_unassigned_risk','customer_job_created');
    END IF;

    IF NEW.status IN ('completed','done','cancelled') THEN
      UPDATE public.notifications
      SET status = 'auto_resolved', resolution_reason = 'job_terminal_state', handled_at = NOW()
      WHERE job_id = NEW.id AND status IN ('open','in_progress') AND type IN ('job_late_risk','worker_cancel_requested');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_resolve_job_notifications_trigger ON public.jobs;
CREATE TRIGGER auto_resolve_job_notifications_trigger AFTER UPDATE ON public.jobs FOR EACH ROW EXECUTE PROCEDURE public.auto_resolve_job_notifications();

CREATE OR REPLACE FUNCTION public.skip_expired_notification_push()
RETURNS INTEGER AS $$
DECLARE
  skipped_count INTEGER;
BEGIN
  UPDATE public.notification_delivery_queue
  SET status = 'skipped', last_error = 'expired_before_delivery'
  WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= NOW();
  GET DIAGNOSTICS skipped_count = ROW_COUNT;
  RETURN skipped_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.skip_expired_notification_push() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enqueue_customer_morning_reminders()
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  WITH eligible_customers AS (
    SELECT profile.id
    FROM public.profiles profile
    WHERE profile.role = 'customer'
      AND NOT EXISTS (
        SELECT 1
        FROM public.jobs job
        WHERE job.customer_id = profile.id
          AND job.status IN ('pending', 'assigned', 'in_progress', 'cancel_requested')
      )
  ), inserted_notifications AS (
    INSERT INTO public.notifications (
      target_user_id, audience, type, title, body, level, priority, target_url, dedupe_key, expires_at, metadata
    )
    SELECT
      customer.id,
      'customer',
      'customer_morning_reminder',
      'Hom nay ban can lam gi?',
      'Hay goi Tho Den Ngay nhe!',
      'info',
      30,
      '/customer/booking',
      customer.id::text || ':customer_morning_reminder:' || CURRENT_DATE::text,
      NOW() + INTERVAL '16 hours',
      jsonb_build_object('source', 'morning_reminder')
    FROM eligible_customers customer
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id, target_user_id, title, body, target_url, expires_at
  )
  INSERT INTO public.notification_delivery_queue (notification_id, target_user_id, channel, title, body, target_url, expires_at)
  SELECT id, target_user_id, 'push', title, body, target_url, expires_at
  FROM inserted_notifications;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.enqueue_customer_morning_reminders() FROM PUBLIC;
