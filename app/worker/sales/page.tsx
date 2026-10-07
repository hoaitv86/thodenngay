"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkerSalesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/worker/inventory?section=sales");
  }, [router]);

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center bg-surface p-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
    </div>
  );
}
