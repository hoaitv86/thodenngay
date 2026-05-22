-- 1. Update status constraint, add images column, and enable updates for workers on jobs
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'done', 'cancelled'));
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

DROP POLICY IF EXISTS "Workers update assigned jobs" ON public.jobs;
CREATE POLICY "Workers update assigned jobs" ON public.jobs FOR UPDATE USING (
    worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
);

-- 2. Ratings Table Policies (Enable public select, check auth for inserts)
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Anyone can view ratings" 
ON public.ratings FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Customers can insert ratings" ON public.ratings;
CREATE POLICY "Customers can insert ratings" 
ON public.ratings FOR INSERT 
WITH CHECK (auth.uid() = customer_id);

-- 3. Automatic worker rating & total jobs update trigger
CREATE OR REPLACE FUNCTION public.update_worker_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.workers
  SET 
    avg_rating = (
      SELECT ROUND(AVG(score)::numeric, 2)
      FROM public.ratings
      WHERE worker_id = NEW.worker_id
    ),
    total_jobs = (
      SELECT COUNT(DISTINCT job_id)
      FROM public.ratings
      WHERE worker_id = NEW.worker_id
    )
  WHERE id = NEW.worker_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_rating_inserted ON public.ratings;
CREATE TRIGGER on_rating_inserted
  AFTER INSERT ON public.ratings
  FOR EACH ROW EXECUTE PROCEDURE public.update_worker_rating();

-- 4. Create storage bucket & policies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('job-photos', 'job-photos', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'job-photos');

DROP POLICY IF EXISTS "Worker Upload" ON storage.objects;
CREATE POLICY "Worker Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'job-photos' AND auth.role() = 'authenticated');
