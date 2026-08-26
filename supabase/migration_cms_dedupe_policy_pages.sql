-- Merge legacy policy page slugs into the canonical footer URLs.

WITH pairs AS (
  SELECT * FROM (VALUES
    ('chinh-sach-tho', 'chinh-sach-danh-cho-tho'),
    ('chinh-sach-khach-hang', 'chinh-sach-danh-cho-khach-hang')
  ) AS pair(canonical_slug, legacy_slug)
), matched AS (
  SELECT
    pairs.canonical_slug,
    pairs.legacy_slug,
    canonical.id AS canonical_id,
    legacy.id AS legacy_id,
    canonical.excerpt AS canonical_excerpt,
    legacy.excerpt AS legacy_excerpt,
    canonical.content_html AS canonical_content_html,
    legacy.content_html AS legacy_content_html,
    canonical.cover_image_url AS canonical_cover_image_url,
    legacy.cover_image_url AS legacy_cover_image_url,
    canonical.image_urls AS canonical_image_urls,
    legacy.image_urls AS legacy_image_urls,
    canonical.display_locations AS canonical_display_locations,
    legacy.display_locations AS legacy_display_locations
  FROM pairs
  LEFT JOIN public.cms_posts canonical ON canonical.slug = pairs.canonical_slug
  LEFT JOIN public.cms_posts legacy ON legacy.slug = pairs.legacy_slug
), renamed AS (
  UPDATE public.cms_posts post
  SET
    slug = matched.canonical_slug,
    content_type = 'fixed_page',
    display_locations = ARRAY(
      SELECT DISTINCT location
      FROM unnest(COALESCE(matched.legacy_display_locations, '{}') || ARRAY['footer','app_info']::TEXT[]) AS location
    ),
    updated_at = NOW()
  FROM matched
  WHERE post.id = matched.legacy_id
    AND matched.legacy_id IS NOT NULL
    AND matched.canonical_id IS NULL
  RETURNING post.id
), merged AS (
  UPDATE public.cms_posts post
  SET
    excerpt = CASE
      WHEN length(COALESCE(matched.legacy_excerpt, '')) > length(COALESCE(matched.canonical_excerpt, '')) THEN matched.legacy_excerpt
      ELSE matched.canonical_excerpt
    END,
    content_html = CASE
      WHEN length(COALESCE(matched.legacy_content_html, '')) > length(COALESCE(matched.canonical_content_html, '')) THEN matched.legacy_content_html
      ELSE matched.canonical_content_html
    END,
    cover_image_url = COALESCE(matched.canonical_cover_image_url, matched.legacy_cover_image_url),
    image_urls = ARRAY(
      SELECT DISTINCT image_url
      FROM unnest(COALESCE(matched.canonical_image_urls, '{}') || COALESCE(matched.legacy_image_urls, '{}')) AS image_url
    ),
    display_locations = ARRAY(
      SELECT DISTINCT location
      FROM unnest(COALESCE(matched.canonical_display_locations, '{}') || COALESCE(matched.legacy_display_locations, '{}') || ARRAY['footer','app_info']::TEXT[]) AS location
    ),
    content_type = 'fixed_page',
    updated_at = NOW()
  FROM matched
  WHERE post.id = matched.canonical_id
    AND matched.canonical_id IS NOT NULL
    AND matched.legacy_id IS NOT NULL
  RETURNING matched.legacy_id
)
DELETE FROM public.cms_posts post
USING merged
WHERE post.id = merged.legacy_id;
