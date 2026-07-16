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
      return NextResponse.json({ error: "Tài khoản demo không hợp lệ." }, { status: 400 });
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
              "Không thể đăng nhập demo local. Hãy tạo tài khoản " +
              `${demoEmail} với mật khẩu demo hoặc cấu hình SUPABASE_SERVICE_ROLE_KEY.`,
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
          { error: `Tài khoản ${demoEmail} không đúng vai trò demo ${demoAccount.label}.` },
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
      return NextResponse.json({ error: "Lỗi tìm tài khoản demo: " + profileError.message }, { status: 500 });
    }

    if (!profile?.email) {
      return NextResponse.json(
        { error: `Chưa có tài khoản demo ${demoAccount.phone} cho vai trò ${demoAccount.label}.` },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });

    if (error || !data.properties?.hashed_token) {
      return NextResponse.json(
        { error: "Không thể tạo phiên đăng nhập demo: " + (error?.message || "Không xác định") },
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
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 }
    );
  }
}
