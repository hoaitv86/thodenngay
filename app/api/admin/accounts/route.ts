import { NextResponse } from "next/server";
import { ADMIN_MODULES, DEFAULT_ADMIN_PERMISSIONS, type AdminPermission } from "@/lib/admin-roles";
import { createServiceSupabaseClient, getAdminPermissions, logAdminAction, requireAdmin, syncAdminPermissions, syncAdminRole } from "@/lib/admin-server";

type AdminAccountBody = {
  userId?: string;
  email?: string;
  fullName?: string;
  password?: string;
  isSuperAdmin?: boolean;
  status?: "active" | "blocked";
  permissions?: AdminPermission[];
};

const cleanEmail = (value?: string) => value?.trim().toLowerCase() || "";
const cleanName = (value?: string) => value?.trim() || "";

function normalizePermissions(input?: AdminPermission[]) {
  return DEFAULT_ADMIN_PERMISSIONS.map((fallback) => {
    const saved = input?.find((item) => item.module === fallback.module);
    const canManage = Boolean(saved?.can_manage);
    return {
      module: fallback.module,
      can_view: Boolean(saved?.can_view) || canManage,
      can_manage: canManage,
    };
  });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const service = createServiceSupabaseClient();
    const { data, error } = await service
      .from("profiles")
      .select("id, email, full_name, role, status, is_super_admin, requires_password_change, created_at, updated_at")
      .eq("role", "admin")
      .order("is_super_admin", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Không thể tải danh sách admin: " + error.message }, { status: 500 });
    }

    const accounts = await Promise.all(
      (data || []).map(async (account) => ({
        ...account,
        permissions: await getAdminPermissions(service, account.id, account.is_super_admin),
      })),
    );

    return NextResponse.json({ accounts, currentAdminId: auth.profile.id, modules: ADMIN_MODULES });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!auth.profile.is_super_admin) {
    return NextResponse.json({ error: "Chỉ Super Admin được tạo tài khoản admin." }, { status: 403 });
  }

  const body = (await request.json()) as AdminAccountBody;
  const email = cleanEmail(body.email);
  const fullName = cleanName(body.fullName);
  const password = body.password || "";
  const permissions = normalizePermissions(body.permissions);

  if (!email || !fullName || password.length < 6) {
    return NextResponse.json({ error: "Vui lòng nhập email, tên hiển thị và mật khẩu tối thiểu 6 ký tự." }, { status: 400 });
  }

  try {
    const service = createServiceSupabaseClient();
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "admin",
        requested_role: "admin",
      },
    });

    if (createError || !created.user) {
      return NextResponse.json({ error: "Không thể tạo admin: " + (createError?.message || "Không xác định") }, { status: 500 });
    }

    const { error: profileError } = await service.from("profiles").upsert({
      id: created.user.id,
      email,
      full_name: fullName,
      role: "admin",
      status: "active",
      is_super_admin: Boolean(body.isSuperAdmin),
      requires_password_change: true,
    });

    if (profileError) {
      return NextResponse.json({ error: "Không thể lưu hồ sơ admin: " + profileError.message }, { status: 500 });
    }

    await syncAdminRole(service, created.user.id, auth.profile.id);
    await syncAdminPermissions(service, created.user.id, permissions, auth.profile.id);
    await logAdminAction(service, {
      actorId: auth.profile.id,
      targetAdminId: created.user.id,
      action: "admin.create",
      module: "security",
      summary: `Tạo tài khoản admin ${email}`,
      metadata: { email, isSuperAdmin: Boolean(body.isSuperAdmin), permissions },
    });

    return NextResponse.json({ success: true, userId: created.user.id });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as AdminAccountBody;
  const userId = body.userId;
  const email = cleanEmail(body.email);
  const fullName = cleanName(body.fullName);
  const password = body.password || "";
  const updatingSelf = userId === auth.profile.id;
  const isSuperAdmin = Boolean(auth.profile.is_super_admin);
  const permissions = normalizePermissions(body.permissions);

  if (!userId || !email || !fullName) {
    return NextResponse.json({ error: "Thiếu thông tin tài khoản admin." }, { status: 400 });
  }

  if (!isSuperAdmin && !updatingSelf) {
    return NextResponse.json({ error: "Chỉ Super Admin được sửa tài khoản admin khác." }, { status: 403 });
  }

  if (body.status === "blocked" && updatingSelf) {
    return NextResponse.json({ error: "Không thể tự khóa tài khoản đang đăng nhập." }, { status: 400 });
  }

  if (body.status && body.status !== "active" && body.status !== "blocked") {
    return NextResponse.json({ error: "Trạng thái admin không hợp lệ." }, { status: 400 });
  }

  if (password && password.length < 6) {
    return NextResponse.json({ error: "Mật khẩu mới phải có tối thiểu 6 ký tự." }, { status: 400 });
  }

  try {
    const service = createServiceSupabaseClient();
    const authPayload: { email?: string; password?: string; user_metadata?: Record<string, string> } = {
      email,
      user_metadata: {
        full_name: fullName,
        role: "admin",
        requested_role: "admin",
      },
    };
    if (password) authPayload.password = password;

    const { error: updateAuthError } = await service.auth.admin.updateUserById(userId, authPayload);
    if (updateAuthError) {
      return NextResponse.json({ error: "Không thể cập nhật đăng nhập: " + updateAuthError.message }, { status: 500 });
    }

    const profilePayload: Record<string, string | boolean> = {
      email,
      full_name: fullName,
      role: "admin",
    };

    if (isSuperAdmin) {
      if (typeof body.isSuperAdmin === "boolean") profilePayload.is_super_admin = body.isSuperAdmin;
      if (body.status) profilePayload.status = body.status;
    }
    if (password) profilePayload.requires_password_change = updatingSelf ? false : true;

    const { error: profileError } = await service.from("profiles").update(profilePayload).eq("id", userId).eq("role", "admin");
    if (profileError) {
      return NextResponse.json({ error: "Không thể cập nhật hồ sơ admin: " + profileError.message }, { status: 500 });
    }

    await syncAdminRole(service, userId, auth.profile.id);
    if (body.permissions && isSuperAdmin) {
      await syncAdminPermissions(service, userId, permissions, auth.profile.id);
    }

    await logAdminAction(service, {
      actorId: auth.profile.id,
      targetAdminId: userId,
      action: password ? "admin.update_with_password" : "admin.update",
      module: "security",
      summary: `Cập nhật tài khoản admin ${email}`,
      metadata: {
        email,
        changedPassword: Boolean(password),
        selfUpdate: updatingSelf,
        status: isSuperAdmin ? body.status : undefined,
        isSuperAdmin: isSuperAdmin ? body.isSuperAdmin : undefined,
        permissionsChanged: Boolean(body.permissions && isSuperAdmin),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}
