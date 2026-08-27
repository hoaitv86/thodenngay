import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type NotificationAudience = "worker" | "customer" | "admin";
export type NotificationLevel = "info" | "success" | "warning" | "critical";
export type NotificationStatus = "open" | "in_progress" | "auto_resolved" | "resolved";

export type NotificationPayload = {
  audience: NotificationAudience;
  type: string;
  title: string;
  body: string;
  level?: NotificationLevel;
  jobId?: string | null;
  workerId?: string | null;
  customerId?: string | null;
  targetUrl?: string | null;
  dedupeKey?: string | null;
  priority?: number;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

type JobNotificationRow = {
  id: string;
  job_code?: string | null;
  customer_id?: string | null;
  worker_id?: string | null;
  status?: string | null;
  address?: string | null;
  scheduled_at?: string | null;
  service?: { name?: string | null } | null;
  customer?: { full_name?: string | null; phone?: string | null } | null;
  worker?: {
    id?: string | null;
    user_id?: string | null;
    user?: { full_name?: string | null; phone?: string | null } | null;
  } | null;
};

const APP_NAME = "Tho Den Ngay";
const stalePushMs = 1000 * 60 * 60 * 24 * 3;

export function getServiceRoleSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getNotificationTargetUrl(payload: NotificationPayload) {
  if (payload.targetUrl) return payload.targetUrl;
  if (!payload.jobId) return payload.audience === "admin" ? "/admin/notifications" : `/${payload.audience}`;
  if (payload.audience === "worker") return `/worker/history/${payload.jobId}`;
  if (payload.audience === "customer") return `/customer/jobs/${payload.jobId}`;
  return `/admin/notifications?job=${payload.jobId}`;
}

export async function createNotificationsForUsers(
  supabase: SupabaseClient,
  targetUserIds: Array<string | null | undefined>,
  payload: NotificationPayload,
) {
  const uniqueUserIds = [...new Set(targetUserIds.filter((id): id is string => Boolean(id)))];
  if (uniqueUserIds.length === 0) return { count: 0 };

  const preferenceCategories = [payload.type, typeof payload.metadata?.category === "string" ? payload.metadata.category : null].filter((item): item is string => Boolean(item));
  const { data: preferenceRows } = preferenceCategories.length > 0
    ? await supabase
      .from("notification_preferences")
      .select("user_id, category, enabled, priority")
      .in("user_id", uniqueUserIds)
      .eq("audience", payload.audience)
      .in("category", preferenceCategories)
    : { data: [] };
  const preferenceMap = new Map((preferenceRows || []).map((row) => [`${row.user_id}:${row.category}`, row as { enabled?: boolean; priority?: number }]));
  const enabledUserIds = uniqueUserIds.filter((targetUserId) => {
    const direct = preferenceMap.get(`${targetUserId}:${payload.type}`);
    const category = typeof payload.metadata?.category === "string" ? preferenceMap.get(`${targetUserId}:${payload.metadata.category}`) : null;
    return direct?.enabled !== false && category?.enabled !== false;
  });
  if (enabledUserIds.length === 0) return { count: 0 };

  const now = new Date();
  const expiresAt = payload.expiresAt || new Date(now.getTime() + stalePushMs).toISOString();
  const targetUrl = getNotificationTargetUrl(payload);
  const rows = enabledUserIds.map((targetUserId) => ({
    target_user_id: targetUserId,
    audience: payload.audience,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    level: payload.level || "info",
    priority: preferenceMap.get(`${targetUserId}:${payload.type}`)?.priority ?? (typeof payload.metadata?.category === "string" ? preferenceMap.get(`${targetUserId}:${payload.metadata.category}`)?.priority : undefined) ?? payload.priority ?? 50,
    status: "open" satisfies NotificationStatus,
    job_id: payload.jobId || null,
    worker_id: payload.workerId || null,
    customer_id: payload.customerId || null,
    target_url: targetUrl,
    dedupe_key: payload.dedupeKey ? `${targetUserId}:${payload.dedupeKey}` : null,
    expires_at: expiresAt,
    metadata: payload.metadata || {},
  }));

  const { data, error } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id, target_user_id, title, body, target_url, expires_at");

  if (error) {
    console.warn("[notifications] create failed", error.message);
    return { count: 0, error };
  }

  const queueRows = (data || []).map((notification) => ({
    notification_id: notification.id,
    target_user_id: notification.target_user_id,
    channel: "push",
    title: notification.title,
    body: notification.body,
    target_url: notification.target_url,
    expires_at: notification.expires_at,
  }));

  if (queueRows.length > 0) {
    const { error: queueError } = await supabase.from("notification_delivery_queue").insert(queueRows);
    if (queueError) {
      console.warn("[notifications] queue failed", queueError.message);
    } else {
      try {
        const { dispatchPendingPushNotifications } = await import("./push");
        const result = await dispatchPendingPushNotifications(supabase, Math.max(queueRows.length, 25));
        if (result.error) console.warn("[notifications] push dispatch skipped", result.error);
      } catch (dispatchError) {
        console.warn("[notifications] push dispatch failed", dispatchError);
      }
    }
  }

  return { count: data?.length || 0 };
}

export async function getJobNotificationContext(supabase: SupabaseClient, jobId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_code,
      customer_id,
      worker_id,
      status,
      address,
      scheduled_at,
      service:services!jobs_service_id_fkey(name),
      customer:profiles!customer_id(full_name, phone),
      worker:workers(id, user_id, user:profiles(full_name, phone))
    `)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.warn("[notifications] job context failed", error.message);
    return null;
  }

  return data as unknown as JobNotificationRow | null;
}

export async function getAdminUserIds(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("profiles").select("id").eq("role", "admin");
  if (error) {
    console.warn("[notifications] admin lookup failed", error.message);
    return [];
  }
  return (data || []).map((row) => row.id as string);
}

function formatSchedule(value?: string | null) {
  if (!value) return "chua hen gio";
  return new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

export async function notifyJobEvent(
  supabase: SupabaseClient,
  event: "job_created" | "worker_assigned" | "worker_changed" | "worker_en_route" | "worker_arrived" | "job_completed" | "rating_created" | "worker_cancel_requested" | "job_unassigned_risk" | "job_late_risk",
  jobId: string,
  metadata: Record<string, unknown> = {},
) {
  const job = await getJobNotificationContext(supabase, jobId);
  if (!job) return;

  const jobCode = job.job_code || `#${job.id.slice(0, 8)}`;
  const serviceName = job.service?.name || "Dich vu";
  const schedule = formatSchedule(job.scheduled_at);
  const customerUserId = job.customer_id || null;
  const workerUserId = job.worker?.user_id || null;

  if (event === "job_created") {
    await createNotificationsForUsers(supabase, await getAdminUserIds(supabase), {
      audience: "admin", type: "customer_job_created", level: "warning", priority: 90,
      title: "Khach dat viec moi", body: `${serviceName} ${jobCode} can theo doi va dieu phoi.`,
      jobId, customerId: job.customer_id, workerId: job.worker_id, dedupeKey: `admin:job_created:${jobId}`, metadata,
    });
    return;
  }

  if (event === "worker_assigned" && workerUserId) {
    await createNotificationsForUsers(supabase, [workerUserId], {
      audience: "worker", type: "system_assigned_job", level: "critical", priority: 100,
      title: `Co viec moi ${jobCode}`, body: `${serviceName} - ${schedule}${job.address ? ` | ${job.address}` : ""}`,
      jobId, workerId: job.worker_id, customerId: job.customer_id, dedupeKey: `worker:assigned:${jobId}:${job.worker_id}`, metadata,
    });
  }

  if ((event === "worker_assigned" || event === "worker_changed") && customerUserId) {
    const workerName = job.worker?.user?.full_name || "tho";
    await createNotificationsForUsers(supabase, [customerUserId], {
      audience: "customer", type: event === "worker_changed" ? "worker_changed" : "worker_assigned",
      level: event === "worker_changed" ? "warning" : "success", priority: event === "worker_changed" ? 88 : 80,
      title: event === "worker_changed" ? "Cong viec duoc giao cho tho khac" : "Tho da nhan viec",
      body: event === "worker_changed" ? `${jobCode} da duoc dieu phoi sang ${workerName}.` : `Cong viec ${jobCode} da duoc ${workerName} nhan.`,
      jobId, workerId: job.worker_id, customerId: job.customer_id, dedupeKey: `customer:${event}:${jobId}:${job.worker_id}`, metadata,
    });
  }

  if (event === "worker_en_route" && customerUserId) {
    await createNotificationsForUsers(supabase, [customerUserId], {
      audience: "customer", type: "worker_en_route", level: "info", priority: 78,
      title: "Tho dang den", body: `${job.worker?.user?.full_name || "Tho"} dang den cho ban${metadata.distance ? `, cach khoang ${metadata.distance}` : ""}.`,
      jobId, workerId: job.worker_id, customerId: job.customer_id, dedupeKey: `customer:en_route:${jobId}`, metadata,
    });
  }

  if (event === "worker_arrived" && customerUserId) {
    await createNotificationsForUsers(supabase, [customerUserId], {
      audience: "customer", type: "worker_arrived", level: "info", priority: 76,
      title: "Tho da den", body: `${job.worker?.user?.full_name || "Tho"} da den dia diem thuc hien cong viec.`,
      jobId, workerId: job.worker_id, customerId: job.customer_id, dedupeKey: `customer:arrived:${jobId}`, metadata,
    });
  }

  if (event === "job_completed" && customerUserId) {
    await createNotificationsForUsers(supabase, [customerUserId], {
      audience: "customer", type: "job_completed_review", level: "success", priority: 74,
      title: "Cong viec hoan thanh", body: `${serviceName} ${jobCode} da hoan thanh. Vui long danh gia tho.`,
      jobId, workerId: job.worker_id, customerId: job.customer_id, dedupeKey: `customer:completed:${jobId}`, metadata,
    });
  }

  if (event === "rating_created" && customerUserId) {
    await createNotificationsForUsers(supabase, [customerUserId], {
      audience: "customer", type: "customer_thanks", level: "success", priority: 40,
      title: "Tho Den Ngay cam on ban!", body: "Cam on Quy khach da su dung dich vu.",
      jobId, workerId: job.worker_id, customerId: job.customer_id, dedupeKey: `customer:thanks:${jobId}`, metadata,
    });
  }

  if (event === "worker_cancel_requested") {
    await createNotificationsForUsers(supabase, await getAdminUserIds(supabase), {
      audience: "admin", type: "worker_cancel_requested", level: "critical", priority: 94,
      title: "Tho huy viec da nhan", body: `${job.worker?.user?.full_name || "Tho"} yeu cau huy ${jobCode}.`,
      jobId, workerId: job.worker_id, customerId: job.customer_id, dedupeKey: `admin:worker_cancel:${jobId}`, metadata,
    });
  }

  if (event === "job_unassigned_risk" || event === "job_late_risk") {
    await createNotificationsForUsers(supabase, await getAdminUserIds(supabase), {
      audience: "admin", type: event, level: event === "job_unassigned_risk" ? "critical" : "warning", priority: event === "job_unassigned_risk" ? 100 : 86,
      title: event === "job_unassigned_risk" ? "Khong co tho nhan viec" : "Nguy co tre lich",
      body: `${serviceName} ${jobCode} can admin xu ly.`, jobId, workerId: job.worker_id, customerId: job.customer_id,
      dedupeKey: `admin:${event}:${jobId}`, metadata,
    });
  }
}

export async function notifyNextWorkerJob(supabase: SupabaseClient, workerId: string | null | undefined, completedJobId: string) {
  if (!workerId) return;
  const { data: worker } = await supabase.from("workers").select("user_id").eq("id", workerId).maybeSingle();
  if (!worker?.user_id) return;

  const { data: nextJob } = await supabase
    .from("jobs")
    .select("id, job_code, scheduled_at, address, service:services!jobs_service_id_fkey(name)")
    .eq("worker_id", workerId)
    .in("status", ["assigned", "in_progress"])
    .neq("id", completedJobId)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextJob?.id) return;
  const row = nextJob as { id: string; job_code?: string | null; scheduled_at?: string | null; address?: string | null; service?: { name?: string | null } | null };
  await createNotificationsForUsers(supabase, [worker.user_id], {
    audience: "worker", type: "next_job_reminder", level: "info", priority: 82,
    title: `Viec tiep theo ${row.job_code || ""}`.trim(),
    body: `${row.service?.name || "Dich vu"} - ${formatSchedule(row.scheduled_at)}${row.address ? ` | ${row.address}` : ""}`,
    jobId: row.id, workerId, targetUrl: `/worker/history/${row.id}`, dedupeKey: `worker:next:${workerId}:${row.id}`,
    metadata: { completed_job_id: completedJobId },
  });
}

type AccountEmailTemplate = "customer_welcome" | "worker_pending" | "worker_approved" | "worker_rejected" | "password_recovery";

export async function enqueueAccountEmail(
  supabase: SupabaseClient,
  input: { userId?: string | null; toEmail?: string | null; template: AccountEmailTemplate; subject: string; body: string; metadata?: Record<string, unknown> },
) {
  const { error } = await supabase.from("notification_email_outbox").insert({
    user_id: input.userId || null,
    to_email: input.toEmail || null,
    template: input.template,
    subject: input.subject,
    body: input.body,
    metadata: input.metadata || {},
  });
  if (error) console.warn("[notifications] email outbox failed", error.message);
  return { error };
}
export function buildAccountEmail(template: "customer_welcome" | "worker_pending" | "worker_approved" | "worker_rejected", name?: string | null, reason?: string | null) {
  const displayName = name || "ban";
  if (template === "customer_welcome") return { subject: `Chao mung den voi ${APP_NAME}`, body: `Xin chao ${displayName},\n\nTai khoan khach hang cua ban da duoc tao thanh cong. Ban co the dang nhap de dat va theo doi cong viec tren ${APP_NAME}.\n\nCam on ban da tin dung dich vu.` };
  if (template === "worker_pending") return { subject: `${APP_NAME} da nhan ho so tho cua ban`, body: `Xin chao ${displayName},\n\nHo so tho cua ban da duoc gui va dang cho admin duyet. Chung toi se thong bao khi co ket qua.\n\n${APP_NAME}` };
  if (template === "worker_approved") return { subject: "Ho so tho cua ban da duoc duyet", body: `Xin chao ${displayName},\n\nHo so tho cua ban da duoc duyet. Ban co the dang nhap che do Tho de nhan va xu ly cong viec.\n\n${APP_NAME}` };
  return { subject: "Cap nhat ho so tho cua ban", body: `Xin chao ${displayName},\n\nHo so tho cua ban chua duoc duyet.${reason ? `\nLy do: ${reason}` : ""}\n\nBan co the cap nhat thong tin va lien he ho tro neu can.\n\n${APP_NAME}` };
}
