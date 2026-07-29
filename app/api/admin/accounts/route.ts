import { NextResponse } from "next/server";
import { ADMIN_MODULES, DEFAULT_ADMIN_PERMISSIONS, type AdminPermission } from "@/lib/admin-roles";
import { createServiceSupabaseClient, getAdminPermissions, requireAdmin, syncAdminPermissions, syncAdminRole } from "@/lib/admin-server";

type AdminAccountBody = {
  userId?: string;
  email?: string;
  fullName?: string;
  password?: string;
  isSuperAdmin?: boolean;
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
      .select("id, email, full_name, role, status, is_super_admin, created_at, updated_at")
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
    });

    if (profileError) {
      return NextResponse.json({ error: "Không thể lưu hồ sơ admin: " + profileError.message }, { status: 500 });
    }

    await syncAdminRole(service, created.user.id, auth.profile.id);
    await syncAdminPermissions(service, created.user.id, permissions, auth.profile.id);

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
  const permissions = normalizePermissions(body.permissions);

  if (!userId || !email || !fullName) {
    return NextResponse.json({ error: "Thiếu thông tin tài khoản admin." }, { status: 400 });
  }

  if (!auth.profile.is_super_admin && !updatingSelf) {
    return NextResponse.json({ error: "Chỉ Super Admin được sửa tài khoản admin khác." }, { status: 403 });
  }

  if (typeof body.isSuperAdmin === "boolean" && !auth.profile.is_super_admin) {
    return NextResponse.json({ error: "Chỉ Super Admin được thay đổi quyền Super Admin." }, { status: 403 });
  }

  if (body.permissions && !auth.profile.is_super_admin) {
    return NextResponse.json({ error: "Chỉ Super Admin được thay đổi phân quyền module." }, { status: 403 });
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
    if (typeof body.isSuperAdmin === "boolean") {
      profilePayload.is_super_admin = body.isSuperAdmin;
    }

    const { error: profileError } = await service.from("profiles").update(profilePayload).eq("id", userId).eq("role", "admin");
    if (profileError) {
      return NextResponse.json({ error: "Không thể cập nhật hồ sơ admin: " + profileError.message }, { status: 500 });
    }

    await syncAdminRole(service, userId, auth.profile.id);
    if (body.permissions && auth.profile.is_super_admin) {
      await syncAdminPermissions(service, userId, permissions, auth.profile.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}
