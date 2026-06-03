-- Allow workers to request job cancellation and admins to approve it.

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (
  status IN (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'done',
    'cancel_requested',
    'cancelled'
  )
);

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cancellation_reviewed_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cancellation_reviewed_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cancellation_review_note TEXT;
