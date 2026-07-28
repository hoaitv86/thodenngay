import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ROLE_COOKIE } from "@/lib/account-roles";

const clearSupabaseCookies = async () => {
  const cookieStore = await cookies();
  cookieStore
    .getAll()
    .filter((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
    .forEach((cookie) => {
      cookieStore.delete(cookie.name);
    });
};

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearSupabaseCookies();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ROLE_COOKIE);

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearSupabaseCookies();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ROLE_COOKIE);

  return NextResponse.redirect(new URL("/login", request.url));
}
