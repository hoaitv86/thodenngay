import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ACCOUNTS, type DemoRole } from "@/lib/demo-accounts";

const isDemoRole = (role: unknown): role is DemoRole => role === "customer" || role === "worker";

export async function POST(request: Request) {
  try {
    const { role } = await request.json();

    if (!isDemoRole(role)) {
      return NextResponse.json({ error: "Tai khoan demo khong hop le." }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Vui long cau hinh SUPABASE_SERVICE_ROLE_KEY trong file .env.local." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const demoAccount = DEMO_ACCOUNTS[role];
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, role")
      .eq("phone", demoAccount.phone)
      .eq("role", role)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: "Loi tim tai khoan demo: " + profileError.message }, { status: 500 });
    }

    if (!profile?.email) {
      return NextResponse.json(
        { error: `Chua co tai khoan demo ${demoAccount.phone} cho vai tro ${demoAccount.label}.` },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });

    if (error || !data.properties?.hashed_token) {
      return NextResponse.json(
        { error: "Khong the tao phien dang nhap demo: " + (error?.message || "Khong xac dinh") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      email: profile.email,
      tokenHash: data.properties.hashed_token,
      type: "magiclink",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Loi he thong: " + (error instanceof Error ? error.message : "Khong xac dinh") },
      { status: 500 }
    );
  }
}
