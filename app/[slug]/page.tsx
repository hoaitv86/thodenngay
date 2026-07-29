import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft } from "lucide-react";
import { defaultCmsPages, stripHtml, type CmsPost } from "@/lib/cms";

export const revalidate = 300;
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const getPublicSupabase = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

async function getCmsPost(slug: string) {
  const fallback = defaultCmsPages.find((page) => page.slug === slug);

  try {
    const { data, error } = await getPublicSupabase()
      .from("cms_posts")
      .select("id,slug,title,excerpt,content_html,cover_image_url,image_urls,display_locations,content_type,status,is_published,sort_order,created_at,updated_at,published_at")
      .eq("slug", slug)
      .eq("is_published", true)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.warn("Could not load CMS page:", error.message);
    }

    if (data) return data as CmsPost;
  } catch (error) {
    console.warn("Could not connect to CMS:", error);
  }

  if (!fallback) return null;

  return {
    id: fallback.slug,
    slug: fallback.slug,
    title: fallback.title,
    excerpt: fallback.excerpt,
    content_html: fallback.contentHtml,
    cover_image_url: null,
    image_urls: [],
    display_locations: fallback.displayLocations,
    content_type: fallback.contentType,
    status: fallback.status,
    is_published: fallback.status === "published",
    sort_order: fallback.sortOrder,
  } satisfies CmsPost;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = await getCmsPost(slug);

  if (!post) {
    return {
      title: "Không tìm thấy nội dung",
    };
  }

  return {
    title: `${post.title} | Thợ Đến Ngay`,
    description: post.excerpt || stripHtml(post.content_html).slice(0, 155),
    openGraph: {
      title: post.title,
      description: post.excerpt || stripHtml(post.content_html).slice(0, 155),
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  };
}

export default async function CmsPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getCmsPost(slug);

  if (!post) notFound();

  return (
    <main className="min-h-screen bg-surface-container-low">
      <section className="border-b border-outline-variant/40 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-primary-container hover:text-primary">
            <ArrowLeft size={16} />
            Trang chủ
          </Link>
        </div>
      </section>

      {post.cover_image_url && (
        <div className="relative h-[260px] w-full overflow-hidden sm:h-[360px]">
          <Image src={post.cover_image_url} alt={post.title} fill priority sizes="100vw" className="object-cover" unoptimized />
        </div>
      )}

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="mb-3 text-sm font-extrabold uppercase tracking-widest text-primary-container">Thợ Đến Ngay</div>
          <h1 className="text-4xl font-extrabold leading-tight text-on-surface sm:text-5xl">{post.title}</h1>
          {post.excerpt && <p className="mt-4 max-w-3xl text-lg leading-8 text-on-surface-variant">{post.excerpt}</p>}
        </div>

        <div
          className="cms-editor rounded-lg border border-outline-variant/30 bg-white p-5 text-base leading-8 text-on-surface shadow-card sm:p-8"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />

        {post.image_urls?.length ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {post.image_urls.map((url) => (
              <div key={url} className="relative aspect-video overflow-hidden rounded-lg border border-outline-variant/30 bg-white">
                <Image src={url} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        ) : null}
      </article>
    </main>
  );
}
