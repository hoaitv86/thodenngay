import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import JourneyHeader from "../JourneyHeader";
import { getPublishedJourneyPosts } from "@/lib/journey-server";
import { stripJourneyHtml } from "@/lib/journey";

export const revalidate = 300;
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatJourneyDate(value?: string | null) {
  if (!value) return "Đang cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

async function getJourneyState(slug: string) {
  const posts = await getPublishedJourneyPosts();
  const currentIndex = posts.findIndex((post) => post.slug === slug);

  if (currentIndex < 0) return null;

  return {
    post: posts[currentIndex],
    previousPost: posts[currentIndex - 1] || null,
    nextPost: posts[currentIndex + 1] || null,
  };
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const state = await getJourneyState(slug);

  if (!state) {
    return {
      title: "Không tìm thấy Hành trình",
    };
  }

  return {
    title: state.post.title + " | Hành trình Thợ Đến Ngay",
    description: state.post.summary || stripJourneyHtml(state.post.content).slice(0, 155),
  };
}

export default async function JourneyDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const state = await getJourneyState(slug);

  if (!state) notFound();

  const { post, previousPost, nextPost } = state;

  return (
    <main className="min-h-screen bg-surface-container-low text-on-surface">
      <JourneyHeader />

      <section className="relative overflow-hidden bg-primary-container text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(253,224,71,0.18),transparent_24%),radial-gradient(circle_at_72%_26%,rgba(56,189,248,0.25),transparent_28%),linear-gradient(112deg,#043a9f_0%,#075edb_52%,#0878ff_100%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <Link href="/hanh-trinh" className="inline-flex items-center gap-2 text-sm font-extrabold text-white/86 hover:text-white">
            <ArrowLeft size={16} />
            Quay lại Hành trình
          </Link>
          <div className="mt-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white/92 backdrop-blur">
              <CalendarDays size={16} className="text-secondary" />
              {formatJourneyDate(post.updated_at || post.created_at)}
            </span>
            <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{post.title}</h1>
            {post.summary && <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-white/82 sm:text-lg">{post.summary}</p>}
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div
          className="cms-editor rounded-lg border border-outline-variant/30 bg-white p-5 text-base leading-8 text-on-surface shadow-card sm:p-8"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {previousPost ? (
            <Link href={"/hanh-trinh/" + previousPost.slug} className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-card">
              <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
                <ArrowLeft size={14} />
                Bài trước
              </span>
              <div className="mt-2 text-base font-black text-primary-container">{previousPost.title}</div>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant/40 bg-white/70 p-4 text-sm font-semibold text-on-surface-variant">Đây là bài đầu tiên.</div>
          )}

          {nextPost ? (
            <Link href={"/hanh-trinh/" + nextPost.slug} className="rounded-lg border border-outline-variant/30 bg-white p-4 text-right shadow-sm transition-all hover:border-primary/30 hover:shadow-card">
              <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
                Bài tiếp theo
                <ArrowRight size={14} />
              </span>
              <div className="mt-2 text-base font-black text-primary-container">{nextPost.title}</div>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant/40 bg-white/70 p-4 text-right text-sm font-semibold text-on-surface-variant">Đây là bài mới nhất.</div>
          )}
        </div>
      </article>
    </main>
  );
}
