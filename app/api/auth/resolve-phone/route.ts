import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPhoneLoginEmail, getPhoneLoginCandidates, isUnregisteredApiKeyError, normalizePhone } from "@/lib/account-roles";

function fallbackPhoneEmail(normalizedPhone: string) {
  return NextResponse.json({ email: buildPhoneLoginEmail(normalizedPhone), fallback: true });
}
export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    const normalizedPhone = normalizePhone(phone || "");
    const phoneCandidates = getPhoneLoginCandidates(phone || "");

    if (normalizedPhone.length < 8) {
      return NextResponse.json({ error: "Số điện thoại không hợp lệ." }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return fallbackPhoneEmail(normalizedPhone);
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
      .or(
        [
          `normalized_phone.in.(${phoneCandidates.join(",")})`,
          `phone.in.(${phoneCandidates.join(",")})`,
          `email.in.(${phoneCandidates.map(buildPhoneLoginEmail).join(",")})`,
        ].join(",")
      )
      .limit(1);

    if (error) {
      if (isUnregisteredApiKeyError(error)) {
        return fallbackPhoneEmail(normalizedPhone);
      }
      return NextResponse.json({ error: "Lỗi tìm tài khoản: " + error.message }, { status: 500 });
    }

    const profile = data?.[0];
    if (!profile?.email) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản theo SĐT này." }, { status: 404 });
    }

    return NextResponse.json({ email: profile.email || buildPhoneLoginEmail(normalizedPhone) });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 }
    );
  }
}
