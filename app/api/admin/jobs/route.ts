import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { attachJobServices, getPrimaryServiceId, isMissingWorkflowColumn, normalizeServiceIds } from "@/lib/job-workflow";
import type { WorkflowData } from "@/config/serviceWorkflows";
import { requireAdminPermission } from "@/lib/admin-server";
import { MAX_TASK_ATTACHMENTS, TASK_ATTACHMENTS_BUCKET } from "@/lib/task-attachments";

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
const ADMIN_JOB_RESPONSE_SELECT = "id, customer_id, worker_id, service_id, service_detail_id, job_code, created_at, address, status, quoted_price, final_amount, cancellation_reason, cancellation_requested_at, cancellation_reviewed_at, customer_gps_location, worker_gps_location, customer:profiles!customer_id(id, full_name, phone, email, gps_location), service:services!jobs_service_id_fkey(id, name, icon, base_price, parent_service_id), worker:workers(profiles(full_name)), task_attachments(id, task_id, original_name, storage_path, mime_type, file_size, created_at)";

function getStringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function parseJsonField<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function parseCreateJobRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return {
      body: (await request.json()) as CreateJobRequest,
      attachments: [] as File[],
    };
  }

  const formData = await request.formData();
  return {
    body: {
      customerMode: getStringField(formData, "customerMode") as CreateJobRequest["customerMode"],
      customerId: getStringField(formData, "customerId"),
      customerName: getStringField(formData, "customerName"),
      customerPhone: getStringField(formData, "customerPhone"),
      serviceId: getStringField(formData, "serviceId"),
      serviceIds: parseJsonField<string[]>(getStringField(formData, "serviceIds"), []),
      workflowData: parseJsonField<WorkflowData>(getStringField(formData, "workflowData"), {}),
      address: getStringField(formData, "address"),
      scheduledAt: getStringField(formData, "scheduledAt"),
      quotedPrice: getStringField(formData, "quotedPrice"),
      description: getStringField(formData, "description"),
    },
    attachments: formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0),
  };
}

function buildAttachmentStoragePath(jobId: string, file: File, index: number) {
  const originalName = file.name || `file-${index + 1}`;
  const extMatch = originalName.match(/\.([a-zA-Z0-9]{1,12})$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";
  return `jobs/${jobId}/${Date.now()}-${index}-${crypto.randomUUID()}${ext}`;
}

async function ensureTaskAttachmentBucket(supabaseAdmin: SupabaseClient) {
  const { error } = await supabaseAdmin.storage.getBucket(TASK_ATTACHMENTS_BUCKET);
  if (!error) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(TASK_ATTACHMENTS_BUCKET, {
    public: false,
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error("Không thể tạo bucket file đính kèm: " + createError.message);
  }
}

export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdminPermission("jobs", "manage");
    if (!adminCheck.ok) return adminCheck.response;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Vui lòng cấu hình SUPABASE_SERVICE_ROLE_KEY trong .env.local." },
        { status: 500 },
      );
    }

    const { body, attachments } = await parseCreateJobRequest(request);
    const customerMode = body.customerMode || "existing";
    const serviceIds = normalizeServiceIds(body.serviceId, body.serviceIds);
    const primaryServiceId = getPrimaryServiceId(body.serviceId, body.serviceIds);

    if (!primaryServiceId || !body.address || !body.scheduledAt) {
      return NextResponse.json({ error: "Thiếu thông tin job bắt buộc." }, { status: 400 });
    }

    if (attachments.length > MAX_TASK_ATTACHMENTS) {
      return NextResponse.json({ error: `Chỉ được đính kèm tối đa ${MAX_TASK_ATTACHMENTS} file cho một công việc.` }, { status: 400 });
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

    const jobId = insertResult.data?.id;
    const uploadedPaths: string[] = [];

    if (jobId) {
      try {
        await attachJobServices(supabaseAdmin, jobId, serviceIds);

        if (attachments.length > 0) {
          await ensureTaskAttachmentBucket(supabaseAdmin);

          const attachmentRows = [];
          for (let index = 0; index < attachments.length; index += 1) {
            const file = attachments[index];
            const storagePath = buildAttachmentStoragePath(jobId, file, index);
            const { error: uploadError } = await supabaseAdmin.storage
              .from(TASK_ATTACHMENTS_BUCKET)
              .upload(storagePath, file, {
                cacheControl: "3600",
                contentType: file.type || "application/octet-stream",
                upsert: false,
              });

            if (uploadError) {
              throw new Error(`Không thể tải file "${file.name}" lên: ${uploadError.message}`);
            }

            uploadedPaths.push(storagePath);
            attachmentRows.push({
              task_id: jobId,
              original_name: file.name || `file-${index + 1}`,
              storage_path: storagePath,
              mime_type: file.type || null,
              file_size: file.size,
            });
          }

          const { error: attachmentError } = await supabaseAdmin
            .from("task_attachments")
            .insert(attachmentRows);

          if (attachmentError) {
            throw new Error("Không thể lưu thông tin file đính kèm: " + attachmentError.message);
          }
        }
      } catch (attachmentError) {
        if (uploadedPaths.length > 0) {
          await supabaseAdmin.storage.from(TASK_ATTACHMENTS_BUCKET).remove(uploadedPaths);
        }
        await supabaseAdmin.from("jobs").delete().eq("id", jobId);

        return NextResponse.json(
          { error: attachmentError instanceof Error ? attachmentError.message : "Không thể lưu file đính kèm." },
          { status: 500 },
        );
      }
    }

    const { data: createdJob } = jobId
      ? await supabaseAdmin
        .from("jobs")
        .select(ADMIN_JOB_RESPONSE_SELECT)
        .eq("id", jobId)
        .single()
      : { data: insertResult.data };

    return NextResponse.json({
      job: createdJob || insertResult.data,
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

