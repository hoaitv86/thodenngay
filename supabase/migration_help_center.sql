-- Role-aware help center for /huong-dan. Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.help_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.help_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES public.help_categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  audiences TEXT[] NOT NULL DEFAULT '{PUBLIC}' CHECK (
    audiences <@ ARRAY['PUBLIC','CUSTOMER','WORKER','MANAGER','OWNER','ADMIN']::TEXT[]
  ),
  help_context TEXT UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS help_categories_active_sort_idx
  ON public.help_categories (is_active, sort_order, title);

CREATE INDEX IF NOT EXISTS help_articles_status_sort_idx
  ON public.help_articles (status, is_featured, sort_order, published_at);

CREATE INDEX IF NOT EXISTS help_articles_slug_idx
  ON public.help_articles (slug);

CREATE INDEX IF NOT EXISTS help_articles_audiences_idx
  ON public.help_articles USING GIN (audiences);

CREATE OR REPLACE FUNCTION public.current_help_audiences()
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT[] := ARRAY['PUBLIC'];
  profile_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN result;
  END IF;

  result := array_append(result, 'CUSTOMER');

  SELECT role INTO profile_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF profile_role = 'worker'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND is_active = TRUE
        AND role IN ('worker', 'lead_worker', 'assistant_worker')
    )
    OR EXISTS (
      SELECT 1
      FROM public.worker_unit_members
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  THEN
    result := array_append(result, 'WORKER');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND is_active = TRUE
      AND role = 'unit_owner'
  )
  OR EXISTS (
    SELECT 1
    FROM public.worker_unit_members
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND member_role = 'manager'
  )
  THEN
    result := array_cat(result, ARRAY['WORKER','MANAGER']);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.worker_unit_members
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND member_role = 'owner'
  )
  THEN
    result := array_cat(result, ARRAY['WORKER','MANAGER','OWNER']);
  END IF;

  IF profile_role = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND is_active = TRUE
        AND role = 'admin'
    )
  THEN
    result := ARRAY['PUBLIC','CUSTOMER','WORKER','MANAGER','OWNER','ADMIN'];
  END IF;

  RETURN ARRAY(SELECT DISTINCT value FROM unnest(result) AS value);
END;
$$;

ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage help categories" ON public.help_categories;
CREATE POLICY "Admins manage help categories"
  ON public.help_categories
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Visible help categories" ON public.help_categories;
CREATE POLICY "Visible help categories"
  ON public.help_categories
  FOR SELECT
  USING (
    is_active = TRUE
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.help_articles article
        WHERE article.category_id = help_categories.id
          AND article.status = 'published'
          AND article.audiences && public.current_help_audiences()
      )
    )
  );

DROP POLICY IF EXISTS "Admins manage help articles" ON public.help_articles;
CREATE POLICY "Admins manage help articles"
  ON public.help_articles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Audience view published help articles" ON public.help_articles;
CREATE POLICY "Audience view published help articles"
  ON public.help_articles
  FOR SELECT
  USING (
    public.is_admin()
    OR (
      status = 'published'
      AND audiences && public.current_help_audiences()
    )
  );

DROP TRIGGER IF EXISTS update_help_categories_updated_at ON public.help_categories;
CREATE TRIGGER update_help_categories_updated_at
  BEFORE UPDATE ON public.help_categories
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_help_articles_updated_at ON public.help_articles;
CREATE TRIGGER update_help_articles_updated_at
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
