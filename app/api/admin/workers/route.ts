import { NextResponse } from "next/server";
import { createServiceSupabaseClient, logAdminAction, requireAdminPermission } from "@/lib/admin-server";

type CreateWorkerBody = {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  address?: string;
  specialties?: string[];
  status?: "active" | "pending";
};

const cleanText = (value?: string) => value?.trim().replace(/\s+/g, " ") || "";
const cleanEmail = (value?: string) => value?.trim().toLowerCase() || "";
const normalizePhone = (value?: string) => value?.replace(/\D/g, "") || "";

export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermission("workers", "manage");
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as CreateWorkerBody;
    const fullName = cleanText(body.name);
    const email = cleanEmail(body.email);
    const password = body.password || "";
    const phone = normalizePhone(body.phone);
    const address = cleanText(body.address);
    const specialties = Array.isArray(body.specialties)
      ? body.specialties.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const status = body.status === "pending" ? "pending" : "active";

    if (!fullName || !email || password.length < 6) {
      return NextResponse.json(
        { error: "Vui lòng nhập họ tên, email và mật khẩu tối thiểu 6 ký tự." },
        { status: 400 },
      );
    }

    const service = createServiceSupabaseClient();
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone: phone || undefined,
      user_metadata: {
        full_name: fullName,
        role: "worker",
        requested_role: "worker",
        phone: phone || null,
        specialties,
      },
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: "Không thể tạo tài khoản thợ: " + (createError?.message || "Không có user.") },
        { status: 500 },
      );
    }

    const approvedAt = status === "active" ? new Date().toISOString() : null;

    const { error: profileError } = await service.from("profiles").upsert(
      {
        id: created.user.id,
        email,
        full_name: fullName,
        phone: phone || null,
        address: address || null,
        role: "worker",
        status: status === "active" ? "active" : "pending",
      },
      { onConflict: "id" },
    );

    if (profileError) {
      return NextResponse.json({ error: "Không thể lưu hồ sơ thợ: " + profileError.message }, { status: 500 });
    }

    const { error: workerError } = await service.from("workers").upsert(
      {
        user_id: created.user.id,
        specialties,
        status,
        approved_at: approvedAt,
      },
      { onConflict: "user_id" },
    );

    if (workerError) {
      return NextResponse.json({ error: "Không thể lưu thông tin thợ: " + workerError.message }, { status: 500 });
    }

    await service.from("user_roles").upsert(
      [
        { user_id: created.user.id, role: "customer", is_active: true, granted_by: auth.profile.id },
        { user_id: created.user.id, role: "worker", is_active: true, granted_by: auth.profile.id },
      ],
      { onConflict: "user_id,role" },
    );

    await logAdminAction(service, {
      actorId: auth.profile.id,
      targetAdminId: created.user.id,
      action: "worker.create",
      module: "workers",
      summary: `Tạo tài khoản thợ ${email}`,
      metadata: { email, status, specialties },
    });

    return NextResponse.json({ success: true, userId: created.user.id });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}
