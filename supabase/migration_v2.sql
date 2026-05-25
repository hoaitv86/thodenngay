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
