import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearSupabaseCookies();

  return NextResponse.redirect(new URL("/login", request.url));
}
