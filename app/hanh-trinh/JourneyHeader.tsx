import Link from "next/link";
import { LogoIcon } from "@/app/components/icons";

export default function JourneyHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant/20 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4 lg:h-[72px]">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <LogoIcon size={40} />
            <span className="truncate text-xl font-extrabold text-primary-container sm:text-2xl">Thợ Đến Ngay</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link href="/#services" className="text-sm font-bold text-on-surface-variant transition-colors hover:text-primary-container">
              Dịch vụ
            </Link>
            <Link href="/#how-it-works" className="text-sm font-bold text-on-surface-variant transition-colors hover:text-primary-container">
              Cách hoạt động
            </Link>
            <Link href="/hanh-trinh" className="text-sm font-extrabold text-primary-container">
              Hành trình
            </Link>
            <Link href="/#reviews" className="text-sm font-bold text-on-surface-variant transition-colors hover:text-primary-container">
              Đánh giá
            </Link>
            <Link href="/#download-app" className="text-sm font-bold text-on-surface-variant transition-colors hover:text-primary-container">
              Tải app
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-outline-variant/45 bg-white px-3 py-2 text-sm font-extrabold text-primary-container shadow-sm transition-all hover:border-primary/35 hover:bg-primary-fixed/50 sm:min-w-32 sm:px-5">
              Đăng nhập
            </Link>
            <Link href="/register" className="hidden min-h-10 items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-extrabold !text-white shadow-sm transition-all hover:bg-primary-container sm:inline-flex sm:min-w-32">
              Đăng ký
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
