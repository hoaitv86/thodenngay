"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function RedirectPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // In a real app, we'd fetch the user's role from a 'profiles' table
      // For this MVP/Demo, we can check user metadata or just simulate
      const role = user.user_metadata?.role || "customer";

      if (role === "admin") {
        router.replace("/admin");
      } else if (role === "worker") {
        router.replace("/worker");
      } else {
        router.replace("/dashboard");
      }
    };

    checkUser();
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-fixed border-t-primary-container rounded-full animate-spin" />
        <p className="text-body-md text-on-surface-variant animate-pulse">
          Đang chuyển hướng...
        </p>
      </div>
    </div>
  );
}
