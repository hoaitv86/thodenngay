import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_ROLE_COOKIE, resolvePostLoginDestination } from "@/lib/account-roles";
import { createClient } from "@/lib/supabase/server";

export default async function RedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: worker }, { data: userRoles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
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

  if (!profile) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  redirect(
    resolvePostLoginDestination({
      legacyRole: profile.role,
      worker,
      userRoles: userRoles || [],
      preferredRole: cookieStore.get(ACTIVE_ROLE_COOKIE)?.value,
    })
  );
}
