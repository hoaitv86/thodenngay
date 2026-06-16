import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type CreateWorkerJobRequest = {
  customerName?: string;
  customerPhone?: string;
  serviceId?: string;
  address?: string;
  scheduledAt?: string;
  quotedPrice?: string | number | null;
  description?: string;
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
const makePhoneEmail = (phone: string) => `${normalizePhone(phone)}@thodenngay.vn`;
const makeDefaultPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `KH${code}@123`;
};

async function getActiveWorker() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored in route handler.
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Không được phép truy cập." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "worker") {
    return { error: NextResponse.json({ error: "Chỉ tài khoản thợ mới được tạo job." }, { status: 403 }) };
  }

  const { data: worker } = await supabase
    .from("workers")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  if (!worker || worker.status !== "active") {
    return { error: NextResponse.json({ error: "Chỉ thợ đang hoạt động mới có thể tạo job." }, { status: 403 }) };
  }

  return { user, worker };
}

async function makeJobCode(supabaseAdmin: SupabaseClient) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const jobCode = "WJOB" + Math.floor(100000 + Math.random() * 900000);
    const { data } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("job_code", jobCode)
      .maybeSingle();

    if (!data) return jobCode;
  }

  throw new Error("Không thể tạo mã job duy nhất.");
}

export async function POST(request: Request) {
  try {
    const workerCheck = await getActiveWorker();
    if (workerCheck.error) return workerCheck.error;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Vui lòng cấu hình SUPABASE_SERVICE_ROLE_KEY trong file .env.local." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as CreateWorkerJobRequest;
    const customerName = (body.customerName || "").trim().replace(/\s+/g, " ");
    const customerPhone = normalizePhone(body.customerPhone || "");
    const address = (body.address || "").trim();

    if (!customerName || customerPhone.length < 8 || !body.serviceId || !address) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên khách, SĐT, dịch vụ và địa chỉ hợp lệ." },
        { status: 400 }
      );
    }

    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "Thời gian hẹn không hợp lệ." }, { status: 400 });
    }

    const quotedPrice =
      body.quotedPrice === "" || body.quotedPrice === undefined || body.quotedPrice === null
        ? 0
        : Number.parseInt(String(body.quotedPrice), 10);

    if (!Number.isFinite(quotedPrice) || quotedPrice < 0) {
      return NextResponse.json({ error: "Giá dịch vụ không hợp lệ." }, { status: 400 });
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

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("id, name, is_active")
      .eq("id", body.serviceId)
      .eq("is_active", true)
      .maybeSingle();

    if (!service) {
      return NextResponse.json({ error: "Dịch vụ không hợp lệ hoặc đã bị tắt." }, { status: 400 });
    }

    let defaultPassword: string | null = null;
    let createdCustomer = null;
    let customerId: string | null = null;
    let createdAuthUserId: string | null = null;

    const { data: existingCustomer } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email")
      .eq("role", "customer")
      .eq("phone", customerPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      defaultPassword = makeDefaultPassword();

      const { data: authData, error: createUserError } =
        await supabaseAdmin.auth.admin.createUser({
          email: makePhoneEmail(customerPhone),
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            full_name: customerName,
            role: "customer",
          },
        });

      if (createUserError || !authData.user) {
        return NextResponse.json(
          { error: "Lỗi tạo tài khoản khách hàng: " + (createUserError?.message || "Không có user.") },
          { status: 500 }
        );
      }

      customerId = authData.user.id;
      createdAuthUserId = authData.user.id;

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          full_name: customerName,
          phone: customerPhone,
          address,
          status: "active",
        })
        .eq("id", customerId)
        .select("id, full_name, phone, email")
        .single();

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
        return NextResponse.json(
          { error: "Lỗi cập nhật hồ sơ khách hàng: " + profileError.message },
          { status: 500 }
        );
      }

      createdCustomer = profile;
    }

    const jobCode = await makeJobCode(supabaseAdmin);
    const { data: insertedJob, error: insertError } = await supabaseAdmin
      .from("jobs")
      .insert({
        job_code: jobCode,
        customer_id: customerId,
        worker_id: workerCheck.worker.id,
        service_id: service.id,
        address,
        scheduled_at: scheduledAt.toISOString(),
        quoted_price: quotedPrice,
        description: body.description?.trim() || null,
        status: "pending",
        source: "app",
        created_by: workerCheck.user.id,
      })
      .select("*, customer:profiles!customer_id(*), service:services(*), worker:workers(profiles(full_name))")
      .single();

    if (insertError) {
      if (createdAuthUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      }

      return NextResponse.json(
        { error: "Lỗi tạo job: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      job: insertedJob,
      createdCustomer,
      loginPhone: customerPhone,
      defaultPassword,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 }
    );
  }
}
