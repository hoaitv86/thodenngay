import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import JourneyHeader from "./JourneyHeader";
import { getPublishedJourneyPosts } from "@/lib/journey-server";
import { stripJourneyHtml } from "@/lib/journey";

export const revalidate = 300;
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hành trình | Thợ Đến Ngay",
  description: "Những cột mốc phát triển của Thợ Đến Ngay.",
};

function formatJourneyDate(value?: string | null) {
  if (!value) return "Đang cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default async function JourneyPage() {
  const posts = await getPublishedJourneyPosts();

  return (
    <main className="min-h-screen bg-surface-container-low text-on-surface">
      <JourneyHeader />

      <section className="relative overflow-hidden bg-primary-container text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(253,224,71,0.18),transparent_24%),radial-gradient(circle_at_76%_20%,rgba(56,189,248,0.28),transparent_28%),linear-gradient(112deg,#043a9f_0%,#075edb_50%,#0878ff_100%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/16 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-extrabold text-white shadow-sm backdrop-blur">
              <Sparkles size={16} className="text-secondary" />
              Hành trình Thợ Đến Ngay
            </span>
            <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Từng bước xây dựng một mạng lưới thợ đáng tin cậy
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/82 sm:text-lg">
              Theo dõi các cột mốc, kế hoạch và định hướng phát triển của Thợ Đến Ngay. Nội dung được quản lý trực tiếp từ Admin và Supabase.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="section-eyebrow">Cột mốc công khai</span>
            <h2 className="mt-3 text-3xl font-extrabold text-on-surface sm:text-4xl">Danh sách Hành trình</h2>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-container hover:text-primary">
            Về trang chủ
            <ArrowRight size={16} />
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
              <CalendarDays size={24} />
            </div>
            <h3 className="mt-4 text-xl font-extrabold text-on-surface">Chưa có bài Hành trình công khai</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface-variant">
              Khi Admin công khai bài viết trong module Hành trình, danh sách sẽ tự hiển thị tại đây.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post, index) => (
              <Link
                key={post.id}
                href={"/hanh-trinh/" + post.slug}
                className="group flex min-h-[260px] flex-col justify-between rounded-lg border border-outline-variant/30 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-black text-on-secondary">
                      Chặng {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
                      <CalendarDays size={14} />
                      {formatJourneyDate(post.updated_at || post.created_at)}
                    </span>
                  </div>
                  <h3 className="mt-5 text-2xl font-black leading-tight text-on-surface group-hover:text-primary-container">
                    {post.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-on-surface-variant">
                    {post.summary || stripJourneyHtml(post.content).slice(0, 180)}
                  </p>
                </div>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-primary-container">
                  Xem chi tiết
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
