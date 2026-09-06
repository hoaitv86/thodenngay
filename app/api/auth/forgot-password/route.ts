import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPhoneLoginCandidates, isSyntheticPhoneEmail, isUnregisteredApiKeyError, maskEmail, normalizePhone } from "@/lib/account-roles";
import { enqueueAccountEmail } from "@/lib/notifications/core";

type ProfileRecoveryRow = {
  id: string;
  email: string | null;
  recovery_email: string | null;
  full_name: string | null;
  phone: string | null;
  normalized_phone: string | null;
  role: string | null;
};

function getOrigin(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    new URL(request.url).origin
  ).replace(/\/$/, "");
}

function recoveryUnavailableResponse() {
  return NextResponse.json(
    { error: "Không thể xác định email khôi phục lúc này. Vui lòng liên hệ hỗ trợ để đặt lại mật khẩu." },
    { status: 409 },
  );
}

function buildRecoveryEmail(name: string | null, recoveryLink: string) {
  const displayName = name || "ban";
  return {
    subject: "Dat lai mat khau Tho Den Ngay",
    body: `Xin chao ${displayName},

Chung toi nhan duoc yeu cau dat lai mat khau cho tai khoan Tho Den Ngay cua ban.

Bam vao lien ket sau de tao mat khau moi:
${recoveryLink}

Neu ban khong yeu cau dat lai mat khau, vui long bo qua email nay.`,
  };
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    const normalizedPhone = normalizePhone(String(phone || ""));
    const phoneCandidates = getPhoneLoginCandidates(String(phone || ""));

    if (normalizedPhone.length < 8) {
      return NextResponse.json({ error: "Số điện thoại không hợp lệ." }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return recoveryUnavailableResponse();
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, recovery_email, full_name, phone, normalized_phone, role")
      .or(
        [
          `normalized_phone.in.(${phoneCandidates.join(",")})`,
          `phone.in.(${phoneCandidates.join(",")})`,
        ].join(",")
      )
      .in("role", ["customer", "worker"])
      .limit(1);

    if (error) {
      if (isUnregisteredApiKeyError(error)) {
        return recoveryUnavailableResponse();
      }
      return NextResponse.json({ error: "Lỗi tìm tài khoản: " + error.message }, { status: 500 });
    }

    const profile = (data?.[0] || null) as ProfileRecoveryRow | null;
    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản theo SĐT này." }, { status: 404 });
    }

    const candidateRecoveryEmail = profile.recovery_email || (isSyntheticPhoneEmail(profile.email) ? null : profile.email);
    const recoveryEmail = candidateRecoveryEmail && !isSyntheticPhoneEmail(candidateRecoveryEmail) ? candidateRecoveryEmail : null;
    if (!recoveryEmail) {
      return NextResponse.json(
        { error: "Tài khoản này chưa có email khôi phục. Vui lòng liên hệ hỗ trợ để đặt lại mật khẩu." },
        { status: 409 },
      );
    }

    const { data: authData, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (authLookupError || !authData.user?.email) {
      return NextResponse.json(
        { error: "Không thể xác định tài khoản Auth để đặt lại mật khẩu." },
        { status: 500 },
      );
    }

    const redirectTo = `${getOrigin(request)}/reset-password`;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: authData.user.email,
      options: { redirectTo },
    });

    if (linkError || !linkData.properties?.action_link) {
      return NextResponse.json(
        { error: "Không thể tạo liên kết đặt lại mật khẩu: " + (linkError?.message || "Không có link.") },
        { status: 500 },
      );
    }

    const email = buildRecoveryEmail(profile.full_name, linkData.properties.action_link);
    const queuedEmail = await enqueueAccountEmail(supabaseAdmin, {
      userId: profile.id,
      toEmail: recoveryEmail,
      template: "password_recovery",
      subject: email.subject,
      body: email.body,
      metadata: {
        source: "forgot_password",
        auth_email: authData.user.email,
        recovery_redirect_to: redirectTo,
      },
    });

    if (queuedEmail.error) {
      return NextResponse.json(
        { error: "Không thể đưa email đặt lại mật khẩu vào hàng đợi: " + queuedEmail.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, maskedEmail: maskEmail(recoveryEmail) });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}
