"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { defaultCmsPages, defaultCmsSlugs, type CmsPost } from "@/lib/cms";

type CmsInfoLinksProps = {
  className?: string;
  compact?: boolean;
};

function fallbackInfoPages() {
  return defaultCmsPages
    .filter((page) => page.contentType === "fixed_page" && page.status === "published" && page.displayLocations.includes("app_info"))
    .map((page) => ({
      id: page.slug,
      slug: page.slug,
      title: page.title,
      excerpt: page.excerpt,
      content_html: page.contentHtml,
      cover_image_url: null,
      image_urls: [],
      display_locations: page.displayLocations,
      content_type: page.contentType,
      status: page.status,
      is_published: true,
      sort_order: page.sortOrder,
    } satisfies CmsPost));
}

function mergeInfoPages(dbPages: CmsPost[] | null | undefined) {
  const canonicalSlugs = new Set(defaultCmsSlugs);
  const pages = (dbPages || []).filter((page) => canonicalSlugs.has(page.slug));
  const existingSlugs = new Set(pages.map((page) => page.slug));

  for (const page of fallbackInfoPages()) {
    if (!existingSlugs.has(page.slug)) {
      pages.push(page);
    }
  }

  return pages.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.title.localeCompare(b.title, "vi"));
}

export function CmsInfoLinks({ className = "", compact = false }: CmsInfoLinksProps) {
  const supabase = useMemo(() => createClient(), []);
  const [pages, setPages] = useState<CmsPost[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadPages() {
      const { data, error } = await supabase
        .from("cms_posts")
        .select("id,slug,title,excerpt,content_html,cover_image_url,image_urls,display_locations,content_type,status,is_published,sort_order,updated_at")
        .eq("is_published", true)
        .eq("status", "published")
        .eq("content_type", "fixed_page")
        .contains("display_locations", ["app_info"])
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

      if (!mounted) return;
      setPages(error ? fallbackInfoPages() : mergeInfoPages(data as CmsPost[] | null));
    }

    void loadPages();
    return () => { mounted = false; };
  }, [supabase]);

  if (pages.length === 0) return null;

  return (
    <section className={className}>
      <h2 className={compact ? "px-1 pb-2 text-[11px] font-extrabold uppercase tracking-wide text-on-surface-variant/70" : "mb-2 text-xs font-extrabold uppercase tracking-wide text-white/65"}>
        {"Thông tin"}
      </h2>
      <div className={compact ? "grid grid-cols-1 gap-2" : "space-y-1"}>
        {pages.map((page) => (
          <Link
            key={page.id}
            href={"/" + page.slug}
            className={compact
              ? "block rounded-lg border border-outline-variant/25 bg-white px-3 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              : "block rounded-lg px-4 py-2 text-xs font-bold text-white/72 transition-colors hover:bg-white/10 hover:text-white"}
          >
            {page.title}
          </Link>
        ))}
      </div>
    </section>
  );
}
