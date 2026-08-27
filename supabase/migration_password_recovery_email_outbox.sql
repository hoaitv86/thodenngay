ALTER TABLE public.notification_email_outbox
DROP CONSTRAINT IF EXISTS notification_email_outbox_template_check;

ALTER TABLE public.notification_email_outbox
ADD CONSTRAINT notification_email_outbox_template_check
CHECK (template IN ('customer_welcome', 'worker_pending', 'worker_approved', 'worker_rejected', 'password_recovery'));
