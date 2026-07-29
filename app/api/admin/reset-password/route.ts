import { NextResponse } from "next/server";
import { createServiceSupabaseClient, logAdminAction, requireAdminPermission } from "@/lib/admin-server";

export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermission("customers", "manage");
    if (!auth.ok) return auth.response;

    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc: userId hoặc newPassword." },
        { status: 400 },
      );
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: "Mật khẩu mới phải có tối thiểu 6 ký tự." }, { status: 400 });
    }

    const supabaseAdmin = createServiceSupabaseClient();
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });

    if (resetError) {
      return NextResponse.json({ error: "Lỗi Supabase Admin: " + resetError.message }, { status: 500 });
    }

    await logAdminAction(supabaseAdmin, {
      actorId: auth.profile.id,
      targetAdminId: userId,
      action: "account.password_reset",
      module: "security",
      summary: "Đặt lại mật khẩu tài khoản",
      metadata: { targetUserId: userId },
    });

    return NextResponse.json({ success: true, message: "Đã thiết lập lại mật khẩu thành công." });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}
