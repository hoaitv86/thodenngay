import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, CalendarDays } from "lucide-react";
import JourneyHeader from "../hanh-trinh/JourneyHeader";
import { stripHtml, type CmsPost } from "@/lib/cms";

export const revalidate = 300;
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatCmsDate(value?: string | null) {
  if (!value) return "Đang cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

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

  return null;
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
    <main className="min-h-screen bg-surface-container-low text-on-surface">
      <JourneyHeader />

      <section className="relative overflow-hidden bg-primary-container text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(253,224,71,0.18),transparent_24%),radial-gradient(circle_at_72%_26%,rgba(56,189,248,0.25),transparent_28%),linear-gradient(112deg,#043a9f_0%,#075edb_52%,#0878ff_100%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-white/86 hover:text-white">
            <ArrowLeft size={16} />
            Trang chủ
          </Link>
          <div className="mt-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white/92 backdrop-blur">
              <CalendarDays size={16} className="text-secondary" />
              {formatCmsDate(post.updated_at || post.published_at || post.created_at)}
            </span>
            <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{post.title}</h1>
            {post.excerpt && <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-white/82 sm:text-lg">{post.excerpt}</p>}
          </div>
        </div>
      </section>

      {post.cover_image_url && (
        <div className="relative h-[260px] w-full overflow-hidden sm:h-[360px]">
          <Image src={post.cover_image_url} alt={post.title} fill priority sizes="100vw" className="object-cover" unoptimized />
        </div>
      )}

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
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
