-- Add display locations and multiple images to CMS articles

ALTER TABLE public.cms_posts
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS display_locations TEXT[] NOT NULL DEFAULT '{footer}';

CREATE INDEX IF NOT EXISTS cms_posts_display_locations_idx
  ON public.cms_posts USING GIN (display_locations);

UPDATE public.cms_posts
SET display_locations = CASE slug
  WHEN 've-chung-toi' THEN ARRAY['footer','app_info']::TEXT[]
  WHEN 'dieu-khoan-su-dung' THEN ARRAY['footer','app_info']::TEXT[]
  WHEN 'chinh-sach-bao-mat' THEN ARRAY['footer','app_info']::TEXT[]
  WHEN 'chinh-sach-tho' THEN ARRAY['footer','app_info']::TEXT[]
  WHEN 'chinh-sach-khach-hang' THEN ARRAY['footer','app_info']::TEXT[]
  ELSE display_locations
END
WHERE slug IN ('ve-chung-toi','dieu-khoan-su-dung','chinh-sach-bao-mat','chinh-sach-tho','chinh-sach-khach-hang');
