import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, PlayCircle } from "lucide-react";
import JourneyHeader from "@/app/hanh-trinh/JourneyHeader";
import { getVisibleHelpArticle } from "@/lib/help-server";
import { getYoutubeEmbedUrl, stripHelpHtml } from "@/lib/help";

export const dynamic = "force-dynamic";

type HelpArticlePageProps = {
  params: Promise<{ slug: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "Đang cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export async function generateMetadata({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const article = await getVisibleHelpArticle(slug);

  if (!article) return { title: "Không tìm thấy hướng dẫn" };

  const description = article.description || stripHelpHtml(article.content_html).slice(0, 155);
  return {
    title: `${article.title} | Hướng dẫn Thợ Đến Ngay`,
    description,
    openGraph: {
      title: article.title,
      description,
      images: article.cover_image_url ? [article.cover_image_url] : undefined,
    },
  };
}

export default async function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const article = await getVisibleHelpArticle(slug);
  if (!article) notFound();

  const embedUrl = getYoutubeEmbedUrl(article.video_url);

  return (
    <main className="min-h-screen bg-surface-container-low text-on-surface">
      <JourneyHeader />

      <section className="bg-primary-container text-white">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <Link href="/huong-dan" className="inline-flex items-center gap-2 text-sm font-bold text-white/86 hover:text-white">
            <ArrowLeft size={16} />
            Hướng dẫn sử dụng
          </Link>
          <div className="mt-7 flex flex-wrap items-center gap-2">
            {article.category?.title && <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-bold text-white">{article.category.title}</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/14 px-3 py-1 text-xs font-bold text-white">
              <CalendarDays size={14} />
              {formatDate(article.published_at || article.updated_at || article.created_at)}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl">{article.title}</h1>
          {article.description && <p className="mt-4 max-w-3xl text-base font-semibold leading-8 text-white/82">{article.description}</p>}
        </div>
      </section>

      {article.cover_image_url && (
        <div className="relative h-[240px] w-full overflow-hidden sm:h-[340px]">
          <Image src={article.cover_image_url} alt={article.title} fill priority sizes="100vw" className="object-cover" unoptimized />
        </div>
      )}

      <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {embedUrl && (
          <div className="mb-6 overflow-hidden rounded-lg border border-outline-variant bg-black shadow-card">
            <div className="relative aspect-video">
              <iframe
                src={embedUrl}
                title={article.title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-on-surface">
              <PlayCircle size={18} className="text-primary" />
              Video hướng dẫn
            </div>
          </div>
        )}

        <div className="cms-editor rounded-lg border border-outline-variant bg-white p-5 text-base leading-8 text-on-surface shadow-card sm:p-8" dangerouslySetInnerHTML={{ __html: article.content_html || "<p></p>" }} />

        {article.image_urls?.length ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {article.image_urls.map((url) => (
              <div key={url} className="relative aspect-video overflow-hidden rounded-lg border border-outline-variant bg-white">
                <Image src={url} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        ) : null}
      </article>
    </main>
  );
}
