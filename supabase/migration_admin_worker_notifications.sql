-- Broadcast notifications from admins to all active workers.
-- Run this in the Supabase SQL Editor before using /admin/notifications.

CREATE TABLE IF NOT EXISTS public.admin_worker_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'success', 'warning')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_worker_notification_reads (
  notification_id UUID REFERENCES public.admin_worker_notifications(id) ON DELETE CASCADE NOT NULL,
  worker_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, worker_user_id)
);

CREATE INDEX IF NOT EXISTS admin_worker_notifications_active_idx
  ON public.admin_worker_notifications(is_active, published_at DESC);

CREATE INDEX IF NOT EXISTS admin_worker_notification_reads_user_idx
  ON public.admin_worker_notification_reads(worker_user_id, read_at DESC);

ALTER TABLE public.admin_worker_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_worker_notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage worker notifications" ON public.admin_worker_notifications;
CREATE POLICY "Admins manage worker notifications"
  ON public.admin_worker_notifications
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Workers view active admin notifications" ON public.admin_worker_notifications;
CREATE POLICY "Workers view active admin notifications"
  ON public.admin_worker_notifications
  FOR SELECT
  USING (
    is_active = TRUE
    AND published_at <= NOW()
    AND EXISTS (
      SELECT 1
      FROM public.workers
      WHERE workers.user_id = auth.uid()
        AND workers.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins view worker notification reads" ON public.admin_worker_notification_reads;
CREATE POLICY "Admins view worker notification reads"
  ON public.admin_worker_notification_reads
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Workers manage own notification reads" ON public.admin_worker_notification_reads;
CREATE POLICY "Workers manage own notification reads"
  ON public.admin_worker_notification_reads
  FOR ALL
  USING (worker_user_id = auth.uid())
  WITH CHECK (
    worker_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.workers
      WHERE workers.user_id = auth.uid()
        AND workers.status = 'active'
    )
  );

DROP TRIGGER IF EXISTS update_admin_worker_notifications_updated_at ON public.admin_worker_notifications;
CREATE TRIGGER update_admin_worker_notifications_updated_at
  BEFORE UPDATE ON public.admin_worker_notifications
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
