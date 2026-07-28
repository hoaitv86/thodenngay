"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVE_ROLE_COOKIE, resolvePostLoginDestination } from "@/lib/account-roles";

export default function RedirectPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      console.log("Checking profile in /redirect for ID:", user.id);
      const [{ data: profile, error: profileError }, { data: worker }, { data: userRoles }] = await Promise.all([
        supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single(),
        supabase
          .from("workers")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role, is_active")
          .eq("user_id", user.id),
      ]);

      if (profileError || !profile) {
        console.error("Profile not found in /redirect:", profileError);
        router.replace("/login");
        return;
      }

      console.log("Profile found in /redirect:", profile);
      router.replace(resolvePostLoginDestination({
        legacyRole: profile.role,
        worker,
        userRoles: userRoles || [],
        preferredRole: document.cookie
          .split("; ")
          .find((item) => item.startsWith(`${ACTIVE_ROLE_COOKIE}=`))
          ?.split("=")[1],
      }));
    };

    checkUser();
  }, [router, supabase]);

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
