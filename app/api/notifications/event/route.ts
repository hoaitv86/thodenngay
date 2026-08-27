import { NextResponse } from "next/server";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";
import { getServiceRoleSupabase, notifyJobEvent, notifyNextWorkerJob } from "@/lib/notifications/core";

type NotificationEvent = "job_created" | "worker_assigned" | "worker_changed" | "worker_en_route" | "worker_arrived" | "job_completed" | "rating_created" | "worker_cancel_requested" | "job_unassigned_risk" | "job_late_risk";
type Body = { event?: NotificationEvent; jobId?: string; workerId?: string | null; metadata?: Record<string, unknown> };

const adminEvents = new Set<NotificationEvent>(["job_created", "worker_assigned", "worker_changed", "job_unassigned_risk", "job_late_risk"]);
const workerEvents = new Set<NotificationEvent>(["worker_en_route", "worker_arrived", "job_completed", "worker_cancel_requested"]);
const customerEvents = new Set<NotificationEvent>(["rating_created"]);

export async function POST(request: Request) {
  const authClient = await createServerAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Khong duoc phep truy cap." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.event || !body.jobId) return NextResponse.json({ error: "Thieu event/jobId." }, { status: 400 });

  const { data: profile } = await authClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const { data: job, error: jobError } = await authClient
    .from("jobs")
    .select("id, customer_id, worker_id, worker:workers(user_id)")
    .eq("id", body.jobId)
    .maybeSingle();

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Khong tim thay cong viec." }, { status: 404 });

  const workerRelation = job.worker as { user_id?: string | null } | { user_id?: string | null }[] | null;
  const workerUserId = Array.isArray(workerRelation) ? workerRelation[0]?.user_id : workerRelation?.user_id;
  const isAdmin = profile?.role === "admin";
  const isJobWorker = workerUserId === user.id;
  const isJobCustomer = job.customer_id === user.id;
  const allowed = (adminEvents.has(body.event) && isAdmin) || (workerEvents.has(body.event) && isJobWorker) || (customerEvents.has(body.event) && isJobCustomer);

  if (!allowed) return NextResponse.json({ error: "Ban khong co quyen phat thong bao cho su kien nay." }, { status: 403 });

  const supabase = getServiceRoleSupabase() || authClient;
  await notifyJobEvent(supabase, body.event, body.jobId, { ...(body.metadata || {}), actor_id: user.id, source: "notification_event_api" });
  if (body.event === "job_completed") await notifyNextWorkerJob(supabase, body.workerId || job.worker_id, body.jobId);
  return NextResponse.json({ ok: true });
}
