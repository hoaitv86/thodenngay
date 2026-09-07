import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPhoneLoginEmail, getPhoneLoginCandidates, isSyntheticPhoneEmail, normalizePhone } from "@/lib/account-roles";

type PhoneProfile = {
  email: string | null;
  phone: string | null;
  normalized_phone: string | null;
};

function matchesPhone(profile: PhoneProfile, phoneCandidates: string[]) {
  return phoneCandidates.includes(normalizePhone(profile.normalized_phone || "")) ||
    phoneCandidates.includes(normalizePhone(profile.phone || ""));
}

function resolveProfileEmail(profiles: PhoneProfile[], phoneCandidates: string[]) {
  const phoneMatches = profiles.filter(profile => profile.email && matchesPhone(profile, phoneCandidates));
  const realEmailProfile = phoneMatches.find(profile => !isSyntheticPhoneEmail(profile.email));
  if (realEmailProfile?.email) return realEmailProfile.email;

  const syntheticPhoneProfile = phoneMatches.find(profile => profile.email && isSyntheticPhoneEmail(profile.email));
  if (syntheticPhoneProfile?.email) return syntheticPhoneProfile.email;

  const syntheticEmails = new Set(phoneCandidates.map(buildPhoneLoginEmail));
  const syntheticEmailProfile = profiles.find(profile => profile.email && syntheticEmails.has(profile.email));
  return syntheticEmailProfile?.email || null;
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
      return NextResponse.json({ error: "Thiếu cấu hình tra cứu tài khoản theo SĐT." }, { status: 500 });
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
      .select("email, phone, normalized_phone")
      .or(
        [
          `normalized_phone.in.(${phoneCandidates.join(",")})`,
          `phone.in.(${phoneCandidates.join(",")})`,
          `email.in.(${phoneCandidates.map(buildPhoneLoginEmail).join(",")})`,
        ].join(",")
      )
      .limit(20);

    if (error) {
      return NextResponse.json({ error: "Lỗi tìm tài khoản: " + error.message }, { status: 500 });
    }

    const email = resolveProfileEmail(data || [], phoneCandidates);
    if (!email) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản theo SĐT này." }, { status: 404 });
    }

    return NextResponse.json({ email });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 }
    );
  }
}
