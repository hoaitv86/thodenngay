-- Account email delivery with Resend-backed dispatcher.
-- Keeps old queued rows deliverable while moving new rows to pending.

ALTER TABLE public.notification_email_outbox
ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.notification_email_outbox
DROP CONSTRAINT IF EXISTS notification_email_outbox_status_check;

ALTER TABLE public.notification_email_outbox
ADD CONSTRAINT notification_email_outbox_status_check
CHECK (status IN ('pending', 'queued', 'sent', 'failed'));

ALTER TABLE public.notification_email_outbox
ALTER COLUMN status SET DEFAULT 'pending';

UPDATE public.notification_email_outbox
SET next_attempt_at = created_at
WHERE next_attempt_at IS NULL;

CREATE INDEX IF NOT EXISTS notification_email_outbox_dispatch_idx
ON public.notification_email_outbox(status, next_attempt_at, attempts, created_at)
WHERE status IN ('pending', 'queued', 'failed');
