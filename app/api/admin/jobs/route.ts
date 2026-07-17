import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { attachJobServices, getPrimaryServiceId, isMissingWorkflowColumn, normalizeServiceIds } from "@/lib/job-workflow";
import type { WorkflowData } from "@/config/serviceWorkflows";

type CreateJobRequest = {
  customerMode?: "existing" | "new";
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  serviceId?: string;
  serviceIds?: string[];
  workflowData?: WorkflowData;
  address?: string;
  scheduledAt?: string;
  quotedPrice?: string | number;
  description?: string;
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
const makePhoneEmail = (phone: string) => `${normalizePhone(phone)}@thodenngay.vn`;
const makeDefaultPassword = () => "123@123456";
const ADMIN_JOB_RESPONSE_SELECT = "id, customer_id, worker_id, service_id, service_detail_id, job_code, created_at, address, status, quoted_price, final_amount, cancellation_reason, cancellation_requested_at, cancellation_reviewed_at, customer_gps_location, worker_gps_location, customer:profiles!customer_id(id, full_name, phone, email, gps_location), service:services!jobs_service_id_fkey(id, name, icon, base_price, parent_service_id), worker:workers(profiles(full_name))";

async function getAdminUser() {
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
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Route handlers can be invoked in contexts where cookies are read-only.
          }
        },
      },
    },
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

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Không có quyền quản trị viên." }, { status: 403 }) };
  }

  return { user };
}

export async function POST(request: Request) {
  try {
    const adminCheck = await getAdminUser();
    if (adminCheck.error) return adminCheck.error;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Vui lòng cấu hình SUPABASE_SERVICE_ROLE_KEY trong .env.local." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as CreateJobRequest;
    const customerMode = body.customerMode || "existing";
    const serviceIds = normalizeServiceIds(body.serviceId, body.serviceIds);
    const primaryServiceId = getPrimaryServiceId(body.serviceId, body.serviceIds);

    if (!primaryServiceId || !body.address || !body.scheduledAt) {
      return NextResponse.json({ error: "Thiếu thông tin job bắt buộc." }, { status: 400 });
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let customerId = body.customerId;
    let createdCustomer = null;
    let defaultPassword: string | null = null;
    let customerAlreadyExists = false;

    if (customerMode === "new") {
      const customerName = (body.customerName || "").trim().replace(/\s+/g, " ");
      const customerPhone = normalizePhone(body.customerPhone || "");

      if (!customerName || customerPhone.length < 8) {
        return NextResponse.json({ error: "Vui lòng nhập tên khách hàng và SĐT hợp lệ." }, { status: 400 });
      }

      const { data: existingCustomer } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, email")
        .eq("role", "customer")
        .eq("phone", customerPhone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        customerAlreadyExists = true;
      } else {
        defaultPassword = makeDefaultPassword();
        const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
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
            { status: 500 },
          );
        }

        customerId = authData.user.id;

        const customerEmail = makePhoneEmail(customerPhone);
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: customerId,
            email: customerEmail,
            full_name: customerName,
            phone: customerPhone,
            address: body.address,
            role: "customer",
            status: "active",
          }, { onConflict: "id" })
          .select("id, full_name, phone, email")
          .single();

        if (profileError) {
          return NextResponse.json({ error: "Lỗi cập nhật hồ sơ khách hàng: " + profileError.message }, { status: 500 });
        }

        createdCustomer = profile;
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: "Vui lòng chọn hoặc tạo khách hàng." }, { status: 400 });
    }

    const jobCode = "JOB" + Math.floor(10000 + Math.random() * 90000);
    const quotedPrice =
      body.quotedPrice === "" || body.quotedPrice === undefined
        ? 0
        : Number.parseInt(String(body.quotedPrice), 10) || 0;

    const insertPayload = {
      job_code: jobCode,
      customer_id: customerId,
      service_id: primaryServiceId,
      address: body.address,
      scheduled_at: new Date(body.scheduledAt).toISOString(),
      quoted_price: quotedPrice,
      description: body.description || null,
      workflow_data: body.workflowData || {},
      status: "pending",
      source: "call",
      created_by: adminCheck.user.id,
    };

    let insertResult = await supabaseAdmin
      .from("jobs")
      .insert(insertPayload)
      .select(ADMIN_JOB_RESPONSE_SELECT)
      .single();

    if (insertResult.error && isMissingWorkflowColumn(insertResult.error.message)) {
      const legacyPayload = { ...insertPayload };
      delete (legacyPayload as Partial<typeof insertPayload>).workflow_data;
      insertResult = await supabaseAdmin
        .from("jobs")
        .insert(legacyPayload)
        .select(ADMIN_JOB_RESPONSE_SELECT)
        .single();
    }

    if (insertResult.error) {
      return NextResponse.json({ error: "Không thể tạo job: " + insertResult.error.message }, { status: 500 });
    }

    if (insertResult.data?.id) {
      await attachJobServices(supabaseAdmin, insertResult.data.id, serviceIds);
    }

    return NextResponse.json({
      job: insertResult.data,
      createdCustomer,
      customerAlreadyExists,
      loginPhone: customerMode === "new" ? normalizePhone(body.customerPhone || "") : null,
      defaultPassword,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 },
    );
  }
}
