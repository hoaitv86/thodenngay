"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

      console.log("Checking profile in /redirect for ID:", user.id);
      // Fetch role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error("Profile not found in /redirect:", profileError);
        router.replace("/login");
        return;
      }

      console.log("Profile found in /redirect:", profile);
      const role = profile.role;

      if (role === "admin") {
        router.replace("/admin/dashboard");
      } else if (role === "worker") {
        router.replace("/worker");
      } else {
        router.replace("/customer/home");
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
