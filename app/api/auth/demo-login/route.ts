import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  DEMO_ACCOUNTS,
  DEMO_ACCOUNT_PASSWORD,
  DEMO_LOCAL_CUSTOMER_EMAIL,
  DEMO_LOCAL_WORKER_EMAIL,
  type DemoRole,
} from "@/lib/demo-accounts";

const isDemoRole = (role: unknown): role is DemoRole => role === "customer" || role === "worker";

export async function POST(request: Request) {
  try {
    const { role } = await request.json();

    if (!isDemoRole(role)) {
      return NextResponse.json({ error: "Tai khoan demo khong hop le." }, { status: 400 });
    }

    const demoAccount = DEMO_ACCOUNTS[role];
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      const demoEmail =
        role === "customer"
          ? process.env.DEMO_CUSTOMER_EMAIL || DEMO_LOCAL_CUSTOMER_EMAIL
          : process.env.DEMO_WORKER_EMAIL || DEMO_LOCAL_WORKER_EMAIL;
      const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD || DEMO_ACCOUNT_PASSWORD;
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
      const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (authError || !authData.session || !authData.user) {
        return NextResponse.json(
          {
            error:
              "Khong the dang nhap demo local. Hay tao tai khoan " +
              `${demoEmail} voi mat khau demo hoac cau hinh SUPABASE_SERVICE_ROLE_KEY.`,
          },
          { status: 500 }
        );
      }

      const { data: profile, error: profileError } = await supabaseAuth
        .from("profiles")
        .select("role, phone, email")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError || profile?.role !== role) {
        return NextResponse.json(
          { error: `Tai khoan ${demoEmail} khong dung vai tro demo ${demoAccount.label}.` },
          { status: 403 }
        );
      }

      return NextResponse.json({
        email: demoEmail,
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        type: "password",
      });
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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
