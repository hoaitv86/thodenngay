import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronRight, Search, ShieldCheck, Sparkles } from "lucide-react";
import JourneyHeader from "@/app/hanh-trinh/JourneyHeader";
import { getHelpViewer, listVisibleHelpContent } from "@/lib/help-server";
import { helpAudienceLabels, type HelpArticle } from "@/lib/help";

export const dynamic = "force-dynamic";

type HelpIndexPageProps = {
  searchParams: Promise<{ q?: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "Mới cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function ArticleCard({ article, compact = false }: { article: HelpArticle; compact?: boolean }) {
  return (
    <Link
      href={`/huong-dan/${article.slug}`}
      className="group grid min-w-0 gap-3 rounded-lg border border-outline-variant bg-white p-4 shadow-card transition-all hover:border-primary/30 hover:shadow-card-hover sm:grid-cols-[8rem_1fr]"
    >
      <div className={`relative overflow-hidden rounded-lg bg-primary-fixed ${compact ? "hidden sm:block sm:aspect-square" : "aspect-video sm:aspect-square"}`}>
        {article.cover_image_url ? (
          <Image src={article.cover_image_url} alt="" fill sizes="160px" className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary-container">
            <BookOpen size={30} />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {article.category?.title && <span className="badge badge-assigned">{article.category.title}</span>}
          {article.is_featured && <span className="badge badge-active">Nổi bật</span>}
        </div>
        <h3 className="mt-2 text-base font-bold leading-snug text-on-surface group-hover:text-primary-container">{article.title}</h3>
        {article.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">{article.description}</p>}
        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-on-surface-variant">
          <span>{formatDate(article.published_at || article.updated_at || article.created_at)}</span>
          <span className="inline-flex items-center gap-1 text-primary">
            Xem
            <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function HelpIndexPage({ searchParams }: HelpIndexPageProps) {
  const { q } = await searchParams;
  const [viewer, content] = await Promise.all([getHelpViewer(), listVisibleHelpContent(q)]);
  const query = q?.trim() || "";
  const categoryArticleCounts = new Map<string, number>();

  content.articles.forEach((article) => {
    if (article.category_id) categoryArticleCounts.set(article.category_id, (categoryArticleCounts.get(article.category_id) || 0) + 1);
  });

  const featuredArticles = content.articles.filter((article) => article.is_featured).slice(0, 3);
  const newestArticles = [...content.articles]
    .sort((a, b) => new Date(b.published_at || b.updated_at || b.created_at || 0).getTime() - new Date(a.published_at || a.updated_at || a.created_at || 0).getTime())
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-surface-container-low text-on-surface">
      <JourneyHeader />

      <section className="bg-primary-container text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1fr_22rem] lg:px-8">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase text-white/90">
              <Sparkles size={14} />
              Hướng dẫn sử dụng
            </span>
            <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">Hướng dẫn theo đúng vai trò của bạn</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/82 sm:text-base">
              Nội dung tự mở theo tài khoản hiện tại. Khi được nâng cấp thành Thợ, Quản lý hoặc Admin, các mục hướng dẫn tương ứng sẽ xuất hiện tại đây.
            </p>
          </div>
          <div className="rounded-lg border border-white/18 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-primary-container">
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{viewer.displayName}</p>
                <p className="text-xs font-semibold text-white/70">{viewer.isAdmin ? "Admin xem toàn bộ nội dung" : "Nội dung đang được lọc bằng quyền thật"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {viewer.audiences.map((audience) => (
                <span key={audience} className="rounded-full bg-white/14 px-3 py-1 text-xs font-bold text-white">
                  {helpAudienceLabels[audience]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <form className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" />
          <input name="q" defaultValue={query} className="input-field h-13 pl-12" placeholder="Tìm hướng dẫn theo công việc, BillGo, QR, tài khoản..." />
        </form>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-[18rem_1fr] lg:px-8">
        <aside className="space-y-3">
          <h2 className="text-sm font-bold uppercase text-on-surface-variant">Danh mục phù hợp</h2>
          {content.categories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant bg-white p-4 text-sm font-semibold text-on-surface-variant">Chưa có danh mục khả dụng.</div>
          ) : (
            <div className="space-y-2">
              {content.categories.map((category) => (
                <a key={category.id} href={`#${category.slug}`} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-white px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:border-primary/30 hover:bg-primary-fixed/40">
                  <span className="truncate">{category.title}</span>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">{categoryArticleCounts.get(category.id) || 0}</span>
                </a>
              ))}
            </div>
          )}
        </aside>

        <div className="min-w-0 space-y-8">
          {content.articles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant bg-white p-8 text-center shadow-card">
              <BookOpen className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 text-xl font-bold text-on-surface">Chưa có bài hướng dẫn phù hợp</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">Admin có thể đăng bài trong khu quản lý hướng dẫn. Khi bài được Published và chọn đúng đối tượng, nội dung sẽ tự xuất hiện ở đây.</p>
            </div>
          ) : (
            <>
              {featuredArticles.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-xl font-bold text-on-surface">Bài nổi bật</h2>
                  <div className="grid gap-3 xl:grid-cols-3">
                    {featuredArticles.map((article) => <ArticleCard key={article.id} article={article} compact />)}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-on-surface">{query ? "Kết quả tìm kiếm" : "Mới cập nhật"}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {newestArticles.map((article) => <ArticleCard key={article.id} article={article} />)}
                </div>
              </section>

              {content.categories.map((category) => {
                const articles = content.articles.filter((article) => article.category_id === category.id);
                if (articles.length === 0) return null;
                return (
                  <section key={category.id} id={category.slug} className="scroll-mt-20 space-y-3">
                    <div>
                      <h2 className="text-xl font-bold text-on-surface">{category.title}</h2>
                      {category.description && <p className="mt-1 text-sm text-on-surface-variant">{category.description}</p>}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {articles.map((article) => <ArticleCard key={article.id} article={article} compact />)}
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
