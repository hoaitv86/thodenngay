"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Clock,
  User,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/worker/jobs", label: "Việc mới", icon: Briefcase },
  { href: "/worker/history", label: "Lịch sử", icon: Clock },
  { href: "/worker/profile", label: "Hồ sơ", icon: User },
];

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-surface relative">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-primary px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center">
            <Wrench className="w-4 h-4 text-on-secondary" />
          </div>
          <div>
            <span className="font-bold text-on-primary text-body-sm">Alo Thợ</span>
            <span className="block text-[10px] text-on-primary/60 -mt-0.5">Thợ</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-success/20 text-success text-label-sm rounded-full font-medium">
            ● Online
          </span>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/20 z-30">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
