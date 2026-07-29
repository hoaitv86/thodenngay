"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { defaultCmsPages, type CmsDisplayLocation, type CmsPost } from "@/lib/cms";

type CmsPlacementProps = {
  location: CmsDisplayLocation;
  title?: string;
  limit?: number;
  variant?: "cards" | "compact" | "banner" | "popup";
};

function fallbackPosts(location: CmsDisplayLocation, limit: number) {
  return defaultCmsPages
    .filter((page) => page.displayLocations.includes(location))
    .slice(0, limit)
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
      is_published: page.status === "published",
      sort_order: page.sortOrder,
    } satisfies CmsPost));
}

export function CmsPlacement({ location, title, limit = 3, variant = "cards" }: CmsPlacementProps) {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadPosts() {
      const { data, error } = await supabase
        .from("cms_posts")
        .select("id,slug,title,excerpt,content_html,cover_image_url,image_urls,display_locations,content_type,status,is_published,sort_order,published_at")
        .eq("is_published", true)
        .eq("status", "published")
        .contains("display_locations", [location])
        .order("sort_order", { ascending: true })
        .order("published_at", { ascending: false })
        .limit(limit);

      if (!mounted) return;
      if (error || !data?.length) setPosts(fallbackPosts(location, limit));
      else setPosts(data as CmsPost[]);
    }

    void loadPosts();
    return () => { mounted = false; };
  }, [location, limit, supabase]);

  if (posts.length === 0 || dismissed) return null;

  if (variant === "popup" || location === "popup") {
    const post = posts[0];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
        <div className="relative max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
          <button type="button" onClick={() => setDismissed(true)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high" aria-label="Close popup">
            <X size={16} />
          </button>
          {post.cover_image_url && <div className="relative mb-4 aspect-video overflow-hidden rounded-lg"><Image src={post.cover_image_url} alt="" fill sizes="512px" className="object-cover" unoptimized /></div>}
          <h2 className="pr-8 text-xl font-extrabold text-on-surface">{post.title}</h2>
          {post.excerpt && <p className="mt-2 text-sm leading-6 text-on-surface-variant">{post.excerpt}</p>}
          <Link href={"/" + post.slug} className="mt-4 inline-flex text-sm font-bold text-primary-container hover:text-primary">Xem chi ti?t</Link>
        </div>
      </div>
    );
  }

  if (variant === "banner" || location === "featured_notice") {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-primary/20 bg-primary-fixed px-4 py-3 text-primary-container shadow-sm">
          {posts.map((post) => (
            <Link key={post.id} href={"/" + post.slug} className="block font-bold hover:text-primary">
              {post.title}
              {post.excerpt && <span className="ml-2 font-medium text-on-surface-variant">{post.excerpt}</span>}
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (variant === "compact") {
    return (
      <section className="space-y-3">
        {title && <h2 className="text-lg font-extrabold text-on-surface">{title}</h2>}
        {posts.map((post) => (
          <Link key={post.id} href={"/" + post.slug} className="block rounded-lg border border-outline-variant/40 bg-white p-4 shadow-sm">
            <div className="font-bold text-on-surface">{post.title}</div>
            {post.excerpt && <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{post.excerpt}</p>}
          </Link>
        ))}
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {title && <h2 className="mb-5 text-2xl font-extrabold text-on-surface">{title}</h2>}
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((post) => (
          <Link key={post.id} href={"/" + post.slug} className="overflow-hidden rounded-lg border border-outline-variant/30 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-card-hover">
            {post.cover_image_url && <div className="relative aspect-video"><Image src={post.cover_image_url} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" unoptimized /></div>}
            <div className="p-4">
              <h3 className="font-extrabold text-on-surface">{post.title}</h3>
              {post.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-on-surface-variant">{post.excerpt}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
