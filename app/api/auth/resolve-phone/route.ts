import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    const normalizedPhone = normalizePhone(phone || "");

    if (normalizedPhone.length < 8) {
      return NextResponse.json({ error: "Số điện thoại không hợp lệ." }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Vui lòng cấu hình SUPABASE_SERVICE_ROLE_KEY trong file .env.local." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Lỗi tìm tài khoản: " + error.message }, { status: 500 });
    }

    if (!data?.email) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản theo SĐT này." }, { status: 404 });
    }

    return NextResponse.json({ email: data.email });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 }
    );
  }
}
