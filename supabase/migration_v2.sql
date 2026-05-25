-- ===== MIGRATION V2: Worker Approval Flow & Rating Improvements =====

-- 1. Add rejection_reason column to workers table
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Allow workers to view their OWN record (even if pending/blocked)
-- The existing "Public view active workers" policy only shows active workers
-- Workers need to see their own status to display pending/blocked screens
DROP POLICY IF EXISTS "Workers view own record" ON public.workers;
CREATE POLICY "Workers view own record" ON public.workers 
  FOR SELECT 
  USING (user_id = auth.uid());

-- 3. Ensure profiles table allows users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- 4. Add images column to ratings table for review photos
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- 5. Create storage bucket for rating photos (reuse existing policies pattern)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('rating-photos', 'rating-photos', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access Rating Photos" ON storage.objects;
CREATE POLICY "Public Access Rating Photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'rating-photos');

DROP POLICY IF EXISTS "Customer Upload Rating Photos" ON storage.objects;
CREATE POLICY "Customer Upload Rating Photos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'rating-photos' AND auth.role() = 'authenticated');

-- 6. Add status column to profiles table for block/unblock feature
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked'));

