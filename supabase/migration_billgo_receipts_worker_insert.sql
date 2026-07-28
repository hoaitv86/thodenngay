-- Allow workers to create BillGo receipts when the server runs without service-role credentials.
-- Safe to run multiple times after supabase/migration_billgo_receipts.sql.

ALTER TABLE public.billgo_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers create own BillGo receipts" ON public.billgo_receipts;
CREATE POLICY "Workers create own BillGo receipts"
ON public.billgo_receipts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.billgo_receivables receivable
    JOIN public.workers worker ON worker.id = receivable.worker_id
    WHERE receivable.id = billgo_receipts.receivable_id
      AND receivable.worker_id = billgo_receipts.worker_id
      AND worker.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.payments payment
    WHERE payment.id = billgo_receipts.payment_id
      AND payment.receivable_id = billgo_receipts.receivable_id
      AND payment.status = 'paid'
      AND payment.collected_by = auth.uid()
  )
);
