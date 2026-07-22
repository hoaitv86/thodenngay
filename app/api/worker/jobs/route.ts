import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isLegacyServiceId } from "@/lib/standard-service-catalog";
import { attachJobServices, getPrimaryServiceId, isMissingWorkflowColumn, normalizeServiceIds } from "@/lib/job-workflow";
import type { WorkflowData } from "@/config/serviceWorkflows";
import { DEMO_ACTION_BLOCK_MESSAGE, isDemoAccount } from "@/lib/demo-accounts";

type CreateWorkerJobRequest = {
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  serviceId?: string;
  serviceIds?: string[];
  workflowData?: WorkflowData;
  address?: string;
  scheduledAt?: string;
  quotedPrice?: string | number | null;
  description?: string;
};

type UpdateWorkerJobRequest = {
  jobId?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  serviceId?: string;
  serviceIds?: string[];
  address?: string;
  description?: string | null;
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
const makePhoneEmail = (phone: string) => `${normalizePhone(phone)}@thodenngay.vn`;
const WORKER_JOB_RESPONSE_SELECT = "id, customer_id, worker_id, service_id, job_code, created_at, address, status, quoted_price, description, workflow_data, service:services!jobs_service_id_fkey(id, name, icon, base_price, parent_service_id), customer:profiles!customer_id(id, full_name, phone, email, address)";
const canReturnMockQuickJob = () =>
  process.env.NODE_ENV !== "production" || process.env.ENABLE_MOCK_QUICK_JOB === "true";

const removeVietnameseMarks = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

const makeDefaultPassword = (customerName: string) => {
  const lastNamePart = customerName.trim().split(/\s+/).pop() || "KHACH";
  const cleanNamePart = removeVietnameseMarks(lastNamePart)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  const passwordPrefix = cleanNamePart
    ? `${cleanNamePart.charAt(0).toUpperCase()}${cleanNamePart.slice(1)}`
    : "Khách";

  return `${passwordPrefix}@123456`;
};

const makeMockQuickJob = ({
  workerId,
  customerId,
  customerName,
  customerPhone,
  serviceId,
  serviceName,
  address,
  scheduledAt,
  quotedPrice,
  description,
}: {
  workerId: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName?: string | null;
  address: string;
  scheduledAt: Date;
  quotedPrice: number;
  description?: string | null;
}) => ({
  id: `mock-${Date.now()}`,
  job_code: "DEMO" + Math.floor(100000 + Math.random() * 900000),
  status: "assigned",
  created_at: new Date().toISOString(),
  worker_id: workerId,
  customer_id: customerId || "mock-customer",
  customerName,
  customer: { phone: customerPhone },
  service_id: serviceId,
  serviceName: serviceName || "Dịch vụ",
  address,
  scheduled_at: scheduledAt.toISOString(),
  description: description || null,
  quoted_price: quotedPrice,
  images: [],
  is_mock: true,
});

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
    .select("role, phone, email")
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

  return { supabase, user, worker, isDemo: isDemoAccount(profile) };
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

async function logQuickJobLifecycle(
  supabaseClient: SupabaseClient,
  {
    jobId,
    actorId,
    workerId,
    customerId,
    serviceId,
    createdCustomer,
    mode,
  }: {
    jobId: string;
    actorId: string;
    workerId: string;
    customerId: string | null;
    serviceId: string;
    createdCustomer: boolean;
    mode: "rpc" | "service_role" | "worker_session";
  }
) {
  const metadata = {
    source: "worker_quick_job",
    mode,
    worker_id: workerId,
    customer_id: customerId,
    service_id: serviceId,
    created_customer: createdCustomer,
    assigned_immediately: true,
    approval_required: false,
  };

  const { error } = await supabaseClient.from("job_logs").insert([
    {
      job_id: jobId,
      actor_id: actorId,
      action: "created",
      metadata,
    },
    {
      job_id: jobId,
      actor_id: actorId,
      action: "assigned",
      metadata,
    },
  ]);

  if (error) {
    console.error("[worker_quick_job] Failed to write job log", {
      jobId,
      actorId,
      error: error.message,
    });
    return;
  }

  console.info("[worker_quick_job] Created and assigned without admin approval", {
    jobId,
    actorId,
    workerId,
    customerId,
    serviceId,
    mode,
  });
}

async function replaceJobServices(
  supabaseClient: SupabaseClient,
  jobId: string,
  serviceIds: string[],
) {
  const normalizedServiceIds = normalizeServiceIds(null, serviceIds);
  if (normalizedServiceIds.length === 0) return;

  const { error: deleteError } = await supabaseClient
    .from("job_services")
    .delete()
    .eq("job_id", jobId);

  if (deleteError) {
    console.warn("[worker_quick_job] Failed to clear job_services before edit", {
      jobId,
      error: deleteError.message,
    });
    return;
  }

  await attachJobServices(supabaseClient, jobId, normalizedServiceIds);
}

export async function POST(request: Request) {
  try {
    const workerCheck = await getActiveWorker();
    if (workerCheck.error) return workerCheck.error;
    if (workerCheck.isDemo) {
      return NextResponse.json({ error: DEMO_ACTION_BLOCK_MESSAGE }, { status: 403 });
    }

    const body = (await request.json()) as CreateWorkerJobRequest;
    const requestedCustomerId = (body.customerId || "").trim() || null;
    const customerName = (body.customerName || "").trim().replace(/\s+/g, " ");
    const customerPhone = normalizePhone(body.customerPhone || "");
    const address = (body.address || "").trim();
    const serviceIds = normalizeServiceIds(body.serviceId, body.serviceIds);
    const primaryServiceId = getPrimaryServiceId(body.serviceId, body.serviceIds);

    if ((!requestedCustomerId && (!customerName || customerPhone.length < 8)) || !primaryServiceId || !address) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên khách, SĐT, dịch vụ và địa chỉ hợp lệ." },
        { status: 400 }
      );
    }

    if (isLegacyServiceId(primaryServiceId)) {
      return NextResponse.json(
        { error: "Dịch vụ cũ đã được ẩn, vui lòng chọn danh mục chuẩn mới." },
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

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      if (!requestedCustomerId) {
      const { data: quickJob, error: quickJobError } = await workerCheck.supabase.rpc(
        "worker_create_quick_job",
        {
          p_customer_phone: customerPhone,
          p_service_id: primaryServiceId,
          p_address: address,
          p_description: body.description?.trim() || null,
          p_quoted_price: quotedPrice,
        }
      );

      const rpcMissing =
        quickJobError?.message?.includes("Could not find the function") ||
        quickJobError?.code === "PGRST202";

      if (!quickJobError) {
        if (quickJob?.id) {
          await logQuickJobLifecycle(workerCheck.supabase as SupabaseClient, {
            jobId: quickJob.id,
            actorId: workerCheck.user.id,
            workerId: workerCheck.worker.id,
            customerId: quickJob.customer_id || null,
            serviceId: primaryServiceId,
            createdCustomer: false,
            mode: "rpc",
          });
        }

        return NextResponse.json({
          job: quickJob,
          createdCustomer: null,
          customerAlreadyExists: true,
          loginPhone: customerPhone,
          defaultPassword: null,
          approvalRequired: false,
        });
      }

      if (!rpcMissing) {
        return NextResponse.json(
          {
            error:
              quickJobError.message ||
              "Không thể tạo việc nhanh. Vui lòng kiểm tra khách quen đã có tài khoản và SĐT.",
          },
          { status: 400 }
        );
      }
      }

      const { data: service } = await workerCheck.supabase
        .from("services")
        .select("id, name, base_price, is_active")
        .eq("id", primaryServiceId)
        .eq("is_active", true)
        .maybeSingle();

      if (!service) {
        return NextResponse.json({ error: "Dịch vụ không hợp lệ hoặc đã bị tắt." }, { status: 400 });
      }

      const existingCustomerQuery = workerCheck.supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("role", "customer");
      const { data: existingCustomer } = requestedCustomerId
        ? await existingCustomerQuery.eq("id", requestedCustomerId).maybeSingle()
        : await existingCustomerQuery.eq("phone", customerPhone).maybeSingle();

      if (!existingCustomer) {
        if (requestedCustomerId) {
          return NextResponse.json(
            { error: "Không tìm thấy khách hàng đã chọn." },
            { status: 400 }
          );
        }

        if (canReturnMockQuickJob()) {
          const mockCustomerId = `mock-customer-${customerPhone}`;
          const defaultPassword = makeDefaultPassword(customerName);

          return NextResponse.json({
            job: makeMockQuickJob({
              workerId: workerCheck.worker.id,
              customerId: mockCustomerId,
              customerName,
              customerPhone,
              serviceId: service.id,
              serviceName: service.name,
              address,
              scheduledAt,
              quotedPrice: quotedPrice || Number(service.base_price || 0),
              description: body.description?.trim() || null,
            }),
            createdCustomer: {
              id: mockCustomerId,
              full_name: customerName,
              phone: customerPhone,
            },
            customerAlreadyExists: false,
            loginPhone: customerPhone,
            defaultPassword,
            mock: true,
            approvalRequired: false,
          });
        }

        return NextResponse.json(
          {
            error:
              "Không tìm thấy khách quen với SĐT này. Hãy chọn khách đã từng phục vụ hoặc cấu hình SUPABASE_SERVICE_ROLE_KEY để tự tạo tài khoản khách mới.",
          },
          { status: 400 }
        );
      }

      const jobCode = "FAST" + Math.floor(100000 + Math.random() * 900000);
      const insertPayload = {
        job_code: jobCode,
        customer_id: existingCustomer.id,
        worker_id: workerCheck.worker.id,
        service_id: service.id,
        address,
        scheduled_at: scheduledAt.toISOString(),
        quoted_price: quotedPrice || Number(service.base_price || 0),
        description: body.description?.trim() || null,
        workflow_data: body.workflowData || {},
        status: "assigned",
        source: "app",
        created_by: workerCheck.user.id,
      };

      let insertResult = await workerCheck.supabase
        .from("jobs")
        .insert(insertPayload)
        .select(WORKER_JOB_RESPONSE_SELECT)
        .single();

      if (insertResult.error && isMissingWorkflowColumn(insertResult.error.message)) {
        const legacyPayload = { ...insertPayload };
        delete (legacyPayload as Partial<typeof insertPayload>).workflow_data;
        insertResult = await workerCheck.supabase
          .from("jobs")
          .insert(legacyPayload)
          .select(WORKER_JOB_RESPONSE_SELECT)
          .single();
      }

      const insertedJob = insertResult.data;
      const insertError = insertResult.error;

      if (insertError) {
        if (canReturnMockQuickJob()) {
          return NextResponse.json({
            job: makeMockQuickJob({
              workerId: workerCheck.worker.id,
              customerId: existingCustomer.id,
              customerName: existingCustomer.full_name || customerName,
              customerPhone: existingCustomer.phone || customerPhone,
              serviceId: service.id,
              serviceName: service.name,
              address,
              scheduledAt,
              quotedPrice: quotedPrice || Number(service.base_price || 0),
              description: body.description?.trim() || null,
            }),
            createdCustomer: null,
            customerAlreadyExists: true,
            loginPhone: existingCustomer.phone || customerPhone,
            defaultPassword: null,
            mock: true,
            approvalRequired: false,
          });
        }

        return NextResponse.json(
          {
            error:
              "Chức năng tạo việc nhanh chưa được bật trong database. Vui lòng chạy file supabase/migration_worker_quick_job.sql hoặc cấu hình SUPABASE_SERVICE_ROLE_KEY.",
            detail: insertError.message,
          },
          { status: 500 }
        );
      }

      if (!insertedJob) {
        return NextResponse.json({ error: "Không thể lấy thông tin job vừa tạo." }, { status: 500 });
      }

      await logQuickJobLifecycle(workerCheck.supabase as SupabaseClient, {
        jobId: insertedJob.id,
        actorId: workerCheck.user.id,
        workerId: workerCheck.worker.id,
        customerId: existingCustomer.id,
        serviceId: service.id,
        createdCustomer: false,
        mode: "worker_session",
      });
      await attachJobServices(workerCheck.supabase as SupabaseClient, insertedJob.id, serviceIds);

      return NextResponse.json({
        job: insertedJob,
        createdCustomer: null,
        customerAlreadyExists: true,
        loginPhone: existingCustomer.phone || customerPhone,
        defaultPassword: null,
        approvalRequired: false,
      });
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
      .eq("id", primaryServiceId)
      .eq("is_active", true)
      .maybeSingle();

    if (!service) {
      return NextResponse.json({ error: "Dịch vụ không hợp lệ hoặc đã bị tắt." }, { status: 400 });
    }

    let defaultPassword: string | null = null;
    let createdCustomer = null;
    let customerId: string | null = null;
    let createdAuthUserId: string | null = null;
    let customerAlreadyExists = false;

    const existingCustomerQuery = supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email")
      .eq("role", "customer");
    const { data: existingCustomer } = requestedCustomerId
      ? await existingCustomerQuery.eq("id", requestedCustomerId).maybeSingle()
      : await existingCustomerQuery.eq("phone", customerPhone).maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      customerAlreadyExists = true;
    } else if (requestedCustomerId) {
      return NextResponse.json(
        { error: "Không tìm thấy khách hàng đã chọn." },
        { status: 400 }
      );
    } else {
      defaultPassword = makeDefaultPassword(customerName);

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

      const customerEmail = makePhoneEmail(customerPhone);
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: customerId,
          email: customerEmail,
          full_name: customerName,
          phone: customerPhone,
          address,
          role: "customer",
          status: "active",
        }, { onConflict: "id" })
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
    const insertPayload = {
      job_code: jobCode,
      customer_id: customerId,
      worker_id: workerCheck.worker.id,
      service_id: service.id,
      address,
      scheduled_at: scheduledAt.toISOString(),
      quoted_price: quotedPrice,
      description: body.description?.trim() || null,
      workflow_data: body.workflowData || {},
      status: "assigned",
      source: "app",
      created_by: workerCheck.user.id,
    };

    let insertResult = await supabaseAdmin
      .from("jobs")
      .insert(insertPayload)
      .select(`${WORKER_JOB_RESPONSE_SELECT}, worker:workers(profiles(full_name))`)
      .single();

    if (insertResult.error && isMissingWorkflowColumn(insertResult.error.message)) {
      const legacyPayload = { ...insertPayload };
      delete (legacyPayload as Partial<typeof insertPayload>).workflow_data;
      insertResult = await supabaseAdmin
        .from("jobs")
        .insert(legacyPayload)
        .select(`${WORKER_JOB_RESPONSE_SELECT}, worker:workers(profiles(full_name))`)
        .single();
    }

    const insertedJob = insertResult.data;
    const insertError = insertResult.error;

    if (insertError) {
      if (createdAuthUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      }

      return NextResponse.json(
        { error: "Lỗi tạo job: " + insertError.message },
        { status: 500 }
      );
    }

    if (!insertedJob) {
      return NextResponse.json({ error: "Không thể lấy thông tin job vừa tạo." }, { status: 500 });
    }

    await logQuickJobLifecycle(supabaseAdmin as SupabaseClient, {
      jobId: insertedJob.id,
      actorId: workerCheck.user.id,
      workerId: workerCheck.worker.id,
      customerId,
      serviceId: service.id,
      createdCustomer: Boolean(createdCustomer),
      mode: "service_role",
    });
    await attachJobServices(supabaseAdmin as SupabaseClient, insertedJob.id, serviceIds);

    return NextResponse.json({
      job: insertedJob,
      createdCustomer,
      customerAlreadyExists,
      loginPhone: existingCustomer?.phone || customerPhone,
      defaultPassword,
      approvalRequired: false,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const workerCheck = await getActiveWorker();
    if (workerCheck.error) return workerCheck.error;
    if (workerCheck.isDemo) {
      return NextResponse.json({ error: DEMO_ACTION_BLOCK_MESSAGE }, { status: 403 });
    }

    const body = (await request.json()) as UpdateWorkerJobRequest;
    const jobId = (body.jobId || "").trim();
    const requestedCustomerId = (body.customerId || "").trim() || null;
    const customerName = (body.customerName || "").trim().replace(/\s+/g, " ");
    const customerPhone = normalizePhone(body.customerPhone || "");
    const address = (body.address || "").trim();
    const description = body.description?.trim() || null;
    const serviceIds = normalizeServiceIds(body.serviceId, body.serviceIds);
    const primaryServiceId = getPrimaryServiceId(body.serviceId, body.serviceIds);

    if (!jobId || (!requestedCustomerId && (!customerName || customerPhone.length < 8)) || !primaryServiceId || !address) {
      return NextResponse.json(
        { error: "Vui lòng chọn khách, dịch vụ và địa chỉ hợp lệ." },
        { status: 400 }
      );
    }

    if (isLegacyServiceId(primaryServiceId)) {
      return NextResponse.json(
        { error: "Dịch vụ cũ đã được ẩn, vui lòng chọn danh mục chuẩn mới." },
        { status: 400 }
      );
    }

    const { data: currentJob, error: currentJobError } = await workerCheck.supabase
      .from("jobs")
      .select("id, worker_id, status")
      .eq("id", jobId)
      .eq("worker_id", workerCheck.worker.id)
      .maybeSingle();

    if (currentJobError) {
      return NextResponse.json({ error: "Không thể kiểm tra công việc: " + currentJobError.message }, { status: 500 });
    }

    if (!currentJob) {
      return NextResponse.json({ error: "Không tìm thấy công việc đang làm." }, { status: 404 });
    }

    if (!["assigned", "in_progress"].includes(String(currentJob.status))) {
      return NextResponse.json({ error: "Công việc đã hoàn thành hoặc đã khóa, không thể sửa thông tin này." }, { status: 409 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      const { data: rpcJob, error: rpcError } = await workerCheck.supabase.rpc(
        "worker_update_quick_job",
        {
          p_job_id: jobId,
          p_customer_id: requestedCustomerId,
          p_customer_name: customerName || null,
          p_customer_phone: customerPhone || null,
          p_service_id: primaryServiceId,
          p_service_ids: serviceIds,
          p_address: address,
          p_description: description,
        }
      );

      const rpcMissing =
        rpcError?.message?.includes("Could not find the function") ||
        rpcError?.code === "PGRST202";

      if (!rpcError) {
        return NextResponse.json({ job: rpcJob, customerAlreadyExists: true });
      }

      if (!rpcMissing) {
        return NextResponse.json(
          { error: rpcError.message || "Không thể cập nhật công việc." },
          { status: 400 }
        );
      }
    }

    const supabaseAdmin = serviceRoleKey
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        )
      : workerCheck.supabase;

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("id, name, is_active")
      .eq("id", primaryServiceId)
      .eq("is_active", true)
      .maybeSingle();

    if (!service) {
      return NextResponse.json({ error: "Dịch vụ không hợp lệ hoặc đã bị tắt." }, { status: 400 });
    }

    const existingCustomerQuery = supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email")
      .eq("role", "customer");
    const { data: existingCustomer } = requestedCustomerId
      ? await existingCustomerQuery.eq("id", requestedCustomerId).maybeSingle()
      : await existingCustomerQuery.eq("phone", customerPhone).maybeSingle();

    if (!existingCustomer) {
      return NextResponse.json(
        {
          error: requestedCustomerId
            ? "Không tìm thấy khách hàng đã chọn."
            : "Không tìm thấy khách quen với SĐT này. Hãy chọn khách đã có để tránh tạo trùng.",
        },
        { status: 400 }
      );
    }

    const updatePayload = {
      customer_id: existingCustomer.id,
      service_id: service.id,
      address,
      description,
    };

    const { data: updatedJob, error: updateError } = await supabaseAdmin
      .from("jobs")
      .update(updatePayload)
      .eq("id", jobId)
      .eq("worker_id", workerCheck.worker.id)
      .in("status", ["assigned", "in_progress"])
      .select(WORKER_JOB_RESPONSE_SELECT)
      .single();

    if (updateError) {
      return NextResponse.json({ error: "Không thể cập nhật công việc: " + updateError.message }, { status: 500 });
    }

    await replaceJobServices(supabaseAdmin as SupabaseClient, jobId, serviceIds);

    const { data: refreshedJob } = await supabaseAdmin
      .from("jobs")
      .select(`${WORKER_JOB_RESPONSE_SELECT}, job_services(service:services(id, name, icon, base_price, parent_service_id))`)
      .eq("id", jobId)
      .single();

    return NextResponse.json({
      job: refreshedJob || updatedJob,
      customerAlreadyExists: true,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Lỗi hệ thống: " + (error instanceof Error ? error.message : "Không xác định") },
      { status: 500 }
    );
  }
}
